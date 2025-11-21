"""
Security middleware for Flask application.
"""
import os
from functools import wraps
from flask import request, jsonify, g
import time
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Rate limiting storage (in-memory, use Redis in production)
_rate_limit_store = defaultdict(list)
_rate_limit_lock = defaultdict(lambda: False)


def add_security_headers(response):
    """Add security headers to all responses."""
    # Content Security Policy
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https:;"
    )
    
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # XSS Protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # HSTS (only in production with HTTPS)
    if os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Permissions Policy
    response.headers['Permissions-Policy'] = (
        'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
    )
    
    return response


def rate_limit(max_requests=100, window=60, per_ip=True):
    """
    Rate limiting decorator.
    
    Args:
        max_requests: Maximum number of requests allowed
        window: Time window in seconds
        per_ip: If True, rate limit per IP address
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get client identifier
            if per_ip:
                client_id = request.remote_addr or 'unknown'
            else:
                client_id = 'global'
            
            current_time = time.time()
            key = f"{f.__name__}:{client_id}"
            
            # Clean old entries
            _rate_limit_store[key] = [
                req_time for req_time in _rate_limit_store[key]
                if current_time - req_time < window
            ]
            
            # Check rate limit
            if len(_rate_limit_store[key]) >= max_requests:
                logger.warning(f"Rate limit exceeded for {client_id} on {f.__name__}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': window
                }), 429
            
            # Add current request
            _rate_limit_store[key].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def sanitize_input(data):
    """Sanitize user input to prevent injection attacks."""
    if isinstance(data, dict):
        return {k: sanitize_input(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_input(item) for item in data]
    elif isinstance(data, str):
        # Remove null bytes and control characters
        data = data.replace('\x00', '')
        # Remove other dangerous characters
        dangerous_chars = ['<', '>', '"', "'", '&', '\n', '\r']
        for char in dangerous_chars:
            data = data.replace(char, '')
        return data.strip()
    else:
        return data


def validate_file_upload(file):
    """Validate uploaded file."""
    if not file:
        return False, "No file provided"
    
    if not file.filename:
        return False, "No filename provided"
    
    # Check file extension
    allowed_extensions = {'pdf', 'docx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'json'}
    extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    
    if extension not in allowed_extensions:
        return False, f"File type '{extension}' not allowed"
    
    # Check file size (500MB max)
    max_size = 500 * 1024 * 1024
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)  # Reset to beginning
    
    if size > max_size:
        return False, f"File size {size} exceeds maximum {max_size} bytes"
    
    if size == 0:
        return False, "File is empty"
    
    return True, None


def validate_path(path):
    """Validate file path to prevent path traversal attacks."""
    if not path:
        return False
    
    # Normalize path
    normalized = os.path.normpath(path)
    
    # Check for path traversal attempts
    if '..' in normalized or normalized.startswith('/'):
        return False
    
    # Check for dangerous characters
    dangerous_chars = ['<', '>', '|', '&', ';', '`', '$', '(', ')']
    if any(char in normalized for char in dangerous_chars):
        return False
    
    return True

