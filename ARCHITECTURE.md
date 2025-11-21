# 🏗️ PII Sentinel - Architecture Documentation

## Overview

PII Sentinel has been restructured into a modular, maintainable architecture following best practices for Flask applications.

## Directory Structure

```
backend/
├── app.py                 # Main application entry point (minimal)
├── config.py              # Configuration management
├── mongo_client.py       # MongoDB client wrapper
├── middleware/
│   ├── __init__.py
│   └── security.py       # Security middleware (headers, rate limiting, validation)
├── routes/
│   ├── __init__.py       # Blueprint registration
│   ├── auth.py           # Authentication routes (login, OTP)
│   ├── batches.py        # Batch management routes
│   ├── files.py          # File upload/download routes
│   ├── settings.py       # User settings routes
│   └── health.py         # Health check routes
├── services/             # Business logic layer (future)
├── utils/                # Utility functions
├── tests/                # Test suite
│   ├── test_security.py
│   ├── test_api_auth.py
│   └── test_mongo_client.py
└── data/                 # Storage directory
    ├── uploads/
    ├── results/
    └── masked/
```

## Architecture Layers

### 1. Configuration Layer (`config.py`)

**Purpose:** Centralized configuration management

**Features:**
- Environment-based configuration (development, production, testing)
- Validation for production settings
- Type-safe configuration access
- Automatic directory creation

**Usage:**
```python
from config import config

if config.is_production():
    # Production-specific logic
    pass
```

### 2. Middleware Layer (`middleware/`)

**Purpose:** Cross-cutting concerns (security, validation, rate limiting)

**Components:**
- **Security Headers:** CSP, X-Frame-Options, HSTS, etc.
- **Rate Limiting:** Per-endpoint rate limiting
- **Input Validation:** Sanitization and validation
- **File Validation:** Upload security checks
- **Path Validation:** Path traversal prevention

**Usage:**
```python
from middleware.security import rate_limit, validate_file_upload

@route('/api/endpoint')
@rate_limit(max_requests=10, window=60)
def endpoint():
    pass
```

### 3. Routes Layer (`routes/`)

**Purpose:** HTTP request handling and routing

**Organization:**
- **auth.py:** Authentication and OTP endpoints
- **batches.py:** Batch CRUD operations
- **files.py:** File upload/download
- **settings.py:** User settings management
- **health.py:** Health checks

**Pattern:**
```python
from flask import Blueprint

bp = Blueprint('name', __name__)

@bp.route('/endpoint')
@require_api_key
def handler():
    pass
```

### 4. Data Layer (`mongo_client.py`)

**Purpose:** Database operations abstraction

**Features:**
- Connection pooling
- Retry logic
- Error handling
- Type safety

### 5. Service Layer (Future)

**Purpose:** Business logic separation

**Planned:**
- `pii_detector_service.py` - PII detection logic
- `file_processor_service.py` - File processing
- `otp_service.py` - OTP management
- `user_service.py` - User management

## Request Flow

```
Client Request
    ↓
Flask App (app.py)
    ↓
Security Middleware (headers, rate limiting)
    ↓
Route Blueprint (routes/*.py)
    ↓
Authentication Check (require_api_key)
    ↓
Route Handler
    ↓
Service Layer (future)
    ↓
Data Layer (mongo_client.py)
    ↓
MongoDB
```

## Security Architecture

### Authentication Flow

1. **API Key Validation**
   - Constant-time comparison
   - Production enforcement
   - Development bypass

2. **Rate Limiting**
   - Per-endpoint limits
   - IP-based tracking
   - Configurable windows

3. **Input Validation**
   - Sanitization
   - Type checking
   - Path validation

### Security Headers

All responses include:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Strict-Transport-Security (production)
- Referrer-Policy
- Permissions-Policy

## Configuration Management

### Environment Variables

**Required:**
- `MONGO_URI` - MongoDB connection string
- `API_KEY` - API authentication key
- `FLASK_SECRET` - Flask session secret

**Optional:**
- `FLASK_ENV` - Environment (development/production/testing)
- `CORS_ORIGINS` - Allowed CORS origins
- `STORAGE_PATH` - File storage path
- `MAX_WORKERS` - Processing workers
- `TWILIO_*` - SMS configuration

### Configuration Validation

Production mode validates:
- All required variables set
- No default/placeholder values
- CORS origins restricted
- Security settings enabled

## Testing Strategy

### Unit Tests
- Security middleware
- Input validation
- Configuration

### Integration Tests
- API endpoints
- Database operations
- File processing

### Security Tests
- Authentication bypass attempts
- Rate limiting
- Input validation
- Path traversal

## Deployment Architecture

### Development
- Flask development server
- Debug mode enabled
- Relaxed security

### Production
- Gunicorn with multiple workers
- Nginx reverse proxy
- HTTPS enforcement
- Strict security settings
- Monitoring and logging

## Future Improvements

1. **Service Layer**
   - Extract business logic
   - Improve testability
   - Better separation of concerns

2. **Caching**
   - Redis for rate limiting
   - Response caching
   - Session storage

3. **JWT Authentication**
   - Replace simple tokens
   - Refresh tokens
   - Token revocation

4. **API Versioning**
   - Versioned endpoints
   - Backward compatibility
   - Deprecation strategy

5. **Monitoring**
   - Application metrics
   - Error tracking
   - Performance monitoring

## Best Practices

1. **Security First**
   - Always validate input
   - Use constant-time comparisons
   - Fail securely
   - Log security events

2. **Error Handling**
   - Generic errors in production
   - Detailed logging
   - Proper HTTP status codes

3. **Code Organization**
   - Single responsibility
   - DRY principle
   - Clear naming
   - Documentation

4. **Testing**
   - Unit tests for logic
   - Integration tests for APIs
   - Security tests for vulnerabilities

---

**Last Updated:** 2025-01-15  
**Version:** 2.0.0

