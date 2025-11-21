"""
Flask API for PII Sentinel Backend - Refactored Version.
Main application entry point with modular route structure.
"""
import os
import logging
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# Import configuration
from config import config

# Import route blueprints
from routes import register_blueprints

# Import security middleware
try:
    from middleware.security import add_security_headers
except ImportError:
    logging.warning("Security middleware not available")
    def add_security_headers(response):
        return response

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = config.SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = config.MAX_CONTENT_LENGTH

# SECURITY: Add security headers to all responses
@app.after_request
def after_request(response):
    return add_security_headers(response)

# SECURITY: CORS configuration
allowed_origins = config.CORS_ORIGINS
if config.is_production():
    if '*' in allowed_origins:
        logger.warning("CORS configured to allow all origins in production - this is insecure!")
        allowed_origins = ['https://yourdomain.com']  # Replace with actual domain

CORS(app, 
     resources={r"/api/*": {
         "origins": allowed_origins,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "X-API-KEY", "Authorization"],
         "expose_headers": ["Content-Type"],
         "max_age": 3600
     }},
     supports_credentials=True)

# Register all route blueprints
register_blueprints(app)

# Error handlers
@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    from flask import jsonify
    return jsonify({'error': 'File too large. Maximum size is 500MB'}), 413


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    from flask import jsonify
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    from flask import jsonify
    logger.error(f"Internal server error: {error}", exc_info=True)
    if config.is_production():
        return jsonify({'error': 'Internal server error'}), 500
    else:
        return jsonify({'error': str(error)}), 500


if __name__ == '__main__':
    logger.info(f"Starting PII Sentinel Backend (Environment: {config.FLASK_ENV})")
    logger.info(f"Server running on {config.FLASK_HOST}:{config.FLASK_PORT}")
    
    if config.is_production():
        logger.warning("Running in production mode. Consider using Gunicorn instead.")
    
    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=config.is_development()
    )

