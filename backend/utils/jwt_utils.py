"""
JWT authentication utilities for PII Sentinel.
"""
import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from functools import wraps
from flask import request, jsonify

from config import config

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRY = timedelta(minutes=15)  # 15 minutes
REFRESH_TOKEN_EXPIRY = timedelta(days=7)  # 7 days


def generate_access_token(user_id: str, email: str, username: str = None) -> str:
    """
    Generate a JWT access token.
    
    Args:
        user_id: User identifier (email)
        email: User email
        username: Optional username
    
    Returns:
        Encoded JWT token
    """
    if not config.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set for JWT token generation")
    
    payload = {
        'user_id': user_id,
        'email': email,
        'username': username,
        'type': 'access',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + ACCESS_TOKEN_EXPIRY
    }
    
    token = jwt.encode(payload, config.SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def generate_refresh_token(user_id: str, email: str) -> str:
    """
    Generate a JWT refresh token.
    
    Args:
        user_id: User identifier (email)
        email: User email
    
    Returns:
        Encoded JWT refresh token
    """
    if not config.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set for JWT token generation")
    
    payload = {
        'user_id': user_id,
        'email': email,
        'type': 'refresh',
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + REFRESH_TOKEN_EXPIRY
    }
    
    token = jwt.encode(payload, config.SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token: str, token_type: str = 'access') -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token to verify
        token_type: Expected token type ('access' or 'refresh')
    
    Returns:
        Decoded token payload or None if invalid
    """
    if not config.SECRET_KEY:
        logger.error("SECRET_KEY not set, cannot verify token")
        return None
    
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Verify token type
        if payload.get('type') != token_type:
            logger.warning(f"Token type mismatch: expected {token_type}, got {payload.get('type')}")
            return None
        
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


def require_jwt_auth(f):
    """
    Decorator to require JWT authentication.
    Expects token in Authorization header as 'Bearer <token>'
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401
        
        # Extract token from 'Bearer <token>' format
        try:
            token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        except IndexError:
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Verify token
        payload = verify_token(token, token_type='access')
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Add user info to request context
        request.current_user = {
            'user_id': payload.get('user_id'),
            'email': payload.get('email'),
            'username': payload.get('username')
        }
        
        return f(*args, **kwargs)
    return decorated_function


def refresh_access_token(refresh_token: str) -> Optional[Dict[str, str]]:
    """
    Generate a new access token from a refresh token.
    
    Args:
        refresh_token: Valid refresh token
    
    Returns:
        Dict with new access_token and refresh_token, or None if invalid
    """
    payload = verify_token(refresh_token, token_type='refresh')
    if not payload:
        return None
    
    user_id = payload.get('user_id')
    email = payload.get('email')
    username = payload.get('username')
    
    # Generate new tokens
    new_access_token = generate_access_token(user_id, email, username)
    new_refresh_token = generate_refresh_token(user_id, email)
    
    return {
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }

