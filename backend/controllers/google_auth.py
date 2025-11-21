"""
Google OAuth2 Authentication Controller
Handles Google token verification and user authentication
"""
import os
import logging
from datetime import datetime, timedelta
import jwt
import requests
from flask import request, jsonify, Blueprint, make_response

logger = logging.getLogger(__name__)

# Import Google OAuth dependencies
try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False
    logger.warning("Google OAuth libraries not installed. Install with: pip install google-auth")

# Import MongoDB client
from mongo_client import mongo_client

# Create Blueprint
google_auth_blueprint = Blueprint('google_auth', __name__, url_prefix='/api/auth')

# Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
JWT_SECRET = os.getenv('FLASK_SECRET', 'your-secret-key')
JWT_EXPIRY_DAYS = 7
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'postmessage')
GOOGLE_TOKEN_ENDPOINT = os.getenv('GOOGLE_TOKEN_ENDPOINT', 'https://oauth2.googleapis.com/token')
ALLOW_GOOGLE_AUTO_CREATE = os.getenv('GOOGLE_AUTO_CREATE_USERS', 'false').strip().lower() == 'true'


def verify_google_id_token(id_token_str):
    """
    Verify Google ID Token
    
    Args:
        id_token_str: Google ID token string
        
    Returns:
        dict: Payload with user info or None if invalid
    """
    if not GOOGLE_AUTH_AVAILABLE:
        logger.error("Google OAuth libraries not available")
        return None
    
    if not GOOGLE_CLIENT_ID:
        logger.error("GOOGLE_CLIENT_ID not configured")
        return None
    
    try:
        # Verify the token
        payload = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Verify email is verified
        if not payload.get('email_verified'):
            logger.warning(f"Email not verified for: {payload.get('email')}")
            return None
        
        logger.info(f"✓ Google token verified for: {payload.get('email')}")
        return payload
        
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        return None


def exchange_auth_code(auth_code):
    """
    Exchange authorization code for tokens using Google's OAuth endpoint.
    """
    if not GOOGLE_AUTH_AVAILABLE:
        logger.error("Google OAuth libraries not available")
        return None

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth credentials not configured")
        return None

    payload = {
        'code': auth_code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI or 'postmessage',
        'grant_type': 'authorization_code'
    }

    try:
        response = requests.post(
            GOOGLE_TOKEN_ENDPOINT or 'https://oauth2.googleapis.com/token',
            data=payload,
            timeout=10
        )
        response.raise_for_status()
        token_data = response.json()
        logger.info("✓ Google auth code exchanged for tokens")
        return token_data
    except requests.RequestException as exc:
        logger.error(f"Google token exchange failed: {exc}")
    except ValueError:
        logger.error("Failed to parse Google token exchange response")
    return None


def generate_jwt_token(user_id):
    """
    Generate JWT token for user
    
    Args:
        user_id: User ID (email)
        
    Returns:
        str: JWT token
    """
    try:
        expires = datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
        payload = {
            'user_id': user_id,
            'exp': expires,
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
        logger.info(f"JWT token generated for user: {user_id}")
        return token
    except Exception as e:
        logger.error(f"Error generating JWT: {e}")
        return None


def serialize_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def get_or_create_user(google_payload):
    """
    Get or create user in database
    
    Args:
        google_payload: Google token payload
        
    Returns:
        dict: User data or None if failed
    """
    try:
        email = google_payload.get('email')
        if not email:
            logger.error("No email in Google payload")
            return None
        
        # Check if user exists
        user = mongo_client.get_user_by_email(email)
        
        if user:
            logger.info(f"✓ User found: {email}")
            # Update last login
            now_iso = datetime.utcnow().isoformat()
            user['last_login'] = now_iso
            user['updated_at'] = now_iso
            if getattr(mongo_client, "db", None) is not None:
                mongo_client.db["User-Base"].update_one(
                    {"email": email},
                    {"$set": {"last_login": now_iso, "updated_at": now_iso}}
                )
            return user, False, None
        else:
            if not ALLOW_GOOGLE_AUTO_CREATE:
                logger.info(f"Google user not found and auto-create disabled: {email}")
                return None, False, 'USER_NOT_FOUND'
            # Create new user
            logger.info(f"Creating new user: {email}")
            user_data = {
                'email': email,
                'fullName': google_payload.get('name', 'User'),
                'username': email.split('@')[0],
                'profile_picture': google_payload.get('picture', ''),
                'emailVerified': True,
                'google_id': google_payload.get('sub', ''),
                'phone': '',
                'country': '',
                'account_status': 'active',
                'subscription': {
                    'plan_name': 'free',
                    'plan_type': 'basic',
                    'status': 'active',
                    'activated_at': datetime.utcnow().isoformat(),
                    'billing_period': 'monthly'
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
                'last_login': datetime.utcnow().isoformat(),
                'is_google_user': True
            }
            
            user_id = mongo_client.create_user(user_data)
            if user_id:
                logger.info(f"✓ New user created: {email} (ID: {user_id})")
                # Fetch and return the created user
                created_user = mongo_client.get_user_by_email(email)
                if created_user:
                    created_user['just_created'] = True
                return created_user, True, None
            else:
                logger.error(f"Failed to create user: {email}")
                return None, False, 'CREATE_FAILED'
                
    except Exception as e:
        logger.error(f"Error in get_or_create_user: {e}")
        return None, False, 'UNKNOWN_ERROR'


@google_auth_blueprint.route('/google', methods=['POST', 'OPTIONS'])
def google_auth():
    """
    Handle Google OAuth authentication
    
    Request JSON:
    {
        "id_token": "<GOOGLE_ID_TOKEN>"
        // or
        "auth_code": "<GOOGLE_AUTHORIZATION_CODE>"
    }
    
    Response:
    {
        "success": true,
        "jwt": "<JWT_TOKEN>",
        "user": {
            "email": "user@example.com",
            "fullName": "User Name",
            ...
        }
    }
    """
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = make_response('', 200)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-KEY, Authorization'
        return response
    
    try:
        # Get ID token from request
        data = request.get_json()
        id_token_str = data.get('id_token')
        auth_code = data.get('auth_code') or data.get('code')
        token_exchange = None

        if auth_code and not id_token_str:
            logger.info("🔄 Exchanging Google auth code for ID token...")
            token_exchange = exchange_auth_code(auth_code)
            if not token_exchange:
                return jsonify({
                    'success': False,
                    'error': 'Failed to exchange Google authorization code'
                }), 401
            id_token_str = token_exchange.get('id_token')
            if not id_token_str:
                logger.error("Token exchange response missing id_token")
                return jsonify({
                    'success': False,
                    'error': 'Google token exchange did not return an ID token'
                }), 401
        
        if not id_token_str:
            logger.warning("No ID token provided")
            return jsonify({
                'success': False,
                'error': 'ID token is required'
            }), 400
        
        # Verify Google ID token
        logger.info("🔐 Verifying Google ID token...")
        google_payload = verify_google_id_token(id_token_str)
        
        if not google_payload:
            logger.warning("Google token verification failed")
            return jsonify({
                'success': False,
                'error': 'Invalid or expired Google token'
            }), 401
        
        # Get or create user (based on configuration)
        logger.info("👤 Resolving user account...")
        user, was_created, failure_reason = get_or_create_user(google_payload)
        
        if not user:
            status_code = 400 if failure_reason == 'CREATE_FAILED' else 404 if failure_reason == 'USER_NOT_FOUND' else 500
            logger.error("Failed to get or create user")
            return jsonify({
                'success': False,
                'error': 'No account found for this Google email. Please sign up first.' if failure_reason == 'USER_NOT_FOUND' else 'Failed to process user account',
                'code': failure_reason
            }), status_code
        
        # Generate JWT token
        logger.info("🔑 Generating JWT token...")
        jwt_token = generate_jwt_token(user.get('email'))
        
        if not jwt_token:
            logger.error("Failed to generate JWT")
            return jsonify({
                'success': False,
                'error': 'Failed to generate authentication token'
            }), 500
        
        # Prepare response
        response = {
            'success': True,
            'message': 'Authentication successful',
            'jwt': jwt_token,
            'user': {
                'email': user.get('email'),
                'fullName': user.get('fullName'),
                'username': user.get('username'),
                'profile_picture': user.get('profile_picture'),
                'account_status': user.get('account_status'),
                'created_at': serialize_datetime(user.get('created_at')),
                'updated_at': serialize_datetime(user.get('updated_at')),
                'last_login': serialize_datetime(user.get('last_login'))
            }
        }
        if token_exchange and token_exchange.get('access_token'):
            response['google'] = {
                'access_token': token_exchange.get('access_token'),
                'expires_in': token_exchange.get('expires_in'),
                'scope': token_exchange.get('scope')
            }
        if was_created:
            response['message'] = 'Google account linked and profile created'
        
        logger.info(f"✓ Google OAuth successful for: {user.get('email')}")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@google_auth_blueprint.route('/google-token', methods=['POST'])
def google_access_token():
    """
    Handle Google Access Token authentication (alternative method)
    
    Request JSON:
    {
        "access_token": "<GOOGLE_ACCESS_TOKEN>"
    }
    """
    try:
        data = request.get_json()
        access_token = data.get('access_token')
        
        if not access_token:
            return jsonify({
                'success': False,
                'error': 'Access token is required'
            }), 400
        
        # This is an alternative implementation
        # You can use access_token to call Google's userinfo endpoint
        # For now, we'll return an error as ID token is preferred
        
        logger.warning("Access token method called - ID token method is preferred")
        return jsonify({
            'success': False,
            'error': 'Please use ID token authentication method'
        }), 400
        
    except Exception as e:
        logger.error(f"Google access token error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@google_auth_blueprint.route('/google/callback', methods=['GET'])
def google_callback():
    """
    Google OAuth callback (optional - for redirect-based flow)
    """
    try:
        auth_code = request.args.get('code')
        
        if not auth_code:
            return jsonify({
                'success': False,
                'error': 'Authorization code is required'
            }), 400
        
        # This would be used for server-to-server token exchange
        # For frontend-based authentication, the ID token flow is preferred
        
        logger.info("Google callback endpoint called")
        return jsonify({
            'success': False,
            'message': 'Please use ID token authentication method'
        }), 200
        
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@google_auth_blueprint.route('/status', methods=['GET'])
def auth_status():
    """
    Check Google OAuth configuration status
    """
    try:
        status = {
            'google_auth_available': GOOGLE_AUTH_AVAILABLE,
            'client_id_configured': bool(GOOGLE_CLIENT_ID),
            'client_secret_configured': bool(GOOGLE_CLIENT_SECRET),
            'mongodb_connected': mongo_client.db is not None
        }
        
        logger.info(f"Auth status: {status}")
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"Error checking auth status: {e}")
        return jsonify({
            'error': str(e)
        }), 500


# Export blueprint
__all__ = ['google_auth_blueprint']


