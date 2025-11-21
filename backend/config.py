"""
Configuration management for PII Sentinel backend.
Centralizes all configuration settings.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Base configuration class."""
    
    # Flask Configuration
    SECRET_KEY = os.getenv('FLASK_SECRET', '')
    API_KEY = os.getenv('API_KEY', '')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    
    # Server Configuration
    FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
    
    # Database Configuration
    MONGO_URI = os.getenv('MONGO_URI', '')
    MONGO_DB_PREFIX = os.getenv('MONGO_DB_PREFIX', 'pii_sentinel_')
    
    # Storage Configuration
    STORAGE_PATH = os.getenv('STORAGE_PATH', './data')
    UPLOAD_FOLDER = None
    RESULTS_FOLDER = None
    MASKED_FOLDER = None
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    
    # Twilio Configuration
    TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
    TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
    TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER', '')
    
    # Processing Configuration
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 16))
    MAX_CONCURRENCY = int(os.getenv('MAX_CONCURRENCY', 50))
    USE_GPU = os.getenv('USE_GPU', 'false').lower() == 'true'
    USE_ADVANCED_DETECTOR = os.getenv('USE_ADVANCED_DETECTOR', 'true').lower() == 'true'
    
    # OCR Configuration
    PDF_DPI = int(os.getenv('PDF_DPI', 150))
    EASYOCR_QUANTIZE = os.getenv('EASYOCR_QUANTIZE', 'true').lower() == 'true'
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
    
    # Security Configuration
    OTP_EXPIRY_SECONDS = 120  # 2 minutes
    RATE_LIMIT_ENABLED = True
    
    # Redis Configuration
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    REDIS_ENABLED = os.getenv('REDIS_ENABLED', 'false').lower() == 'true'
    
    # JWT Configuration
    JWT_ALGORITHM = 'HS256'
    JWT_ACCESS_TOKEN_EXPIRY = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRY', 900))  # 15 minutes
    JWT_REFRESH_TOKEN_EXPIRY = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRY', 604800))  # 7 days
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'json'}
    
    def __init__(self):
        """Initialize configuration and create storage directories."""
        from utils import ensure_dir
        
        # Set storage paths
        self.UPLOAD_FOLDER = os.path.join(self.STORAGE_PATH, 'uploads')
        self.RESULTS_FOLDER = os.path.join(self.STORAGE_PATH, 'results')
        self.MASKED_FOLDER = os.path.join(self.STORAGE_PATH, 'masked')
        
        # Ensure directories exist
        ensure_dir(self.UPLOAD_FOLDER)
        ensure_dir(self.RESULTS_FOLDER)
        ensure_dir(self.MASKED_FOLDER)
        
        # Validate production configuration
        if self.is_production():
            self._validate_production_config()
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.FLASK_ENV == 'production' or self.ENVIRONMENT == 'production'
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return not self.is_production()
    
    def _validate_production_config(self):
        """Validate production configuration."""
        import logging
        logger = logging.getLogger(__name__)
        
        errors = []
        
        if not self.SECRET_KEY or self.SECRET_KEY == 'your-flask-secret-key-here':
            errors.append("FLASK_SECRET must be set in production")
        
        if not self.API_KEY or self.API_KEY == 'your-api-key-here':
            errors.append("API_KEY must be set in production")
        
        if not self.MONGO_URI or 'username:password' in self.MONGO_URI:
            errors.append("MONGO_URI must be set with real credentials in production")
        
        if '*' in self.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must not be '*' in production")
        
        if errors:
            error_msg = "Production configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info("Production configuration validated successfully")


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    
    # Production-specific settings
    RATE_LIMIT_ENABLED = True


class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = True
    TESTING = True
    
    # Use test database
    MONGO_DB_PREFIX = 'pii_sentinel_test_'
    
    # Disable rate limiting in tests
    RATE_LIMIT_ENABLED = False


# Configuration factory
def get_config():
    """Get configuration based on environment."""
    env = os.getenv('FLASK_ENV', 'development')
    
    config_map = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig
    }
    
    config_class = config_map.get(env, DevelopmentConfig)
    return config_class()


# Global config instance
config = get_config()

