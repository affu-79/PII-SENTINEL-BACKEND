"""
Shared authentication utilities.
"""
import secrets
import logging
from functools import wraps
from flask import request, jsonify

from config import config

logger = logging.getLogger(__name__)


def require_api_key(f):
    """
    Decorator to require API key authentication.
    Uses constant-time comparison to prevent timing attacks.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-KEY')
        expected_key = config.API_KEY
        
        # SECURITY: Fail securely - require API key in production
        if not expected_key:
            if config.is_production():
                logger.error("API_KEY not set in production environment - rejecting request")
                return jsonify({'error': 'Server configuration error'}), 500
            else:
                logger.warning("API_KEY not set in environment, skipping auth check (development mode)")
                return f(*args, **kwargs)
        
        # SECURITY: Use constant-time comparison to prevent timing attacks
        if not api_key:
            logger.warning("API key missing in request")
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        # Constant-time comparison
        if len(api_key) != len(expected_key):
            logger.warning("API key length mismatch")
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        # Use secrets.compare_digest for constant-time comparison
        if not secrets.compare_digest(api_key, expected_key):
            logger.warning("API key mismatch")
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

