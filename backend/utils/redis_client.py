"""
Redis client wrapper for rate limiting, caching, and session storage.
"""
import os
import logging
import json
from typing import Optional, Any, Dict
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

# Try to import redis, fallback to in-memory if not available
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available, falling back to in-memory storage")

from config import config


class RedisClient:
    """Redis client wrapper with fallback to in-memory storage."""
    
    def __init__(self):
        self.client = None
        self._memory_store = {}  # Fallback in-memory storage
        self._rate_limit_store = {}  # In-memory rate limit tracking
        
        if REDIS_AVAILABLE:
            try:
                redis_url = config.REDIS_URL if hasattr(config, 'REDIS_URL') else os.getenv('REDIS_URL', 'redis://localhost:6379/0')
                self.client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.client.ping()
                logger.info("Redis connection established")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}, using in-memory storage")
                self.client = None
        else:
            logger.info("Using in-memory storage (Redis not installed)")
    
    def get(self, key: str) -> Optional[str]:
        """Get value from Redis or memory."""
        if self.client:
            try:
                return self.client.get(key)
            except Exception as e:
                logger.error(f"Redis get error: {e}")
                return self._memory_store.get(key)
        return self._memory_store.get(key)
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set value in Redis or memory."""
        if self.client:
            try:
                return self.client.set(key, value, ex=ex)
            except Exception as e:
                logger.error(f"Redis set error: {e}")
                self._memory_store[key] = value
                return True
        self._memory_store[key] = value
        return True
    
    def delete(self, key: str) -> bool:
        """Delete key from Redis or memory."""
        if self.client:
            try:
                return bool(self.client.delete(key))
            except Exception as e:
                logger.error(f"Redis delete error: {e}")
                return self._memory_store.pop(key, None) is not None
        return self._memory_store.pop(key, None) is not None
    
    def incr(self, key: str, ex: Optional[int] = None) -> int:
        """Increment counter in Redis or memory."""
        if self.client:
            try:
                count = self.client.incr(key)
                if ex and count == 1:  # Set expiry only on first increment
                    self.client.expire(key, ex)
                return count
            except Exception as e:
                logger.error(f"Redis incr error: {e}")
                return self._in_memory_incr(key)
        return self._in_memory_incr(key)
    
    def _in_memory_incr(self, key: str) -> int:
        """In-memory increment with expiry simulation."""
        if key not in self._rate_limit_store:
            self._rate_limit_store[key] = {'count': 0, 'expiry': None}
        
        self._rate_limit_store[key]['count'] += 1
        return self._rate_limit_store[key]['count']
    
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        if self.client:
            try:
                return bool(self.client.exists(key))
            except Exception as e:
                logger.error(f"Redis exists error: {e}")
                return key in self._memory_store
        return key in self._memory_store


# Global Redis client instance
redis_client = RedisClient()


def rate_limit_redis(max_requests: int = 100, window: int = 60, per_ip: bool = True):
    """
    Rate limiting decorator using Redis (with in-memory fallback).
    
    Args:
        max_requests: Maximum number of requests
        window: Time window in seconds
        per_ip: Whether to limit per IP address
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get identifier (IP address or user ID)
            if per_ip:
                identifier = request.remote_addr or 'unknown'
            else:
                # Try to get user ID from JWT token
                auth_header = request.headers.get('Authorization', '')
                if auth_header:
                    try:
                        from utils.jwt_utils import verify_token
                        token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
                        payload = verify_token(token)
                        identifier = payload.get('user_id', 'unknown') if payload else request.remote_addr
                    except:
                        identifier = request.remote_addr
                else:
                    identifier = request.remote_addr
            
            # Create rate limit key
            key = f"rate_limit:{f.__name__}:{identifier}"
            
            # Check current count
            current = redis_client.incr(key, ex=window)
            
            if current > max_requests:
                logger.warning(f"Rate limit exceeded for {identifier} on {f.__name__}: {current}/{max_requests}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'limit': max_requests,
                    'window': window,
                    'retry_after': window
                }), 429
            
            # Add rate limit headers
            response = f(*args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers['X-RateLimit-Limit'] = str(max_requests)
                response.headers['X-RateLimit-Remaining'] = str(max(max_requests - current, 0))
                response.headers['X-RateLimit-Reset'] = str(window)
            
            return response
        return decorated_function
    return decorator

