"""
Flask API for PII Sentinel Backend.
Handles file uploads, batch management, PII detection, and masking.
"""
import os
import uuid
import logging
import random
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
import bcrypt
import json
import base64
from flask_cors import CORS
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from dotenv import load_dotenv
import threading
from functools import wraps
from concurrent.futures import ThreadPoolExecutor
from cachetools import cached, TTLCache
from typing import Optional, Dict, Any

# Load environment variables FIRST before importing modules that need them
load_dotenv()

# Import PII Detection modules
try:
    from pii_detection_api import pii_detection_bp
    PII_DETECTION_AVAILABLE = True
except ImportError as e:
    logger.warning(f"PII Detection modules not available: {e}")
    PII_DETECTION_AVAILABLE = False

try:
    from controllers.google_auth import google_auth_blueprint
    GOOGLE_AUTH_INTEGRATED = True
except ImportError as e:
    logging.getLogger(__name__).warning(f"Google auth blueprint not available: {e}")
    GOOGLE_AUTH_INTEGRATED = False

# Cache for fast batch retrieval (in-memory, cleared periodically)
batch_cache = {}
batch_cache_lock = threading.Lock()
CACHE_TTL = 10  # Cache for 10 seconds

def get_cached_batches(user_id):
    """Get batches from cache if available and not expired."""
    with batch_cache_lock:
        cache_key = f"user_{user_id}"
        if cache_key in batch_cache:
            cached_data, timestamp = batch_cache[cache_key]
            if time.time() - timestamp < CACHE_TTL:
                return cached_data
        return None

def set_cached_batches(user_id, data):
    """Cache batch data with timestamp."""
    with batch_cache_lock:
        cache_key = f"user_{user_id}"
        batch_cache[cache_key] = (data, time.time())

def invalidate_batch_cache(user_id):
    """Invalidate cache when batches change."""
    with batch_cache_lock:
        cache_key = f"user_{user_id}"
        if cache_key in batch_cache:
            del batch_cache[cache_key]

from mongo_client import mongo_client
from parallel_processor import get_processor
from performance_config import perf_config
from worker_stub import process_file
from maskers import masker
from utils import (
    save_json, load_json, create_zip, get_timestamp, ensure_dir,
    sanitize_filename, is_pdf_file, is_docx_file, is_doc_file, is_image_file, is_text_file
)
from payments import RazorpayService, RazorpayNotConfigured, RazorpaySignatureError, InvoiceService

# Import security middleware
try:
    from middleware.security import add_security_headers, rate_limit, sanitize_input, validate_file_upload, validate_path
except ImportError:
    # Fallback if middleware not available
    logger.warning("Security middleware not available, using basic security")
    def add_security_headers(response):
        return response
    def rate_limit(max_requests=100, window=60, per_ip=True):
        def decorator(f):
            return f
        return decorator
    def sanitize_input(data):
        return data
    def validate_file_upload(file):
        return True, None
    def validate_path(path):
        return True

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Wrap Flask app with middleware that handles multipart requests better
original_wsgi_app = app.wsgi_app

def custom_wsgi_app(environ, start_response):
    """Custom WSGI middleware to handle multipart requests and bypass Werkzeug validation."""
    path = environ.get('PATH_INFO', '')
    method = environ.get('REQUEST_METHOD', '')
    content_type = environ.get('CONTENT_TYPE', '')
    
    # For upload endpoints, ensure content-type is acceptable to Werkzeug
    if method == 'POST' and '/upload' in path:
        logger.info(f"🔧 WSGI middleware: Upload endpoint detected")
        logger.info(f"   PATH: {path}, Content-Type: '{content_type}'")
        
        # If it's multipart, let it through as-is
        if 'multipart' in content_type.lower():
            logger.info(f"   ✓ Valid multipart/form-data detected")
        elif not content_type:
            # If no content-type, set a default multipart one
            # (browser should have set it, but just in case)
            logger.warning(f"   ⚠️  No Content-Type set, assuming multipart")
            environ['CONTENT_TYPE'] = 'multipart/form-data'
        else:
            logger.warning(f"   ⚠️  Unexpected Content-Type: {content_type}, allowing through anyway")
            # Don't force it - let Flask handle it
    
    return original_wsgi_app(environ, start_response)

app.wsgi_app = custom_wsgi_app

# Debug: Log all incoming requests and bypass 415 for upload
@app.before_request
def log_request():
    logger.info(f"Incoming request: {request.method} {request.path}")
    logger.info(f"  Content-Type: {request.content_type}")
    logger.info(f"  Raw Content-Type header: {request.headers.get('Content-Type')}")
    
    if request.method == 'POST':
        if request.path == '/api/upload':
            logger.info(f"  [UPLOAD] Multipart request detected")
        elif 'multipart' in (request.content_type or ''):
            logger.info(f"  Files in request: {list(request.files.keys())}")
            for key in request.files.keys():
                logger.info(f"    - {key}: {len(request.files.getlist(key))} file(s)")

# SECURITY: Add security headers to all responses
@app.after_request
def after_request(response):
    return add_security_headers(response)

# SECURITY: CORS configuration - restrict origins in production
allowed_origins = os.getenv('CORS_ORIGINS', '*').split(',')
if os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production':
    # In production, require explicit origins
    if '*' in allowed_origins:
        logger.warning("CORS configured to allow all origins in production - this is insecure!")
        allowed_origins = ['https://yourdomain.com']  # Replace with actual domain
    
CORS(app, 
     resources={r"/api/*": {
         "origins": allowed_origins,
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "X-API-KEY", "Authorization", "*"],
         "expose_headers": ["Content-Type"],
         "max_age": 3600,
         "supports_credentials": True
     }},
     supports_credentials=True,
     allow_headers="*",
     expose_headers="*")

# Register PII Detection blueprint
if PII_DETECTION_AVAILABLE:
    app.register_blueprint(pii_detection_bp)
    logger.info("✓ PII Detection API blueprint registered")
else:
    logger.warning("PII Detection API not available")

if GOOGLE_AUTH_INTEGRATED:
    app.register_blueprint(google_auth_blueprint)
    logger.info("✓ Google OAuth blueprint registered")
else:
    logger.warning("Google OAuth blueprint not registered")

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
storage_path = os.getenv('STORAGE_PATH', './data')
app.config['UPLOAD_FOLDER'] = os.path.join(storage_path, 'uploads')
app.config['RESULTS_FOLDER'] = os.path.join(storage_path, 'results')
app.config['MASKED_FOLDER'] = os.path.join(storage_path, 'masked')

# Ensure directories exist
ensure_dir(app.config['UPLOAD_FOLDER'])
ensure_dir(app.config['RESULTS_FOLDER'])
ensure_dir(app.config['MASKED_FOLDER'])

invoice_service = InvoiceService(os.path.join(storage_path, 'invoices'))
razorpay_service = RazorpayService.from_env()
if razorpay_service.enabled:
    logger.info("✓ Razorpay integration enabled")
else:
    logger.warning("Razorpay not configured. Paid flows will require simulation mode until keys are provided.")

# In-memory job storage (for real-time processing)
# Use thread-safe dict for concurrent access
jobs = {}
_jobs_lock = threading.Lock()

# OTP storage - Now using MongoDB instead of in-memory
# Keeping in-memory as fallback for backward compatibility
otp_storage = {}
_otp_lock = threading.Lock()
OTP_EXPIRY_SECONDS = 120  # 2 minutes

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'pdf', 'docx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'json'
}


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def require_api_key(f):
    """Decorator to require API key."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-KEY')
        expected_key = os.getenv('API_KEY', '')
        
        # SECURITY: Fail securely - require API key in production
        is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'
        
        if not expected_key:
            if is_production:
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
        import secrets
        if not secrets.compare_digest(api_key, expected_key):
            logger.warning("API key mismatch")
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


def require_auth(f):
    """Decorator to require user authentication (logged in user)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user_id is provided in the request
        data = None
        user_id = None
        
        # Only try to get JSON if it's not multipart
        if request.method in ['POST', 'PUT'] and request.content_type and 'application/json' in request.content_type:
            try:
                data = request.get_json(force=False, silent=True)
                if data:
                    user_id = data.get('user_id')
            except:
                pass
        
        # Also check query parameters (for file uploads and GET requests)
        if not user_id:
            user_id = request.args.get('user_id')
        
        logger.info(f"require_auth: user_id={user_id}, content_type={request.content_type}, endpoint={request.endpoint}")
        
        # Also check headers for token-based auth
        auth_header = request.headers.get('Authorization')
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Extract token after "Bearer "
        
        # Reject if no user_id and no token
        if not user_id and not token:
            logger.warning(f"Authentication required: No user_id or token provided - endpoint: {request.endpoint}")
            return jsonify({
                'error': 'User must be signed in to perform this action',
                'code': 'AUTHENTICATION_REQUIRED'
            }), 401
        
        # If user_id is 'default', reject (means not logged in)
        if user_id == 'default':
            logger.warning("Authentication required: Attempted with default user_id")
            return jsonify({
                'error': 'User must be signed in to perform this action',
                'code': 'NOT_AUTHENTICATED'
            }), 401
        
        # If token provided, verify it's valid (basic check)
        if token and not user_id:
            # For now, just accept any token (can be enhanced with JWT verification)
            logger.debug(f"Token-based auth attempted: {token[:20]}...")
        
        logger.info(f"Authentication successful for user: {user_id}")
        return f(*args, **kwargs)
    
    return decorated_function


def _resolve_user(identifier: Optional[str]):
    if not identifier:
        return None, None
    user = mongo_client.find_user(identifier)
    if not user:
        return None, None
    email = user.get('email')
    if not email:
        return None, user
    return email, user


def _ensure_token_state(email: Optional[str]):
    if not email:
        return None
    mongo_client.ensure_user_token_document(email)
    mongo_client.maybe_reset_plan_tokens(email)
    return mongo_client.get_token_summary(email)


def _serialize_token_summary(summary: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if summary is None:
        return None
    payload = dict(summary)
    plan_id = payload.get('plan_id')
    plan = PLAN_CATALOG.get(plan_id, {})
    if isinstance(payload.get('last_token_reset'), datetime):
        payload['last_token_reset'] = payload['last_token_reset'].isoformat()
    if isinstance(payload.get('subscription'), dict):
        sub = payload['subscription']
        for key in ['activated_at', 'expires_at', 'current_period_end', 'current_period_start']:
            if isinstance(sub.get(key), datetime):
                sub[key] = sub[key].isoformat()
    if payload.get('tokens_total') is None and plan.get('monthly_tokens') is None:
        payload['tokens_total'] = 'unlimited'
    if payload.get('tokens_balance') is None and plan.get('monthly_tokens') is None:
        payload['tokens_balance'] = 'unlimited'
    payload['plan_details'] = {
        'id': plan.get('id', plan_id),
        'name': plan.get('name', plan_id.title() if plan_id else None),
        'price_inr': plan.get('price_inr'),
        'monthly_tokens': plan.get('monthly_tokens'),
        'features': plan.get('features')
    }
    return payload


def _build_invoice_user_info(email: str, user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'email': email,
        'name': user.get('fullName') or user.get('username') or email,
        'company': user.get('company') or user.get('companyName'),
        'phone': user.get('phoneNumber') or user.get('phone')
    }


def _process_razorpay_payment(payment: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    payment_id = payment.get('id')
    order_id = payment.get('order_id')
    amount_paise = payment.get('amount') or 0
    amount_inr = float(amount_paise) / 100.0
    currency = payment.get('currency', 'INR')
    notes = payment.get('notes') or {}
    order_type = (notes.get('order_type') or 'plan').lower()
    user_identifier = notes.get('user_id') or notes.get('email')

    logger.info(
        "Processing Razorpay payment event",
        extra={'payment_id': payment_id, 'order_type': order_type, 'user_identifier': user_identifier}
    )

    email, user = _resolve_user(user_identifier)
    if user is None or not email:
        logger.error("Unable to resolve user for Razorpay payment", extra={'payment_id': payment_id})
        return {'status': 'failed', 'reason': 'user_not_found', 'payment_id': payment_id}

    if mongo_client.has_token_transaction_for_payment(payment_id):
        logger.info("Payment already processed, skipping duplicate ledger entry", extra={'payment_id': payment_id})
        return {'status': 'duplicate', 'payment_id': payment_id}

    _ensure_token_state(email)

    metadata = {
        'razorpay_payment_id': payment_id,
        'razorpay_order_id': order_id,
        'notes': notes,
        'event': event.get('event')
    }

    purchase_summary = {
        'type': 'Plan Subscription' if order_type != 'addon' else 'Add-on Tokens',
        'tokens': None,
        'name': None,
        'details': None
    }

    tokens_granted: Optional[Any] = None
    try:
        if order_type == 'addon':
            tokens_requested = int(notes.get('tokens_requested') or 0)
            if tokens_requested <= 0:
                logger.error("Invalid token quantity in Razorpay notes", extra={'payment_id': payment_id})
                return {'status': 'failed', 'reason': 'invalid_tokens', 'payment_id': payment_id}
            mongo_client.credit_tokens(email, tokens_requested, 'addon_purchase', {**metadata, 'source': 'razorpay'})
            tokens_granted = tokens_requested
            purchase_summary.update({
                'name': 'Token Top-up',
                'tokens': tokens_requested,
                'details': f"Add-on tokens purchased: {tokens_requested}"
            })
        else:
            plan_id = notes.get('plan_id') or notes.get('plan')
            if not plan_id:
                logger.error("Plan ID missing in Razorpay notes", extra={'payment_id': payment_id})
                return {'status': 'failed', 'reason': 'plan_missing', 'payment_id': payment_id}
            plan = PLAN_CATALOG.get(plan_id)
            if not plan:
                logger.error("Unknown plan in Razorpay notes", extra={'payment_id': payment_id, 'plan_id': plan_id})
                return {'status': 'failed', 'reason': 'plan_invalid', 'payment_id': payment_id}
            mongo_client.ensure_user_token_document(email)
            mongo_client.assign_plan(email, plan_id, {**metadata, 'source': 'razorpay'})
            tokens_granted = plan.get('monthly_tokens', 'unlimited')
            purchase_summary.update({
                'name': plan.get('name', plan_id.title()),
                'tokens': tokens_granted,
                'details': f"Plan upgraded to {plan.get('name', plan_id)}"
            })
    except Exception as exc:
        logger.error("Error applying Razorpay payment", exc_info=True, extra={'payment_id': payment_id})
        return {'status': 'failed', 'reason': 'processing_error', 'payment_id': payment_id, 'error': str(exc)}

    invoice_payload = {
        'transaction_id': payment_id,
        'order_id': order_id,
        'amount_inr': amount_inr,
        'currency': currency,
        'razorpay_payment_id': payment_id,
        'razorpay_order_id': order_id,
        'notes': notes,
        'timestamp': datetime.utcnow(),
        'user': _build_invoice_user_info(email, user),
        'purchase': purchase_summary
    }

    invoice_payload['metadata'] = {
        'purchase': purchase_summary,
        'notes': notes,
        'amount_inr': amount_inr,
        'currency': currency
    }

    file_path = None
    if invoice_service:
        try:
            file_path = invoice_service.generate(invoice_payload)
            invoice_payload['file_path'] = file_path
            invoice_payload['download_url'] = f"/api/invoice/{payment_id}"
        except Exception:
            logger.error("Failed to generate invoice PDF", exc_info=True, extra={'payment_id': payment_id})

    mongo_client.store_invoice_metadata(email, invoice_payload)

    logger.info("Razorpay payment processed successfully", extra={'payment_id': payment_id})
    return {
        'status': 'processed',
        'payment_id': payment_id,
        'order_type': order_type,
        'tokens_granted': tokens_granted,
        'invoice_path': file_path
    }


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    mongo_status = mongo_client.get_connection_status()
    return jsonify({
        'status': 'healthy',
        'timestamp': get_timestamp(),
        'mongodb': mongo_status
    })


@app.route('/api/user/tokens', methods=['GET'])
@require_api_key
@require_auth
def get_user_tokens():
    user_identifier = request.args.get('user_id') or request.args.get('email')
    email, user = _resolve_user(user_identifier)
    if user is None:
        logger.warning(f"Tokens requested for unknown user: {user_identifier}")
        return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
    if not email:
        return jsonify({'error': 'User record missing email address for billing', 'code': 'USER_EMAIL_MISSING'}), 422

    summary = _ensure_token_state(email)
    serialized = _serialize_token_summary(summary)
    return jsonify({
        'user_id': email,
        'tokens': serialized
    })


@app.route('/api/action/consume-token', methods=['POST'])
@require_api_key
@require_auth
def consume_token():
    data = request.get_json(force=True, silent=True) or {}
    user_identifier = data.get('user_id') or data.get('email')
    action = data.get('action')
    metadata = data.get('metadata') or {}

    if not action:
        return jsonify({'error': 'Action is required', 'code': 'ACTION_REQUIRED'}), 400
    action_cost = TOKEN_ACTION_COSTS.get(action)
    if action_cost is None:
        return jsonify({'error': f'Unsupported action: {action}', 'code': 'ACTION_UNSUPPORTED'}), 400

    email, user = _resolve_user(user_identifier)
    if user is None:
        return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
    if not email:
        return jsonify({'error': 'User record missing email address for billing', 'code': 'USER_EMAIL_MISSING'}), 422

    summary = _ensure_token_state(email)
    features = (summary or {}).get('features_enabled', {})
    if action in ('lock_json', 'unlock_json') and not features.get(action, False):
        return jsonify({'error': 'Feature not enabled for current plan', 'code': 'FEATURE_NOT_AVAILABLE'}), 403

    debit_result = mongo_client.debit_tokens(email, action_cost, action, metadata)
    if not debit_result.get('success'):
        error_code = debit_result.get('error', 'TOKEN_ERROR')
        status_code = 402 if error_code == 'INSUFFICIENT_TOKENS' else 400
        return jsonify({'error': error_code, 'code': error_code}), status_code

    updated_summary = _serialize_token_summary(mongo_client.get_token_summary(email))
    return jsonify({
        'success': True,
        'action': action,
        'tokens_consumed': action_cost,
        'unlimited': debit_result.get('unlimited', False),
        'tokens': updated_summary
    })


@app.route('/api/purchase/addons', methods=['POST'])
@require_api_key
@require_auth
def purchase_addons():
    data = request.get_json(force=True, silent=True) or {}
    user_identifier = data.get('user_id') or data.get('email')
    tokens_requested = int(data.get('tokens') or data.get('tokens_requested') or 0)
    simulate = bool(data.get('simulate'))

    if tokens_requested <= 0:
        return jsonify({'error': 'tokens must be greater than zero', 'code': 'INVALID_TOKEN_REQUEST'}), 400

    email, user = _resolve_user(user_identifier)
    if user is None:
        return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
    if not email:
        return jsonify({'error': 'User record missing email address for billing', 'code': 'USER_EMAIL_MISSING'}), 422

    amount_inr = tokens_requested * ADDON_TOKEN_PRICE_INR
    _ensure_token_state(email)

    if simulate:
        if not PAYMENT_SIMULATION_ENABLED:
            return jsonify({'error': 'Simulation disabled', 'code': 'SIMULATION_DISABLED'}), 403
        mongo_client.credit_tokens(email, tokens_requested, 'addon_purchase', {'mode': 'simulate'})
        updated_summary = _serialize_token_summary(mongo_client.get_token_summary(email))
        return jsonify({
            'status': 'credited',
            'tokens_added': tokens_requested,
            'amount_inr': amount_inr,
            'tokens': updated_summary,
            'simulate': True
        })

    if not razorpay_service or not razorpay_service.enabled:
        logger.error("Razorpay not configured for add-on purchase")
        return jsonify({
            'error': 'RAZORPAY_NOT_CONFIGURED',
            'message': 'Razorpay keys are not configured on the server. Enable simulation mode or configure keys.',
            'can_simulate': PAYMENT_SIMULATION_ENABLED
        }), 503

    notes = {
        'user_id': email,
        'order_type': 'addon',
        'tokens_requested': str(tokens_requested)
    }

    try:
        order_details = razorpay_service.create_order(
            amount_inr=amount_inr,
            receipt=f"addon_{email}_{int(time.time())}",
            notes=notes
        )
    except Exception as exc:
        logger.error("Failed to create Razorpay order for add-on purchase", exc_info=True)
        return jsonify({'error': 'RAZORPAY_ORDER_FAILED', 'message': str(exc)}), 502

    return jsonify({
        'status': 'pending_payment',
        'tokens_requested': tokens_requested,
        'amount_inr': amount_inr,
        'razorpay': {
            'order_id': order_details.order_id,
            'amount': order_details.amount,
            'currency': order_details.currency,
            'key': order_details.key,
            'notes': order_details.notes
        }
    }), 202


@app.route('/api/purchase/plan', methods=['POST'])
@require_api_key
@require_auth
def purchase_plan():
    data = request.get_json(force=True, silent=True) or {}
    user_identifier = data.get('user_id') or data.get('email')
    plan_id = data.get('plan_id')
    simulate = bool(data.get('simulate'))

    if not plan_id or plan_id not in PLAN_CATALOG:
        return jsonify({'error': 'Invalid plan_id', 'code': 'INVALID_PLAN'}), 400

    plan = PLAN_CATALOG[plan_id]
    email, user = _resolve_user(user_identifier)
    if user is None:
        return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
    if not email:
        return jsonify({'error': 'User record missing email address for billing', 'code': 'USER_EMAIL_MISSING'}), 422

    _ensure_token_state(email)

    if plan['price_inr'] == 0 or simulate:
        if simulate and not PAYMENT_SIMULATION_ENABLED:
            return jsonify({'error': 'Simulation disabled', 'code': 'SIMULATION_DISABLED'}), 403
        mongo_client.ensure_user_token_document(email)
        mongo_client.assign_plan(email, plan_id, {'mode': 'simulate' if simulate else 'plan_purchase'})
        updated_summary = _serialize_token_summary(mongo_client.get_token_summary(email))
        return jsonify({
            'status': 'activated',
            'plan_id': plan_id,
            'plan_name': plan['name'],
            'tokens': updated_summary,
            'simulate': simulate,
            'user': {
                'email': email,
                'features_enabled': updated_summary.get('features_enabled') if updated_summary else {}
            }
        })

    if not razorpay_service or not razorpay_service.enabled:
        logger.error("Razorpay not configured for plan purchase")
        return jsonify({
            'error': 'RAZORPAY_NOT_CONFIGURED',
            'message': 'Razorpay keys are not configured on the server. Enable simulation mode or configure keys.',
            'can_simulate': PAYMENT_SIMULATION_ENABLED
        }), 503

    amount_inr = plan['price_inr']
    notes = {
        'user_id': email,
        'plan_id': plan_id,
        'order_type': 'plan'
    }

    try:
        order_details = razorpay_service.create_order(
            amount_inr=amount_inr,
            receipt=f"plan_{plan_id}_{int(time.time())}",
            notes=notes
        )
    except Exception as exc:
        logger.error("Failed to create Razorpay order for plan purchase", exc_info=True)
        return jsonify({'error': 'RAZORPAY_ORDER_FAILED', 'message': str(exc)}), 502

    return jsonify({
        'status': 'pending_payment',
        'plan_id': plan_id,
        'plan_name': plan['name'],
        'razorpay': {
            'order_id': order_details.order_id,
            'amount': order_details.amount,
            'currency': order_details.currency,
            'key': order_details.key,
            'notes': order_details.notes
        },
        'message': 'Proceed with Razorpay checkout to complete the purchase'
    }), 202


@app.route('/api/invoice/<tx_id>', methods=['POST'])
@require_api_key
@require_auth
def get_invoice(tx_id):
    data = request.get_json(force=True, silent=True) or {}
    user_identifier = data.get('user_id') or data.get('email')
    download = bool(data.get('download')) or 'application/pdf' in (request.headers.get('Accept') or '')

    email, user = _resolve_user(user_identifier)
    if user is None:
        return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
    if not email:
        return jsonify({'error': 'User record missing email address for billing', 'code': 'USER_EMAIL_MISSING'}), 422

    invoice = mongo_client.get_invoice(email, tx_id)
    if not invoice:
        return jsonify({'error': 'Invoice not found', 'code': 'INVOICE_NOT_FOUND'}), 404

    file_path = invoice.get('file_path')
    if download and file_path:
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=f"PII-Sentinel-Invoice-{tx_id}.pdf")
        return jsonify({'error': 'Invoice file unavailable', 'code': 'INVOICE_FILE_MISSING'}), 410

    if isinstance(invoice.get('created_at'), datetime):
        invoice['created_at'] = invoice['created_at'].isoformat()
    if isinstance(invoice.get('updated_at'), datetime):
        invoice['updated_at'] = invoice['updated_at'].isoformat()

    return jsonify({
        'invoice': {
            'transaction_id': invoice.get('transaction_id'),
            'download_url': invoice.get('download_url'),
            'file_path': invoice.get('file_path'),
            'purchase': invoice.get('purchase'),
            'metadata': invoice.get('metadata', {}),
            'amount_inr': invoice.get('amount_inr'),
            'currency': invoice.get('currency'),
            'created_at': invoice.get('created_at'),
            'updated_at': invoice.get('updated_at')
        }
    })


@app.route('/api/razorpay/webhook', methods=['POST'])
def razorpay_webhook():
    if not razorpay_service or not razorpay_service.enabled:
        logger.warning("Razorpay webhook received but service not configured")
        return jsonify({'error': 'RAZORPAY_NOT_CONFIGURED'}), 503

    signature = request.headers.get('X-Razorpay-Signature')
    body = request.data

    try:
        event = razorpay_service.verify_webhook(body, signature)
    except RazorpaySignatureError as exc:
        logger.warning("Invalid Razorpay webhook signature", exc_info=True)
        return jsonify({'error': 'SIGNATURE_INVALID', 'message': str(exc)}), 400
    except RazorpayNotConfigured as exc:
        logger.error("Razorpay webhook processing failed: not configured", exc_info=True)
        return jsonify({'error': 'RAZORPAY_NOT_CONFIGURED', 'message': str(exc)}), 503
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Unexpected error verifying Razorpay webhook", exc_info=True)
        return jsonify({'error': 'WEBHOOK_PROCESSING_ERROR', 'message': str(exc)}), 500

    payment_entity = ((event.get('payload') or {}).get('payment') or {}).get('entity')
    if not payment_entity:
        logger.info("Razorpay webhook ignored: no payment entity present", extra={'event': event.get('event')})
        return jsonify({'status': 'ignored'}), 200

    result = _process_razorpay_payment(payment_entity, event)
    return jsonify({'result': result}), 200


@app.route('/api/create-batch', methods=['POST'])
@require_api_key
@require_auth
def create_batch():
    """Create a new batch (requires user to be signed in)."""
    try:
        data = request.get_json()
        name = data.get('name', f'Batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}')
        user_id = data.get('user_id')
        username = data.get('username')  # Get username from request if provided
        
        # At this point, user is authenticated (require_auth decorator checked this)
        logger.info(f"Authenticated batch creation request for user: {user_id}")
        
        # Verify user exists in database (if user_id is not 'default')
        if user_id != 'default':
            user_exists = False
            try:
                # Try to find user by email, username, or mobile
                user = mongo_client.get_user_by_email(user_id)
                if not user:
                    # Try username
                    user = mongo_client.get_user_by_username(user_id)
                if not user:
                    # Try mobile (normalize first)
                    mobile_normalized = ''.join(filter(str.isdigit, str(user_id)))
                    if len(mobile_normalized) == 10:
                        collection = mongo_client.db["User-Base"]
                        user = collection.find_one({
                            "$or": [
                                {"phoneNumber": mobile_normalized},
                                {"phoneNumber": f"+91{mobile_normalized}"},
                                {"phoneNumber": f"91{mobile_normalized}"}
                            ]
                        })
                
                if user:
                    user_exists = True
                    # Use email as the canonical user_id if available
                    if user.get('email'):
                        user_id = user.get('email')
                    elif user.get('username'):
                        user_id = user.get('username')
                    elif not username and user.get('fullName'):
                        username = user.get('fullName')
                    
                    logger.info(f"[CREATE BATCH] User verified - Email: {user.get('email')}, Username: {user.get('username')}, Using user_id: {user_id}")
                else:
                    logger.warning(f"[CREATE BATCH] User not found for user_id: {user_id}")
            except Exception as e:
                logger.error(f"[CREATE BATCH] Error verifying user: {e}")
        
        # OPTIMIZED: Check if batch name already exists (use direct query instead of loading all batches)
        try:
            collection = mongo_client.db["Batch-Base"]
            existing_batch = collection.find_one({
                "user_id": user_id,
                "name": {"$regex": f"^{name}$", "$options": "i"}
            }, {"_id": 1})
            
            if existing_batch:
                return jsonify({
                    'error': f'Batch name "{name}" already exists. Please choose a different name.'
                }), 400
        except Exception as e:
            logger.warning(f"Error checking duplicate batch names: {e}")
        
        batch_id = str(uuid.uuid4())
        batch_doc = mongo_client.create_batch(batch_id, name, user_id, username)
        
        logger.info(f"[CREATE BATCH] Created batch '{name}' (ID: {batch_id}) for user_id: {user_id}")
        
        # Invalidate cache so new batch appears immediately
        invalidate_batch_cache(user_id)
        
        return jsonify({
            'batch_id': batch_id,
            'name': name,
            'created_at': batch_doc.get('created_at', get_timestamp()),
            'message': 'Batch created successfully'
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating batch: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload-v2', methods=['POST', 'OPTIONS'])
def upload_files_v2():
    """New upload endpoint - simpler, bypass Werkzeug validation issues."""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        logger.info("=" * 80)
        logger.info("🚀 UPLOAD V2 ENDPOINT REACHED!")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Content-Length: {request.content_length}")
        logger.info("=" * 80)
        
        # Get parameters from query string
        batch_id = request.args.get('batch_id')
        user_id = request.args.get('user_id')
        api_key = request.headers.get('X-API-KEY')
        
        logger.info(f"   batch_id={batch_id}, user_id={user_id}, api_key_present={bool(api_key)}")
        
        # Validate auth
        expected_key = os.getenv('API_KEY', '')
        if expected_key and api_key != expected_key:
            return jsonify({'error': 'Invalid API key'}), 401
        
        if not user_id or user_id == 'default':
            return jsonify({'error': 'User not authenticated'}), 401
        
        if not batch_id:
            return jsonify({'error': 'batch_id required'}), 400
        
        # Check batch exists
        batch = mongo_client.get_batch(batch_id)
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        logger.info(f"   Batch found: {batch_id}")
        
        # Get files from request
        files = request.files.getlist('files[]') or request.files.getlist('files') or []
        
        logger.info(f"   Files received: {len(files)}")
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        # Process files
        job_id = str(uuid.uuid4())
        ensure_dir(app.config['UPLOAD_FOLDER'])
        
        # Get already processed files
        already_processed = set()
        if batch.get('files'):
            already_processed = {f.get('filename', '') for f in batch.get('files', [])}
        
        # Save and prepare files
        file_infos = []
        skipped_files = []
        for file in files:
            if not file or not file.filename:
                continue
            if not allowed_file(file.filename):
                continue
            
            filename = sanitize_filename(file.filename)
            if filename in already_processed:
                skipped_files.append(filename)
                continue
            
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{job_id}_{filename}")
            ensure_dir(os.path.dirname(filepath))
            file.save(filepath)
            
            file_infos.append({
                'filepath': filepath,
                'filename': filename,
                'batch_id': batch_id,
                'job_id': job_id,
                'file_type': os.path.splitext(filename)[1].lower()
            })
        
        if not file_infos:
            if skipped_files:
                return jsonify({
                    'error': 'All files already processed',
                    'skipped_count': len(skipped_files),
                    'skipped_files': skipped_files
                }), 400
            return jsonify({'error': 'No valid files'}), 400
        
        logger.info(f"   Files saved: {len(file_infos)}, job_id={job_id}")
        
        # Initialize job
        import time
        with _jobs_lock:
            jobs[job_id] = {
                'job_id': job_id,
                'batch_id': batch_id,
                'status': 'processing',
                'files': file_infos,
                'results': [],
                'created_at': get_timestamp(),
                'start_time': time.time(),
                'progress': {
                    'completed': 0,
                    'total': len(file_infos),
                    'current_file': None,
                    'eta_seconds': len(file_infos) * 5
                }
            }
        
        # Start processing in background
        def process_job():
            try:
                import time
                start_time = time.time()
                processor = get_processor()
                processing_times = []
                
                def progress_callback(completed, total, filename, eta=None):
                    """Update progress."""
                    with _jobs_lock:
                        if job_id in jobs:
                            jobs[job_id]['progress']['completed'] = completed
                            jobs[job_id]['progress']['total'] = total
                            jobs[job_id]['progress']['current_file'] = filename
                            if eta is not None:
                                jobs[job_id]['progress']['eta_seconds'] = eta
                            elif completed > 0 and total > completed:
                                elapsed = time.time() - start_time
                                avg_time = elapsed / completed
                                remaining = total - completed
                                jobs[job_id]['progress']['eta_seconds'] = max(1, int(avg_time * remaining * 1.1))
                            elif completed >= total:
                                jobs[job_id]['progress']['eta_seconds'] = 0
                
                # Process files
                results = processor.process_batch(file_infos, callback=progress_callback)
                
                logger.info(f"Processing complete: {len(results)} files processed")
                
                # Save results to MongoDB
                for result in results:
                    if result.get('success'):
                        filename = result.get('filename', '')
                        piis = result.get('piis', [])
                        pii_count = len(piis) if isinstance(piis, list) else 0
                        
                        # Log PII detection results
                        logger.info(f"💾 Saving file {filename} to batch {batch_id}: {pii_count} PIIs detected")
                        if pii_count > 0:
                            pii_types = list(set([p.get('type', 'UNKNOWN') for p in piis if isinstance(p, dict)]))
                            logger.info(f"  PII types: {pii_types}")
                            # Log sample PII structure
                            if len(piis) > 0 and isinstance(piis[0], dict):
                                logger.info(f"  Sample PII structure: {list(piis[0].keys())}")
                                logger.info(f"  Sample PII: type={piis[0].get('type')}, value={str(piis[0].get('value') or piis[0].get('match', ''))[:50]}")
                        else:
                            logger.warning(f"  ⚠️ No PIIs detected in {filename}")
                        
                        # Add file to batch
                        save_success = mongo_client.add_file_to_batch(
                            batch_id,
                            filename,
                            {
                                'pii_count': pii_count,
                                'page_count': result.get('page_count', 0),
                                'piis': piis
                            }
                        )
                        if save_success:
                            logger.info(f"  ✓ File {filename} saved to MongoDB successfully")
                        else:
                            logger.error(f"  ❌ Failed to save file {filename} to MongoDB!")
                
                # Update batch stats
                pii_results = {'files': results}
                mongo_client.update_batch_stats(batch_id, len(results), pii_results, scan_duration=0)
                
                # Update job status
                with _jobs_lock:
                    if job_id in jobs:
                        jobs[job_id]['status'] = 'completed'
                        jobs[job_id]['results'] = results
                        jobs[job_id]['completed_at'] = get_timestamp()
                
                logger.info(f"Job {job_id} completed with {len(results)} results")
            
            except Exception as e:
                logger.error(f"Job {job_id} error: {e}", exc_info=True)
                with _jobs_lock:
                    if job_id in jobs:
                        jobs[job_id]['status'] = 'failed'
                        jobs[job_id]['error'] = str(e)
        
        # Start in background thread
        threading.Thread(target=process_job, daemon=True).start()
        
        return jsonify({
            'job_id': job_id,
            'batch_id': batch_id,
            'file_count': len(file_infos),
            'skipped_count': len(skipped_files),
            'skipped_files': skipped_files,
            'status': 'processing'
        }), 202
    
    except Exception as e:
        logger.error(f"Upload V2 error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# Keep old upload endpoint for backwards compatibility, but make it simpler
@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_files():
    """Upload and process files - delegates to V2."""
    return upload_files_v2()


# ===== Old code removed - was causing issues =====
# See upload_files_v2() above for the current implementation
# ===== End removal =====


@app.route('/api/job-status', methods=['GET'])
@require_api_key
def get_job_status():
    """Get job processing status."""
    try:
        job_id = request.args.get('job_id')
        if not job_id:
            return jsonify({'error': 'job_id required'}), 400
        
        with _jobs_lock:
            if job_id not in jobs:
                return jsonify({'error': 'Job not found'}), 404
            
            job = jobs[job_id]
            return jsonify({
                'job_id': job_id,
                'status': job.get('status'),
                'progress': job.get('progress'),
                'results': job.get('results', []),
                'error': job.get('error')
            }), 200
    
    except Exception as e:
        logger.error(f"Error getting job status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ===== ORPHANED CODE REMOVED - WAS CAUSING SYNTAX ERRORS =====
# All the old upload code has been removed and replaced with upload_files_v2()
# ===== END REMOVAL =====


# Orphaned code removed - old upload logic replaced with upload_files_v2()


@app.route('/api/job-result', methods=['GET'])
@require_api_key
def get_job_result():
    """Get the status and results of a processing job."""
    try:
        job_id = request.args.get('job_id')
        if not job_id:
            return jsonify({'error': 'job_id is required'}), 400
        
        with _jobs_lock:
            job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Return a copy to prevent external modification
        return jsonify(job.copy()), 200
    
    except Exception as e:
        logger.error(f"Error getting job result: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/mask', methods=['POST'])
@require_api_key
def mask_files():
    """Apply masking to processed files."""
    try:
        data = request.get_json()
        job_id = data.get('job_id')
        batch_id = data.get('batch_id')  # Allow masking by batch_id for previous batches
        mask_type = data.get('mask_type', 'blur')  # 'hash' or 'blur'
        password = data.get('password') if mask_type == 'hash' else None
        
        if not job_id and not batch_id:
            return jsonify({'error': 'job_id or batch_id is required'}), 400
        
        if mask_type == 'hash' and not password:
            return jsonify({'error': 'password is required for hash masking'}), 400
        
        # Store encryption password in batch document if provided
        if mask_type == 'hash' and password and batch_id:
            try:
                batch = mongo_client.get_batch(batch_id)
                if batch and mongo_client.client is not None and mongo_client.db is not None:
                    collection = mongo_client.db.batches
                    collection.update_one(
                        {"batch_id": batch_id},
                        {"$set": {"encryption_password": password, "updated_at": datetime.utcnow()}}
                    )
                    logger.info(f"Stored encryption password for batch {batch_id}")
            except Exception as e:
                logger.warning(f"Failed to store encryption password: {e}")
        
        # Get results from job (if job_id provided) or from batch analysis (if batch_id provided)
        results = []
        if job_id:
            with _jobs_lock:
                job = jobs.get(job_id)
            if not job or job.get('status') != 'completed':
                return jsonify({'error': 'Job not found or not completed'}), 404
            batch_id = job.get('batch_id')
            results = job.get('results', [])
        elif batch_id:
            # Load results from MongoDB for this batch
            logger.info(f"Loading batch for masking: {batch_id}")
            batch = mongo_client.get_batch_analysis(batch_id)  # Use get_batch_analysis for proper serialization
            if not batch:
                logger.error(f"Batch not found: {batch_id}")
                return jsonify({'error': 'Batch not found'}), 404
            
            batch_files = batch.get('files', [])
            logger.info(f"📂 Loading batch data for masking: batch {batch_id} with {len(batch_files)} files")
            
            # Convert batch file entries to result format for masking
            for file_idx, file_entry in enumerate(batch_files):
                filename = file_entry.get('filename', '')
                piis = file_entry.get('piis', [])
                
                logger.info(f"  File {file_idx}: {filename}")
                logger.info(f"    PIIs type: {type(piis).__name__}, length: {len(piis) if isinstance(piis, list) else 'N/A'}")
                
                if filename:
                    # Ensure piis is a list
                    if not isinstance(piis, list):
                        logger.warning(f"    ⚠️ PIIs is not a list, attempting conversion...")
                        piis = list(piis) if hasattr(piis, '__iter__') else []
                    
                    pii_count = len(piis) if isinstance(piis, list) else 0
                    logger.info(f"    ✓ Added to queue: {pii_count} PIIs")
                    
                    # Create a result object from the batch file entry
                    result = {
                        'success': True,
                        'filename': filename,
                        'piis': piis if isinstance(piis, list) else [],
                        'pii_count': pii_count,
                        'page_count': file_entry.get('page_count', 0),
                        'text_length': 0  # Not available from batch
                    }
                    results.append(result)
            
            logger.info(f"✅ Prepared {len(results)} files from batch for masking")
        
        if not results:
            return jsonify({'error': 'No processed files found for masking'}), 404
        
        masked_files = []
        masked_results = []
        skipped_files = []
        
        logger.info(f"Starting masking process for {len(results)} files")
        
        for result in results:
            if not result.get('success'):
                logger.warning(f"Skipping {result.get('filename', 'unknown')}: result marked as unsuccessful")
                skipped_files.append(result.get('filename', 'unknown'))
                continue
            
            filename = result['filename']
            original_path = None
            
            # Find original file - try multiple locations
            if job_id and job:
                # From current job
                for file_info in job.get('files', []):
                    if file_info['filename'] == filename:
                        original_path = file_info['filepath']
                        logger.info(f"Found original file from job: {original_path}")
                        break
            
            # If not found, check if filepath is stored in result JSON (this is the most reliable)
            if not original_path or not os.path.exists(original_path):
                stored_path = result.get('filepath') or result.get('original_path')
                if stored_path:
                    # Handle both absolute and relative paths
                    if os.path.isabs(stored_path):
                        if os.path.exists(stored_path):
                            original_path = stored_path
                            logger.info(f"Found original file from result JSON (absolute): {original_path}")
                    else:
                        # Try relative to uploads folder
                        rel_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_path)
                        if os.path.exists(rel_path):
                            original_path = rel_path
                            logger.info(f"Found original file from result JSON (relative): {original_path}")
                        elif os.path.exists(stored_path):
                            original_path = stored_path
                            logger.info(f"Found original file from result JSON: {original_path}")
            
            # If still not found, search in uploads folder
            if not original_path or not os.path.exists(original_path):
                uploads_folder = app.config['UPLOAD_FOLDER']
                # Try exact filename match first
                exact_path = os.path.join(uploads_folder, filename)
                if os.path.exists(exact_path):
                    original_path = exact_path
                    logger.info(f"Found original file (exact match): {original_path}")
                else:
                    # Search for files ending with filename (job_id_prefix format)
                    if os.path.exists(uploads_folder):
                        matching_files = []
                        # Also search for files starting with batch_id or containing filename
                        for file in os.listdir(uploads_folder):
                            file_path = os.path.join(uploads_folder, file)
                            if not os.path.isfile(file_path):
                                continue
                            # Files are stored as: {job_id}_{filename} or just {filename}
                            # Check multiple patterns to find the file
                            if (file == filename or  # Exact match
                                file.endswith(f"_{filename}") or  # job_id_filename format
                                (filename in file and file.count('_') >= 1)):  # Contains filename with underscore separator
                                matching_files.append((file_path, file))
                        
                        # If multiple matches, prefer the most recent one or one that matches batch_id
                        if matching_files:
                            # Sort by modification time (most recent first)
                            matching_files.sort(key=lambda x: os.path.getmtime(x[0]), reverse=True)
                            original_path = matching_files[0][0]
                            logger.info(f"Found original file (pattern match from {len(matching_files)} candidates): {original_path}")
                        else:
                            # Fallback: if filename appears anywhere in the uploads folder
                            for file in os.listdir(uploads_folder):
                                file_path = os.path.join(uploads_folder, file)
                                if os.path.isfile(file_path) and filename in file:
                                    original_path = file_path
                                    logger.info(f"Found original file (fallback match): {original_path}")
                                    break
            
            if not original_path or not os.path.exists(original_path):
                logger.error(f"Original file not found: {filename}")
                logger.error(f"Searched in: {app.config['UPLOAD_FOLDER']}")
                logger.error(f"Result keys: {list(result.keys())}")
                skipped_files.append(filename)
                continue
            
            logger.info(f"Processing masking for file: {filename}")
            
            # Determine output path
            output_filename = f"masked_{filename}"
            output_path = os.path.join(
                app.config['MASKED_FOLDER'],
                batch_id,
                output_filename
            )
            ensure_dir(os.path.dirname(output_path))
            
            # Apply masking based on file type
            piis = result.get('piis', [])
            
            # Filter PIIs by selected types if provided
            selected_pii_types = data.get('selected_pii_types')
            if selected_pii_types and len(selected_pii_types) > 0:
                selected_set = set(selected_pii_types)
                piis = [pii for pii in piis if pii.get('type') in selected_set]
                logger.info(f"Filtered to {len(piis)} PIIs from selected types: {selected_pii_types}")
            
            if not piis:
                logger.warning(f"No PIIs to mask for {filename} (after filtering)")
                continue
            
            try:
                # Store hash_meta mapping for decryption
                hash_meta_map = {}
                
                # Mask the file and get hash_meta_map
                # For text/CSV files, hash_meta_map MUST come FROM masking (each encryption is unique)
                # For other files, we create it beforehand
                if is_pdf_file(filename):
                    if mask_type == 'hash' and password:
                        # Create mapping for PDF (before masking)
                        for pii in piis:
                            pii_value = pii.get('value', '')
                            if pii_value:
                                hash_result = masker.hash_mask(pii_value, password)
                                encrypted_value = hash_result['masked_value']
                                hash_meta_map[encrypted_value] = {
                                    'hash_meta': hash_result['hash_meta'],
                                    'original_value': pii_value,
                                    'pii_type': pii.get('type', ''),
                                    'page': pii.get('page', 0)
                                }
                    masker.mask_pdf(original_path, piis, output_path, mask_type, password)
                elif is_image_file(filename):
                    masker.mask_image(original_path, piis, output_path, mask_type)
                elif is_docx_file(filename):
                    if mask_type == 'hash' and password:
                        # Create mapping for DOCX (before masking)
                        for pii in piis:
                            pii_value = pii.get('value', '')
                            if pii_value:
                                hash_result = masker.hash_mask(pii_value, password)
                                encrypted_value = hash_result['masked_value']
                                hash_meta_map[encrypted_value] = {
                                    'hash_meta': hash_result['hash_meta'],
                                    'original_value': pii_value,
                                    'pii_type': pii.get('type', ''),
                                    'page': pii.get('page', 0)
                                }
                    masker.mask_docx(original_path, piis, output_path, mask_type, password)
                else:
                    # Text/CSV files: hash_meta_map comes FROM masking function
                    # CRITICAL: Don't create it beforehand - each hash_mask() call creates unique encrypted value
                    text_file_result = masker.mask_text_file(original_path, piis, output_path, mask_type, password)
                    if text_file_result and isinstance(text_file_result, dict):
                        # Use hash_meta_map from text file masking (created during masking)
                        if 'hash_meta_map' in text_file_result:
                            hash_meta_map = text_file_result['hash_meta_map']
                
                # Save hash_meta mapping to a separate JSON file for decryption
                if mask_type == 'hash' and password and hash_meta_map:
                    hash_meta_path = os.path.join(
                        app.config['RESULTS_FOLDER'],
                        batch_id,
                        f"{filename}_hash_meta.json"
                    )
                    ensure_dir(os.path.dirname(hash_meta_path))
                    save_json(hash_meta_map, hash_meta_path)
                    logger.info(f"Saved hash_meta mapping for {filename}")
                
                masked_files.append(output_path)
                masked_results.append({
                    'filename': filename,
                    'masked_filename': output_filename,
                    'original_filename': filename,
                    'path': output_path,
                    'mask_type': mask_type
                })
            
            except Exception as e:
                logger.error(f"Error masking {filename}: {e}")
                continue
        
        if not masked_files:
            error_msg = f'No files were masked. Processed {len(results)} files.'
            if skipped_files:
                error_msg += f' Skipped files: {", ".join(skipped_files)}'
            logger.error(error_msg)
            return jsonify({'error': error_msg}), 500
        
        logger.info(f"Successfully masked {len(masked_files)} files. Skipped: {len(skipped_files)} files")
        
        # If more than 10 files, create zip
        if len(masked_files) > 10:
            # Use batch_id for zip name if no job_id
            zip_name = f"masked_{job_id if job_id else batch_id}.zip"
            zip_path = os.path.join(
                app.config['MASKED_FOLDER'],
                batch_id,
                zip_name
            )
            create_zip(masked_files, zip_path)
            # Use relative path for download URL
            base_path = os.getenv('STORAGE_PATH', './data')
            rel_path = os.path.relpath(zip_path, base_path)
            return jsonify({
                'job_id': job_id or batch_id,
                'batch_id': batch_id,
                'mask_type': mask_type,
                'file_count': len(masked_files),
                'download_url': f'/api/download?path={rel_path}',
                'format': 'zip'
            }), 200
        else:
            # Return individual file URLs with relative paths and file info
            base_path = os.getenv('STORAGE_PATH', './data')
            download_urls = []
            file_info_list = []
            for masked_result in masked_results:
                rel_path = os.path.relpath(masked_result['path'], base_path)
                download_urls.append(f'/api/download?path={rel_path}')
                # Create descriptive filename for tooltip
                original_name = masked_result['original_filename']
                name_parts = os.path.splitext(original_name)
                mask_type_label = 'blurred' if mask_type == 'blur' else 'hashed'
                descriptive_name = f"{name_parts[0]}-masked-{mask_type_label}{name_parts[1]}"
                file_info_list.append({
                    'url': f'/api/download?path={rel_path}',
                    'original_filename': original_name,
                    'descriptive_name': descriptive_name,
                    'mask_type': mask_type
                })
            response_data = {
                'job_id': job_id or batch_id,
                'batch_id': batch_id,
                'mask_type': mask_type,
                'file_count': len(masked_files),
                'download_urls': download_urls,
                'file_info': file_info_list,  # Add file info for tooltips
                'format': 'individual'
            }
            logger.info(f"Returning masking response: {len(download_urls)} download URLs for {len(masked_files)} files")
            logger.info(f"Download URLs: {download_urls}")
            if skipped_files:
                logger.warning(f"Skipped files during masking: {skipped_files}")
                response_data['skipped_files'] = skipped_files
            return jsonify(response_data), 200
    
    except Exception as e:
        logger.error(f"Error masking files: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/decrypt-upload', methods=['POST'])
@require_api_key
def decrypt_uploaded_files():
    """Decrypt uploaded masked files and return decrypted PIIs."""
    try:
        if 'files[]' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        password = request.form.get('password')
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        files = request.files.getlist('files[]')
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        # Pre-load all hash_meta files for faster lookup (optimization)
        hash_meta_cache = {}
        results_base = app.config['RESULTS_FOLDER']
        
        if os.path.exists(results_base):
            for batch_folder in os.listdir(results_base):
                batch_path = os.path.join(results_base, batch_folder)
                if not os.path.isdir(batch_path):
                    continue
                
                meta_files = [f for f in os.listdir(batch_path) if f.endswith('_hash_meta.json')]
                for meta_file in meta_files:
                    meta_path = os.path.join(batch_path, meta_file)
                    try:
                        hash_meta_data = load_json(meta_path)
                        hash_meta_cache[meta_path] = hash_meta_data
                    except Exception as e:
                        logger.debug(f"Error loading hash_meta file {meta_file}: {e}")
        
        decrypted_results = []
        all_decrypted_piis = []
        
        for file in files:
            if file.filename == '':
                continue
            
            filename = secure_filename(file.filename)
            logger.info(f"Processing file for decryption: {filename}")
            
            # Save uploaded file temporarily
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{uuid.uuid4()}_{filename}")
            ensure_dir(os.path.dirname(temp_path))
            file.save(temp_path)
            
            try:
                # Extract text from file
                text = ""
                if is_pdf_file(filename):
                    import fitz
                    doc = fitz.open(temp_path)
                    for page in doc:
                        text += page.get_text()
                    doc.close()
                elif is_docx_file(filename):
                    from docx import Document
                    doc = Document(temp_path)
                    for para in doc.paragraphs:
                        text += para.text + "\n"
                    for table in doc.tables:
                        for row in table.rows:
                            for cell in row.cells:
                                text += cell.text + " "
                elif is_doc_file(filename):
                    # DOC files need special handling - convert to text using python-docx2txt or antiword
                    # For now, try to extract using textract or fallback to error message
                    try:
                        import docx2txt
                        text = docx2txt.process(temp_path)
                    except ImportError:
                        try:
                            # Try using textract if available
                            import textract
                            text = textract.process(temp_path).decode('utf-8')
                        except (ImportError, Exception):
                            logger.warning(f"DOC file support requires docx2txt or textract. Install: pip install docx2txt")
                            # Fallback: try reading as binary and extract readable text
                            with open(temp_path, 'rb') as f:
                                content = f.read()
                                # Simple extraction of readable ASCII text
                                text = ''.join(chr(b) if 32 <= b < 127 else ' ' for b in content)
                elif is_text_file(filename):
                    # Read CSV and text files directly as text to preserve exact encrypted values
                    # Don't use pandas for CSV during decryption - we need the raw encrypted strings
                    with open(temp_path, 'r', encoding='utf-8', errors='replace') as f:
                        text = f.read()
                elif is_image_file(filename):
                    # Use OCR to extract text from images
                    try:
                        from ocr_engine import get_ocr_engine
                        import cv2
                        import numpy as np
                        import io
                        ocr_engine = get_ocr_engine()
                        if filename.lower().endswith('.svg'):
                            # SVG needs special handling - extract text from SVG elements or convert to PNG
                            try:
                                from PIL import Image
                                try:
                                    import cairosvg
                                    png_data = cairosvg.svg2png(url=temp_path)
                                    image = Image.open(io.BytesIO(png_data))
                                    img_array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                                    extracted_text, _ = ocr_engine.extract_text(img_array)
                                    text = extracted_text
                                except ImportError:
                                    # Fallback: extract text from SVG XML
                                    logger.info("cairosvg not available, extracting text from SVG XML")
                                    with open(temp_path, 'r', encoding='utf-8', errors='replace') as f:
                                        svg_content = f.read()
                                    # Extract text from SVG text elements
                                    import re
                                    text_elements = re.findall(r'<text[^>]*>(.*?)</text>', svg_content, re.DOTALL)
                                    text = ' '.join(text_elements)
                                    if not text:
                                        logger.warning(f"No text found in SVG: {filename}")
                                        os.remove(temp_path)
                                        continue
                            except Exception as e:
                                logger.warning(f"Error processing SVG {filename}: {e}")
                                os.remove(temp_path)
                                continue
                        else:
                            img_array = cv2.imread(temp_path)
                            if img_array is not None:
                                extracted_text, _ = ocr_engine.extract_text(img_array)
                                text = extracted_text
                            else:
                                logger.warning(f"Could not read image file: {filename}")
                                os.remove(temp_path)
                                continue
                        
                        if not text:
                            logger.warning(f"No text extracted from image: {filename}")
                            os.remove(temp_path)
                            continue
                    except Exception as e:
                        logger.error(f"Error extracting text from image {filename}: {e}")
                        os.remove(temp_path)
                        continue
                else:
                    logger.warning(f"Unsupported file type for decryption: {filename}")
                    os.remove(temp_path)
                    continue
                
                # NEW APPROACH: Decrypt entire file first, then detect PIIs
                import re
                import base64
                
                # Step 1: Find all potential encrypted values (base64 strings)
                base64_pattern = r'[A-Za-z0-9+/]{16,300}={0,2}'
                all_matches = re.findall(base64_pattern, text)
                potential_encrypted = list(set([m for m in all_matches if len(m) >= 16]))
                
                # Also find base64 strings with delimiters (for CSV)
                base64_with_delimiters = re.findall(r'(?:^|[\s,\t\n\r"\'|])[A-Za-z0-9+/]{16,300}={0,2}(?:[\s,\t\n\r"\'|]|$)', text)
                for match in base64_with_delimiters:
                    cleaned = re.sub(r'^[\s,\t\n\r"\'|]+|[\s,\t\n\r"\'|]+$', '', match)
                    if len(cleaned) >= 16 and cleaned not in potential_encrypted:
                        potential_encrypted.append(cleaned)
                
                logger.info(f"Found {len(potential_encrypted)} potential encrypted values in {filename}")
                
                if not potential_encrypted:
                    logger.debug(f"No potential encrypted values found in {filename}")
                    os.remove(temp_path)
                    continue
                
                # Step 2: Decrypt all encrypted values and replace them in text
                decrypted_text = text
                decryption_map = {}  # Map encrypted -> decrypted for tracking
                successful_decryptions = 0
                failed_decryptions = []
                
                logger.info(f"Attempting to decrypt {len(potential_encrypted)} encrypted values from {filename}")
                logger.info(f"Hash_meta cache contains {len(hash_meta_cache)} files")
                
                for encrypted_val in potential_encrypted:
                    if encrypted_val in decryption_map:
                        continue  # Already processed
                    
                    # Try to decrypt using hash_meta from cache
                    decrypted_value = None
                    found_in_cache = False
                    
                    for hash_meta_data in hash_meta_cache.values():
                        if encrypted_val in hash_meta_data:
                            found_in_cache = True
                            meta_info = hash_meta_data[encrypted_val]
                            try:
                                decrypted_value = masker.decrypt_hash(
                                    encrypted_val,
                                    meta_info['hash_meta'],
                                    password
                                )
                                decryption_map[encrypted_val] = decrypted_value
                                successful_decryptions += 1
                                logger.debug(f"Decrypted: {encrypted_val[:20]}... -> {decrypted_value[:20]}...")
                                break
                            except Exception as e:
                                logger.debug(f"Decryption failed for {encrypted_val[:20]}...: {e}")
                                continue
                    
                    if not found_in_cache:
                        failed_decryptions.append(encrypted_val[:30])
                    
                    # Replace encrypted value with decrypted value in text
                    if decrypted_value:
                        # Replace all occurrences of this encrypted value
                        decrypted_text = decrypted_text.replace(encrypted_val, decrypted_value)
                
                logger.info(f"Successfully decrypted {successful_decryptions}/{len(potential_encrypted)} values in {filename}")
                if failed_decryptions:
                    logger.warning(f"Failed to find hash_meta for {len(failed_decryptions)} encrypted values (sample: {failed_decryptions[:3]})")
                
                if successful_decryptions == 0:
                    logger.warning(f"No values could be decrypted from {filename} - wrong password or missing hash_meta")
                    logger.warning(f"Hash_meta cache keys: {list(hash_meta_cache.keys())[:3] if hash_meta_cache else 'Empty'}")
                    os.remove(temp_path)
                    continue
                
                # Log sample of decrypted text for debugging
                logger.debug(f"Sample decrypted text (first 500 chars): {decrypted_text[:500]}")
                
                # Step 3: Detect PIIs from the fully decrypted text
                from pii_detector_advanced import ContextAwarePIIDetector
                pii_detector = ContextAwarePIIDetector()
                
                # Detect PIIs in decrypted text using scan_text_advanced
                detected_piis = pii_detector.scan_text_advanced(decrypted_text)
                
                logger.info(f"Detected {len(detected_piis)} PIIs in decrypted text from {filename}")
                
                # Log detected PII types for debugging
                pii_types_found = {}
                for pii in detected_piis:
                    pii_type = pii.get('type', 'UNKNOWN')
                    pii_types_found[pii_type] = pii_types_found.get(pii_type, 0) + 1
                logger.info(f"PII types detected: {pii_types_found}")
                
                # Format PIIs for response
                decrypted_file_piis = []
                for pii in detected_piis:
                    # Use 'match' or 'value' field from detector
                    pii_value = pii.get('match') or pii.get('value', '')
                    if not pii_value:
                        continue  # Skip if no value
                    
                    decrypted_file_piis.append({
                        'type': pii.get('type', 'UNKNOWN'),
                        'value': pii_value,
                        'file': filename,
                        'page': 0,  # Text files don't have pages
                        'confidence': pii.get('confidence', 0.5)
                    })
                
                if decrypted_file_piis:
                    decrypted_results.append({
                        'filename': filename,
                        'piis': decrypted_file_piis,
                        'pii_count': len(decrypted_file_piis)
                    })
                    all_decrypted_piis.extend(decrypted_file_piis)
                
            except Exception as e:
                logger.error(f"Error processing {filename} for decryption: {e}", exc_info=True)
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        
        if not decrypted_results:
            return jsonify({'error': 'No encrypted PIIs found or incorrect password'}), 404
        
        # Group PIIs by type
        pii_types = {}
        for pii in all_decrypted_piis:
            pii_type = pii.get('type', 'UNKNOWN')
            if pii_type not in pii_types:
                pii_types[pii_type] = []
            pii_types[pii_type].append(pii)
        
            logger.info(f"Decryption successful: {len(all_decrypted_piis)} total PIIs decrypted from {len(decrypted_results)} files")
            return jsonify({
                'success': True,
                'files': decrypted_results,
                'pii_types': pii_types,
                'total_piis': len(all_decrypted_piis)
            }), 200
    
    except Exception as e:
        logger.error(f"Error in decrypt-upload: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/batch/<batch_id>/analysis', methods=['GET'])
@require_api_key
def get_batch_analysis(batch_id: str):
    """Get analysis data for a single batch."""
    try:
        analysis = mongo_client.get_batch_analysis(batch_id)
        if not analysis:
            return jsonify({'error': 'Batch not found'}), 404
        return jsonify(analysis), 200
    except Exception as e:
        logger.error(f"Error getting batch analysis: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/debug/batch/<batch_id>/json-files', methods=['GET'])
@require_api_key
def debug_batch_json_files(batch_id: str):
    """Debug endpoint to check JSON files for a batch."""
    try:
        import os
        storage_path = os.getenv('STORAGE_PATH', './data')
        results_folder = os.path.join(storage_path, 'results', batch_id)
        
        debug_info = {
            'batch_id': batch_id,
            'results_folder': results_folder,
            'folder_exists': os.path.exists(results_folder),
            'json_files': []
        }
        
        if os.path.exists(results_folder):
            json_files = [f for f in os.listdir(results_folder) if f.endswith('.json')]
            debug_info['json_file_count'] = len(json_files)
            
            for json_file in json_files:
                json_path = os.path.join(results_folder, json_file)
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        file_data = json.load(f)
                        piis = file_data.get('piis', [])
                        pii_count = file_data.get('pii_count', len(piis) if isinstance(piis, list) else 0)
                        
                        debug_info['json_files'].append({
                            'filename': json_file,
                            'pii_count': pii_count,
                            'piis_length': len(piis) if isinstance(piis, list) else 0,
                            'has_piis': len(piis) > 0 if isinstance(piis, list) else False,
                            'sample_piis': piis[:3] if isinstance(piis, list) and len(piis) > 0 else []
                        })
                except Exception as e:
                    debug_info['json_files'].append({
                        'filename': json_file,
                        'error': str(e)
                    })
        else:
            debug_info['error'] = f'Results folder does not exist: {results_folder}'
        
        return jsonify(debug_info), 200
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/batches', methods=['GET'])
@require_api_key
def list_batches():
    """List batches - ULTRA-FAST with async processing (< 500ms)."""
    try:
        user_id = request.args.get('user_id', 'default')
        limit = int(request.args.get('limit', 100))
        
        # SPEED OPTIMIZATION 1: Check cache first (INSTANT < 10ms!)
        cached_batches = get_cached_batches(user_id)
        if cached_batches is not None:
            logger.debug(f"Cache HIT for user {user_id} - instant return!")
            return jsonify({'batches': cached_batches, 'from_cache': True}), 200
        
        # SPEED OPTIMIZATION 2: Async fetch in background thread
        # Return immediately with partial data, fetch full data in background
        start_time = time.time()
        
        # Try to get batches within 500ms timeout
        batches = []
        def fetch_batches():
            nonlocal batches
        batches = mongo_client.list_batches(user_id, limit)
        
        fetch_thread = threading.Thread(target=fetch_batches, daemon=True)
        fetch_thread.start()
        fetch_thread.join(timeout=0.5)  # Wait max 500ms
        
        if not batches:
            # If DB is slow, return empty but cached result
            logger.warning(f"DB timeout for user {user_id} - returning empty list")
            optimized_batches = []
        else:
            # ULTRA-OPTIMIZATION: Minimal payload - only essential data
            optimized_batches = []
            for batch in batches[:20]:  # Process first 20 batches only
                optimized_batch = {
                    'batch_id': batch.get('batch_id'),
                    'name': batch.get('name'),
                    'created_at': batch.get('created_at'),
                    'updated_at': batch.get('updated_at'),
                    'status': batch.get('status', 'pending'),
                    'stats': batch.get('stats', {})
                }
                
                # Minimal files data - NO PIIs (load on demand)
                if 'files' in batch:
                    optimized_batch['files'] = [
                        {
                            'filename': f.get('filename'),
                            'status': f.get('status', 'pending'),
                            'pii_count': f.get('pii_count', 0),
                            'total_piis': f.get('pii_count', 0)
                        }
                        for f in batch.get('files', [])[:5]  # Only first 5 files (lazy!)
                    ]
                
                optimized_batches.append(optimized_batch)
        
        # Cache the result for INSTANT subsequent requests
        set_cached_batches(user_id, optimized_batches)
        
        elapsed = time.time() - start_time
        logger.info(f"✅ Batches loaded in {elapsed*1000:.0f}ms - {len(optimized_batches)} batches")
        return jsonify({'batches': optimized_batches, 'load_time_ms': int(elapsed*1000)}), 200
    
    except Exception as e:
        logger.error(f"Error listing batches: {e}")
        return jsonify({'error': str(e), 'batches': []}), 200  # Return empty list on error


@app.route('/api/batch/<batch_id>/piis-for-file', methods=['GET'])
@require_api_key
def get_file_piis(batch_id: str):
    """Get PII data for a specific file (lazy loading on-demand)."""
    try:
        filename = request.args.get('filename')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        if not filename:
            return jsonify({'error': 'filename parameter required'}), 400
        
        # Get batch analysis
        analysis = mongo_client.get_batch_analysis(batch_id)
        if not analysis:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Find the file in the batch
        file_data = None
        for f in analysis.get('files', []):
            if f.get('filename') == filename:
                file_data = f
                break
        
        if not file_data:
            return jsonify({'error': 'File not found in batch'}), 404
        
        # Get PIIs with pagination
        all_piis = file_data.get('piis', [])
        total_piis = len(all_piis)
        
        # Calculate pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_piis = all_piis[start_idx:end_idx]
        
        return jsonify({
            'filename': filename,
            'piis': paginated_piis,
            'total': total_piis,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_piis + per_page - 1) // per_page
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting file PIIs: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/batch/<batch_id>', methods=['DELETE'])
@require_api_key
def delete_batch(batch_id: str):
    """Delete a batch and all its data."""
    try:
        batch = mongo_client.get_batch(batch_id)
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Delete from MongoDB
        deleted = mongo_client.delete_batch(batch_id)
        if not deleted:
            return jsonify({'error': 'Failed to delete batch from database'}), 500
        
        # Delete files from filesystem
        import shutil
        batch_folders = [
            os.path.join(app.config['RESULTS_FOLDER'], batch_id),
            os.path.join(app.config['MASKED_FOLDER'], batch_id),
            os.path.join(app.config['UPLOAD_FOLDER'])  # Will search for files with batch_id
        ]
        
        deleted_files = []
        for folder in batch_folders:
            if os.path.exists(folder):
                try:
                    if os.path.isdir(folder):
                        shutil.rmtree(folder)
                        deleted_files.append(folder)
                    else:
                        os.remove(folder)
                        deleted_files.append(folder)
                except Exception as e:
                    logger.warning(f"Error deleting {folder}: {e}")
        
        # Also delete upload files that match this batch
        uploads_folder = app.config['UPLOAD_FOLDER']
        if os.path.exists(uploads_folder):
            for file in os.listdir(uploads_folder):
                # Files are named with job_id, so we'll delete by checking batch association
                # This is a simplified approach
                pass
        
        logger.info(f"Deleted batch {batch_id} and {len(deleted_files)} folders")
        
        # Invalidate cache for all users since batch is deleted
        # (We'll invalidate 'default' cache which is most common)
        invalidate_batch_cache('default')
        
        return jsonify({
            'message': 'Batch deleted successfully',
            'batch_id': batch_id,
            'deleted_folders': len(deleted_files)
        }), 200
    
    except Exception as e:
        logger.error(f"Error deleting batch: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/download', methods=['GET'])
@require_api_key
def download_file():
    """Download a file."""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'path parameter required'}), 400
        
        # Security: ensure path is within allowed directories
        # Normalize paths for comparison
        base_path = os.path.abspath(os.getenv('STORAGE_PATH', './data'))
        allowed_dirs = [
            os.path.abspath(app.config['MASKED_FOLDER']),
            os.path.abspath(app.config['RESULTS_FOLDER']),
            base_path
        ]
        
        # Resolve the requested path
        if not os.path.isabs(file_path):
            # Relative path - resolve it
            file_path = os.path.join(base_path, file_path.lstrip('./'))
        
        file_path = os.path.abspath(file_path)
        
        # Check if path is within allowed directories
        is_allowed = False
        for allowed_dir in allowed_dirs:
            if file_path.startswith(os.path.abspath(allowed_dir)):
                is_allowed = True
                break
        
        if not is_allowed:
            logger.warning(f"Invalid file path attempted: {file_path}")
            return jsonify({'error': 'Invalid file path'}), 403
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True)
    
    except Exception as e:
        logger.error(f"Error downloading file: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/debug/batch/<batch_id>/test-export', methods=['POST'])
@require_api_key
def test_export_debug(batch_id: str):
    """
    DEBUG endpoint - simulates export to show exactly what's happening.
    Helps diagnose why PIIs are 0 in export.
    """
    try:
        logger.info(f"\n{'='*80}")
        logger.info(f"🔍 DEBUG TEST EXPORT for batch: {batch_id}")
        logger.info(f"{'='*80}")
        
        # Fetch batch
        batch = mongo_client.get_batch_analysis(batch_id)
        if not batch:
            logger.error(f"❌ Batch not found")
            return jsonify({'error': 'Batch not found'}), 404
        
        logger.info(f"✓ Batch found: {batch.get('name')}")
        logger.info(f"✓ Batch keys: {list(batch.keys())}")
        logger.info(f"✓ Batch stats: {batch.get('stats')}")
        
        files = batch.get('files', [])
        logger.info(f"✓ Files in batch: {len(files)}")
        
        # Simulate PII extraction
        total_extracted = 0
        for file_idx, file_data in enumerate(files):
            filename = file_data.get('filename', f'file_{file_idx}')
            file_piis = file_data.get('piis', [])
            pii_count_in_db = file_data.get('pii_count', 0)
            
            logger.info(f"\n  📄 File {file_idx}: {filename}")
            logger.info(f"     pii_count field: {pii_count_in_db}")
            logger.info(f"     piis array length: {len(file_piis) if isinstance(file_piis, list) else 'N/A'}")
            logger.info(f"     piis type: {type(file_piis).__name__}")
            logger.info(f"     piis is list: {isinstance(file_piis, list)}")
            
            if isinstance(file_piis, list):
                total_extracted += len(file_piis)
                
                # Sample first PII
                if len(file_piis) > 0:
                    sample = file_piis[0]
                    logger.info(f"     Sample PII[0] type: {type(sample).__name__}")
                    if isinstance(sample, dict):
                        logger.info(f"     Sample PII keys: {list(sample.keys())}")
                        logger.info(f"     Sample PII value: {str(sample.get('value', sample.get('match', '')))[:100]}")
                    else:
                        logger.info(f"     WARNING: Sample PII is not dict! Content: {str(sample)[:100]}")
        
        logger.info(f"\n✓ Total PIIs extracted: {total_extracted}")
        logger.info(f"{'='*80}\n")
        
        return jsonify({
            'batch_id': batch_id,
            'file_count': len(files),
            'total_piis_extracted': total_extracted,
            'debug_summary': f'Found {total_extracted} PIIs across {len(files)} files'
        }), 200
    
    except Exception as e:
        logger.error(f"❌ Debug error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/debug/batch/<batch_id>/raw', methods=['GET'])
@require_api_key
def debug_batch_raw(batch_id: str):
    """Debug endpoint to inspect raw batch data from MongoDB."""
    try:
        batch = mongo_client.get_batch_analysis(batch_id)
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Analyze the batch structure
        debug_info = {
            'batch_id': batch.get('batch_id'),
            'batch_name': batch.get('name'),
            'file_count': len(batch.get('files', [])),
            'files': []
        }
        
        for idx, file_data in enumerate(batch.get('files', [])):
            piis = file_data.get('piis', [])
            file_info = {
                'index': idx,
                'filename': file_data.get('filename'),
                'pii_count_in_db': file_data.get('pii_count', 0),
                'piis_array_length': len(piis) if isinstance(piis, list) else 0,
                'piis_is_list': isinstance(piis, list),
                'piis_type': type(piis).__name__,
                'sample_piis': []
            }
            
            # Sample first 3 PIIs
            if isinstance(piis, list) and len(piis) > 0:
                for pii_idx, pii in enumerate(piis[:3]):
                    if isinstance(pii, dict):
                        file_info['sample_piis'].append({
                            'index': pii_idx,
                            'type': pii.get('type'),
                            'keys': list(pii.keys()),
                            'has_value': 'value' in pii,
                            'has_match': 'match' in pii,
                            'has_normalized': 'normalized' in pii,
                            'has_text': 'text' in pii,
                            'value_preview': str(pii.get('value', pii.get('match', pii.get('normalized', pii.get('text', '')))))[:100]
                        })
                    else:
                        file_info['sample_piis'].append({
                            'index': pii_idx,
                            'type': type(pii).__name__,
                            'error': 'PII is not a dict'
                        })
            
            debug_info['files'].append(file_info)
        
        return jsonify(debug_info), 200
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/export-pii-json', methods=['POST'])
@require_api_key
def export_pii_json():
    """
    BULLETPROOF PII Export with SHA-512 Encryption.
    """
    start_time = time.time()
    
    try:
        # STEP 1: Parse request
        logger.info(f"\n{'='*80}")
        logger.info(f"🔄 EXPORT: Received request")
        logger.info(f"   Content-Type: {request.content_type}")
        
        try:
            data = request.get_json(force=True, silent=False)
        except Exception as json_err:
            logger.error(f"❌ JSON parse error: {json_err}")
            logger.error(f"   Raw body: {request.get_data()}")
            return jsonify({'error': f'Invalid JSON: {str(json_err)}'}), 400
        
        if not data:
            logger.error(f"❌ Empty JSON data")
            return jsonify({'error': 'Empty request body'}), 400
        
        batch_id = data.get('batch_id', '')
        selected_pii_types = data.get('selected_pii_types', []) or []
        password = data.get('password', '')
        lock_file = bool(data.get('lock_file', False))
        
        logger.info(f"✓ Request parsed:")
        logger.info(f"   batch_id: {batch_id} (type: {type(batch_id).__name__}, len: {len(batch_id) if isinstance(batch_id, str) else 'N/A'})")
        logger.info(f"   lock_file: {lock_file}")
        logger.info(f"   password: {'***' if password else 'none'}")
        logger.info(f"   selected_pii_types: {selected_pii_types} (len: {len(selected_pii_types)})")
        
        # STEP 2: Validate inputs
        if not batch_id or not isinstance(batch_id, str):
            logger.error(f"❌ Invalid batch_id: {batch_id}")
            return jsonify({'error': 'batch_id is required and must be a string'}), 400
        
        if lock_file and not password:
            logger.error(f"❌ Password required when lock_file=true")
            return jsonify({'error': 'password is required when locking file'}), 400
        
        logger.info(f"{'='*80}")
        logger.info(f"🔄 STEP 1: Fetching batch from MongoDB...")
        
        # Fetch batch
        try:
            batch = mongo_client.get_batch_analysis(batch_id)
        except Exception as fetch_err:
            logger.error(f"❌ Error fetching batch: {fetch_err}", exc_info=True)
            return jsonify({'error': f'Database error: {str(fetch_err)}'}), 500
        
        if not batch:
            logger.error(f"❌ Batch not found: {batch_id}")
            return jsonify({'error': 'Batch not found'}), 404
        
        batch_name = batch.get('name', 'unknown')
        files = batch.get('files', [])
        logger.info(f"✓ Batch: {batch_name} | Files: {len(files)}")
        
        if not files:
            logger.error(f"❌ Batch has no files")
            return jsonify({'error': 'Batch has no files'}), 400
        
        logger.info(f"🔄 STEP 2: Extracting PIIs...")
        
        # Extract PIIs - SIMPLE AND ROBUST
        all_piis_dict = {}  # {TYPE: [values]}
        file_summary = []
        total_piis = 0
        
        logger.info(f"Processing {len(files)} files from batch...")
        
        for file_idx, file_data in enumerate(files):
            filename = file_data.get('filename', 'unknown')
            piis_list = file_data.get('piis', [])
            
            logger.info(f"  File {file_idx}: {filename}")
            logger.info(f"    piis_list type: {type(piis_list).__name__}")
            logger.info(f"    piis_list length: {len(piis_list) if isinstance(piis_list, list) else 'NOT A LIST'}")
            
            if not isinstance(piis_list, list):
                logger.warning(f"    ⚠️  Skipping: piis not a list (type: {type(piis_list)})")
                continue
            
            if len(piis_list) == 0:
                logger.warning(f"    ⚠️  Empty PIIs array")
                continue
            
            file_piis = 0
            for pii_idx, pii in enumerate(piis_list):
                if not isinstance(pii, dict):
                    logger.warning(f"    PII {pii_idx}: not a dict, type={type(pii).__name__}")
                    continue
                
                pii_type = str(pii.get('type', 'UNKNOWN')).upper()
                pii_value = pii.get('value') or pii.get('match') or pii.get('normalized') or pii.get('text') or ''
                
                if isinstance(pii_value, str):
                    pii_value = pii_value.strip()
                else:
                    pii_value = str(pii_value).strip() if pii_value else ''
                
                if not pii_value:
                    logger.debug(f"    PII {pii_idx}: empty value, keys={list(pii.keys())}")
                    continue
                
                # Check type filter
                if selected_pii_types:
                    if pii_type not in [t.upper() for t in selected_pii_types]:
                        continue
                
                # Add to dict
                if pii_type not in all_piis_dict:
                    all_piis_dict[pii_type] = []
                
                if pii_value not in all_piis_dict[pii_type]:
                    all_piis_dict[pii_type].append(pii_value)
                    file_piis += 1
                    total_piis += 1
                
                # Log first few
                if pii_idx < 3:
                    logger.debug(f"    PII {pii_idx}: type={pii_type}, value={pii_value[:30]}")
            
            logger.info(f"    ✓ Extracted {file_piis} from {filename}")
            
            if file_piis > 0:
                file_summary.append({'filename': filename, 'pii_count': file_piis})
        
        logger.info(f"Total extracted: {total_piis} PIIs across {len(all_piis_dict)} types")
        
        if total_piis == 0:
            logger.error(f"❌ NO PIIs extracted!")
            logger.error(f"   Files in batch: {len(files)}")
            if files:
                logger.error(f"   First file keys: {list(files[0].keys())}")
                first_piis = files[0].get('piis', [])
                logger.error(f"   First file 'piis' field: type={type(first_piis).__name__}, len={len(first_piis) if isinstance(first_piis, list) else '?'}")
                if isinstance(first_piis, list) and len(first_piis) > 0:
                    logger.error(f"   Sample PII structure: {list(first_piis[0].keys()) if isinstance(first_piis[0], dict) else 'not dict'}")
                    logger.error(f"   Sample PII full: {first_piis[0]}")
            return jsonify({'error': 'No PIIs found in batch'}), 400
        
        logger.info(f"✓ Extracted {total_piis} PIIs from {len(all_piis_dict)} types")
        
        logger.info(f"🔄 STEP 3: Building JSON...")
        
        json_data = {
            'metadata': {
                'batch_id': batch_id,
                'batch_name': batch_name,
                'exported_at': datetime.utcnow().isoformat(),
                'total_piis': total_piis,
                'pii_types': sorted(all_piis_dict.keys()),
                'files': file_summary,
                'encryption': 'AES-GCM-256 + PBKDF2-SHA512' if lock_file else 'None'
            },
            'piis': all_piis_dict
        }
        
        json_string = json.dumps(json_data, indent=2, ensure_ascii=False)
        file_id = str(uuid.uuid4())
        
        logger.info(f"✓ JSON: {len(json_string)} bytes")
        
        # Encrypt if needed
        if lock_file and password:
            logger.info(f"🔄 STEP 4: Encrypting...")
            
            salt = os.urandom(16)
            iv = os.urandom(12)
            # Use SHA-512 for key derivation (more secure)
            key = masker.derive_key(password, salt, use_sha512=True)
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(iv, json_string.encode('utf-8'), None)
            
            encrypted_data = {
                'file_id': file_id,
                'encrypted': True,
                'salt': base64.b64encode(salt).decode('utf-8'),
                'iv': base64.b64encode(iv).decode('utf-8'),
                'ciphertext': base64.b64encode(ciphertext).decode('utf-8'),
                'algorithm': 'AES-GCM-256',
                'kdf': 'PBKDF2-SHA512',
                'iterations': 150000
            }
            
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            mongo_client.store_encrypted_file_password(
                file_id=file_id,
                password_hash=password_hash,
                batch_id=batch_id,
                metadata=json_data['metadata']
            )
            
            elapsed = time.time() - start_time
            logger.info(f"✅ EXPORT COMPLETE: {total_piis} PIIs encrypted in {elapsed:.2f}s")
            logger.info(f"{'='*80}\n")
            
            return jsonify({
                'success': True,
                'file_id': file_id,
                'encrypted': True,
                'data': encrypted_data
            }), 200
        else:
            elapsed = time.time() - start_time
            logger.info(f"✅ EXPORT COMPLETE: {total_piis} PIIs unencrypted in {elapsed:.2f}s")
            logger.info(f"{'='*80}\n")
            
            return jsonify({
                'success': True,
                'file_id': file_id,
                'encrypted': False,
                'data': json_data
            }), 200
    
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ EXPORT FAILED ({elapsed:.2f}s): {str(e)}", exc_info=True)
        logger.error(f"{'='*80}\n")
        return jsonify({'error': str(e)}), 500


@app.route('/api/decrypt-json', methods=['POST'])
@require_api_key
def decrypt_json():
    """
    Decrypt uploaded JSON file and verify password.
    REWRITTEN to handle both SHA-512 and SHA-256 (backward compatible).
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        password = request.form.get('password')
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        logger.info(f"🔓 Decryption request for file: {file.filename}")
        
        # ============= STEP 1: Read and parse encrypted file =============
        file_content = file.read()
        
        try:
            encrypted_data = json.loads(file_content.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"❌ Invalid JSON file: {e}")
            return jsonify({'error': 'Invalid JSON file'}), 400
        
        if not encrypted_data.get('encrypted'):
            return jsonify({'error': 'File is not encrypted'}), 400
        
        file_id = encrypted_data.get('file_id')
        if not file_id:
            return jsonify({'error': 'File ID missing'}), 400
        
        logger.info(f"📂 File ID: {file_id}")
        
        # ============= STEP 2: Verify password from database =============
        try:
            if mongo_client.client is None or mongo_client.db is None:
                logger.error("❌ Database connection failed")
                return jsonify({'error': 'Database connection failed'}), 500
            
            collection = mongo_client.db.file_public_keys
            stored_doc = collection.find_one({"file_id": file_id})
        except (AttributeError, TypeError) as e:
            logger.error(f"❌ Database connection error: {e}")
            return jsonify({'error': 'Database connection failed'}), 500
        except Exception as db_error:
            logger.error(f"❌ Database error: {db_error}")
            return jsonify({'error': 'Database connection failed'}), 500
        
        if not stored_doc:
            logger.error(f"❌ File {file_id} not found in database")
            return jsonify({'error': 'File not found in database'}), 404
        
        # Verify password against stored hash
        stored_hash = stored_doc.get('password_hash')
        if not stored_hash:
            logger.error(f"❌ Password hash not found for file {file_id}")
            return jsonify({'error': 'Password hash not found'}), 404
        
        # Check password using bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            logger.warning(f"❌ Incorrect password for file {file_id}")
            return jsonify({'error': 'Incorrect password'}), 401
        
        logger.info(f"✓ Password verified")
        
        # ============= STEP 3: Decrypt JSON =============
        salt = base64.b64decode(encrypted_data['salt'])
        iv = base64.b64decode(encrypted_data['iv'])
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        
        # Detect KDF algorithm (SHA-512 or SHA-256)
        kdf_algorithm = encrypted_data.get('kdf', 'PBKDF2-SHA256')  # Default to SHA-256 for old files
        use_sha512 = 'SHA512' in kdf_algorithm.upper() or 'SHA-512' in kdf_algorithm.upper()
        
        logger.info(f"🔓 Decrypting with {kdf_algorithm}...")
        
        # Derive key using the detected algorithm
        key = masker.derive_key(password, salt, use_sha512=use_sha512)
        aesgcm = AESGCM(key)
        
        try:
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
            decrypted_json = json.loads(plaintext.decode('utf-8'))
        except Exception as decrypt_error:
            logger.error(f"❌ Decryption failed: {decrypt_error}")
            return jsonify({'error': 'Decryption failed - incorrect password or corrupted file'}), 401
        
        # ============= STEP 4: Validate decrypted data =============
        total_piis = decrypted_json.get('metadata', {}).get('total_piis', 0)
        pii_types = decrypted_json.get('metadata', {}).get('pii_types', [])
        
        logger.info(f"✅ Decryption successful: {total_piis} PIIs across {len(pii_types)} types")
        logger.info(f"   PII types: {pii_types}")
        
        return jsonify({
            'success': True,
            'data': decrypted_json
        }), 200
    
    except Exception as e:
        logger.error(f"❌ Error decrypting JSON: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    return jsonify({'error': 'File too large. Maximum size is 500MB'}), 413


@app.errorhandler(415)
def unsupported_media_type(error):
    """Handle unsupported media type error."""
    logger.error(f"❌ 415 Unsupported Media Type!")
    logger.error(f"   Content-Type: {request.content_type}")
    logger.error(f"   Path: {request.path}")
    logger.error(f"   Method: {request.method}")
    logger.error(f"   Headers: {dict(request.headers)}")
    logger.error(f"   Error: {error}")
    
    # For upload endpoint, just accept it anyway
    if request.path == '/api/upload':
        logger.warning(f"   Allowing upload to proceed despite 415 error")
        return jsonify({'error': 'Media type error but proceeding'}), 415
    
    return jsonify({'error': f'Unsupported Media Type. Got: {request.content_type}'}), 415


@app.route('/api/login', methods=['POST'])
@require_api_key
@rate_limit(max_requests=5, window=300)  # 5 attempts per 5 minutes
def login():
    """Authenticate user with email and password."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Get user from database
        user = mongo_client.get_user_by_email(email)
        
        if not user:
            logger.warning(f"Login attempt failed: User not found - {email}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password
        stored_hash = user.get('password_hash')
        if not stored_hash:
            logger.warning(f"Login attempt failed: No password hash found for user - {email}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
            logger.warning(f"Login attempt failed: Incorrect password for user - {email}")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Login successful
        logger.info(f"User logged in successfully: {email}")
        
        # Return success response with user info (exclude password hash)
        user_info = {k: v for k, v in user.items() if k != 'password_hash'}
        
        response_data = {
            'success': True,
            'message': 'Login successful',
            'user': user_info,
            'token': str(uuid.uuid4())  # Generate a simple token (can be replaced with JWT later)
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error during login: {e}", exc_info=True)
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


def generate_otp():
    """Generate a secure 6-digit OTP (no leading zeros removed)."""
    return str(random.randint(100000, 999999))


def send_sms_otp(mobile, otp):
    """
    Send OTP via SMS using Twilio.
    Falls back to logging if Twilio credentials are not configured.
    """
    twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
    
    # If Twilio credentials are not set, log the OTP (for development/testing)
    if not twilio_account_sid or not twilio_auth_token or not twilio_phone_number:
        logger.warning("Twilio credentials not configured. OTP will be logged instead of sent via SMS.")
        logger.info(f"OTP for +91 {mobile}: {otp}")
        logger.info("To enable SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env file")
        return True
    
    try:
        from twilio.rest import Client
        
        # Initialize Twilio client
        client = Client(twilio_account_sid, twilio_auth_token)
        
        # Format mobile number with country code (India: +91)
        to_number = f"+91{mobile}"
        
        # Create SMS message
        message_body = f"Your PII Sentinel OTP is {otp}. Valid for 2 minutes. Do not share this code."
        
        # Send SMS
        message = client.messages.create(
            body=message_body,
            from_=twilio_phone_number,
            to=to_number
        )
        
        logger.info(f"SMS sent successfully to {to_number}. Message SID: {message.sid}")
        return True
        
    except ImportError:
        logger.error("Twilio library not installed. Install with: pip install twilio")
        logger.info(f"OTP for +91 {mobile}: {otp}")
        return False
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error sending SMS via Twilio: {error_msg}", exc_info=True)
        
        # Log specific error details for debugging
        if "Invalid" in error_msg or "not found" in error_msg.lower():
            logger.error("Twilio credentials may be invalid. Please check your Account SID and Auth Token.")
        elif "not verified" in error_msg.lower() or "unverified" in error_msg.lower():
            logger.error("Phone number not verified in Twilio. For trial accounts, you can only send SMS to verified numbers.")
            logger.info("Add your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
        elif "insufficient" in error_msg.lower() or "balance" in error_msg.lower():
            logger.error("Insufficient Twilio account balance. Please add funds to your Twilio account.")
        
        logger.info(f"OTP for +91 {mobile}: {otp} (SMS failed, check logs above for details)")
        return False


@app.route('/api/auth/send-otp', methods=['POST'])
@require_api_key
def send_otp():
    """Send OTP to mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mobile_raw = data.get('mobile', '')
        
        # Normalize: Extract only digits
        mobile = ''.join(filter(str.isdigit, str(mobile_raw)))
        
        if not mobile:
            return jsonify({'error': 'Mobile number is required'}), 400
        
        # Validate mobile number (10 digits)
        if len(mobile) != 10:
            return jsonify({'error': 'Enter a valid 10-digit mobile number.'}), 400
        
        logger.info(f"[SEND OTP] Mobile normalized: '{mobile}'")
        
        # Generate OTP
        otp = generate_otp()
        expires_at = time.time() + OTP_EXPIRY_SECONDS
        
        # Store OTP in MongoDB
        otp_stored = mongo_client.store_otp(mobile, otp, expires_at)
        
        if not otp_stored:
            logger.warning(f"Failed to store OTP in MongoDB for mobile {mobile}, using in-memory fallback")
            # Fallback to in-memory storage
            with _otp_lock:
                otp_storage[mobile] = {
                    'otp': str(otp),
                    'expires_at': expires_at,
                    'created_at': time.time()
                }
        
        # Log stored OTP for debugging
        logger.info(f"OTP generated and stored for mobile {mobile}: {otp}")
        logger.info(f"OTP will expire at: {expires_at} (in {OTP_EXPIRY_SECONDS} seconds)")
        
        # Send OTP via SMS
        send_sms_otp(mobile, otp)
        
        logger.info(f"OTP sent to mobile: {mobile}")
        
        return jsonify({
            'success': True,
            'message': 'OTP sent successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to send OTP: {str(e)}'}), 500


@app.route('/api/auth/resend-otp', methods=['POST'])
@require_api_key
@rate_limit(max_requests=3, window=60)  # 3 requests per minute
def resend_otp():
    """Resend OTP to mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mobile_raw = data.get('mobile', '')
        
        # Normalize: Extract only digits
        mobile = ''.join(filter(str.isdigit, str(mobile_raw)))
        
        if not mobile:
            return jsonify({'error': 'Mobile number is required'}), 400
        
        # Validate mobile number (10 digits)
        if len(mobile) != 10:
            return jsonify({'error': 'Enter a valid 10-digit mobile number.'}), 400
        
        logger.info(f"[RESEND OTP] Mobile normalized: '{mobile}'")
        
        # Generate new OTP
        otp = generate_otp()
        expires_at = time.time() + OTP_EXPIRY_SECONDS
        
        # Update OTP in MongoDB (overwrites previous)
        otp_stored = mongo_client.store_otp(mobile, otp, expires_at)
        
        if not otp_stored:
            logger.warning(f"Failed to update OTP in MongoDB for mobile {mobile}, using in-memory fallback")
            # Fallback to in-memory storage
            with _otp_lock:
                otp_storage[mobile] = {
                    'otp': str(otp),
                    'expires_at': expires_at,
                    'created_at': time.time()
                }
        
        # Log stored OTP for debugging
        logger.info(f"OTP regenerated and stored for mobile {mobile}: {otp}")
        
        # Send OTP via SMS
        send_sms_otp(mobile, otp)
        
        logger.info(f"OTP resent to mobile: {mobile}")
        
        return jsonify({
            'success': True,
            'message': 'OTP resent successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error resending OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to resend OTP: {str(e)}'}), 500


@app.route('/api/auth/verify-otp', methods=['POST'])
@require_api_key
@rate_limit(max_requests=10, window=300)  # 10 attempts per 5 minutes
def verify_otp():
    """Verify OTP for mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract and normalize inputs - only digits
        mobile_raw = data.get('mobile', '')
        otp_raw = data.get('otp', '')
        
        mobile_normalized = ''.join(filter(str.isdigit, str(mobile_raw)))
        otp_normalized = ''.join(filter(str.isdigit, str(otp_raw)))
        
        logger.info(f"[VERIFY] Request received - Mobile: '{mobile_normalized}', OTP: '{otp_normalized}'")
        
        # Validate
        if not mobile_normalized or len(mobile_normalized) != 10:
            return jsonify({'error': 'Enter a valid 10-digit mobile number.'}), 400
        
        if not otp_normalized or len(otp_normalized) != 6:
            return jsonify({'error': 'Enter a valid 6-digit OTP.'}), 400
        
        # Get OTP from MongoDB (already normalized in get_otp)
        stored_data = mongo_client.get_otp(mobile_normalized)
        
        # Fallback to in-memory if MongoDB fails
        if not stored_data:
            logger.info("[VERIFY] MongoDB lookup failed, checking in-memory")
            with _otp_lock:
                in_memory_data = otp_storage.get(mobile_normalized)
                if in_memory_data:
                    # Normalize in-memory data too
                    stored_mobile = ''.join(filter(str.isdigit, str(mobile_normalized)))
                    stored_otp = ''.join(filter(str.isdigit, str(in_memory_data.get('otp', ''))))
                    stored_data = {
                        'mobile': stored_mobile,
                        'otp': stored_otp,
                        'expires_at': in_memory_data.get('expires_at', 0)
                    }
        
        if not stored_data:
            logger.warning(f"[VERIFY] No OTP found for mobile: '{mobile_normalized}'")
            return jsonify({
                'success': False,
                'error': 'Enter valid OTP sent to your mobile number (+91 ' + mobile_normalized + ').'
            }), 400
        
        # Extract stored OTP (already normalized by get_otp)
        stored_otp = ''.join(filter(str.isdigit, str(stored_data.get('otp', ''))))
        received_otp = otp_normalized
        
        logger.info(f"[VERIFY] Comparing - Stored: '{stored_otp}' (len: {len(stored_otp)}), Received: '{received_otp}' (len: {len(received_otp)})")
        
        # Check expiry
        expires_at = float(stored_data.get('expires_at', 0))
        if time.time() > expires_at:
            logger.warning(f"[VERIFY] OTP expired for mobile: '{mobile_normalized}'")
            mongo_client.delete_otp(mobile_normalized)
            with _otp_lock:
                otp_storage.pop(mobile_normalized, None)
            return jsonify({
                'success': False,
                'error': 'OTP has expired. Please request a new OTP.'
            }), 400
        
        # Compare OTPs (both are normalized 6-digit strings)
        if stored_otp != received_otp:
            logger.warning(f"[VERIFY] OTP mismatch - Expected: '{stored_otp}', Got: '{received_otp}'")
            return jsonify({
                'success': False,
                'error': 'Enter valid OTP sent to your mobile number (+91 ' + mobile_normalized + ').'
            }), 400
        
        # OTP verified successfully!
        logger.info(f"[VERIFY] SUCCESS - Mobile: '{mobile_normalized}', OTP verified")
        
        # Find user by mobile number (phoneNumber field in database)
        # DON'T delete OTP yet - only delete after successful user lookup
        user = None
        if mongo_client.client is not None and mongo_client.db is not None:
            try:
                collection = mongo_client.db["User-Base"]
                
                # Try multiple phone number formats
                search_queries = [
                    {"phoneNumber": mobile_normalized},
                    {"phoneNumber": f"+91{mobile_normalized}"},
                    {"phoneNumber": f"91{mobile_normalized}"},
                    {"phoneNumber": f"0{mobile_normalized}"}  # Some might have leading 0
                ]
                
                # Also try searching by extracting digits from stored phoneNumber
                all_users = list(collection.find({}))
                logger.info(f"[VERIFY] Searching through {len(all_users)} users in database")
                
                # Debug: Log all phone numbers in database
                if all_users:
                    phone_numbers_in_db = []
                    for u in all_users:
                        phone = u.get('phoneNumber', 'N/A')
                        phone_normalized = ''.join(filter(str.isdigit, str(phone))) if phone != 'N/A' else 'N/A'
                        phone_numbers_in_db.append(f"'{phone}' (normalized: '{phone_normalized}')")
                    logger.info(f"[VERIFY] Phone numbers in DB: {', '.join(phone_numbers_in_db[:10])}")  # Show first 10
                
                for search_query in search_queries:
                    user = collection.find_one(search_query)
                    if user:
                        logger.info(f"[VERIFY] Found user with query: {search_query}")
                        break
                    else:
                        logger.debug(f"[VERIFY] No match for query: {search_query}")
                
                # If still not found, try manual matching by extracting digits
                if not user:
                    logger.info(f"[VERIFY] Trying manual digit extraction matching...")
                    for db_user in all_users:
                        db_phone = db_user.get('phoneNumber', '')
                        if db_phone:
                            # Extract only digits from stored phone number (handles spaces, dashes, etc.)
                            db_phone_normalized = ''.join(filter(str.isdigit, str(db_phone)))
                            logger.info(f"[VERIFY] Comparing DB phone '{db_phone}' (normalized: '{db_phone_normalized}') with '{mobile_normalized}'")
                            
                            # Always extract last 10 digits (handles any format: +91 8892211564, 918892211564, etc.)
                            if len(db_phone_normalized) >= 10:
                                db_phone_normalized = db_phone_normalized[-10:]  # Take last 10 digits
                            elif len(db_phone_normalized) < 10:
                                logger.warning(f"[VERIFY] DB phone '{db_phone}' has less than 10 digits after normalization: '{db_phone_normalized}'")
                                continue
                            
                            logger.info(f"[VERIFY] After normalization: '{db_phone_normalized}' vs '{mobile_normalized}'")
                            
                            if db_phone_normalized == mobile_normalized:
                                user = db_user
                                logger.info(f"[VERIFY] ✓ Found user via manual match - DB phone: '{db_phone}' -> normalized: '{db_phone_normalized}'")
                                break
                            else:
                                logger.debug(f"[VERIFY] No match: '{db_phone_normalized}' != '{mobile_normalized}'")
                
                if user and '_id' in user:
                    user['_id'] = str(user['_id'])
                    
            except Exception as e:
                logger.error(f"[VERIFY] Error finding user by mobile: {e}", exc_info=True)
        
        if not user:
            logger.warning(f"[VERIFY] OTP verified but user not found for mobile: '{mobile_normalized}'")
            logger.warning(f"[VERIFY] OTP will remain valid for retry. User should create account first.")
            # Don't delete OTP - let user retry or create account
            # Return specific response indicating OTP verified but user doesn't exist
            return jsonify({
                'success': False,
                'otp_verified': True,
                'user_not_found': True,
                'mobile': mobile_normalized,
                'message': f'User doesn\'t exist with mobile number +91 {mobile_normalized}. Would you like to create a new account?'
            }), 404
        
        # User found - NOW delete OTP
        logger.info(f"[VERIFY] User found for mobile: '{mobile_normalized}' - deleting OTP")
        mongo_client.delete_otp(mobile_normalized)
        with _otp_lock:
            otp_storage.pop(mobile_normalized, None)
        
        # Return success response with user info (exclude password hash)
        user_info = {k: v for k, v in user.items() if k != 'password_hash'}
        
        response_data = {
            'success': True,
            'message': 'OTP verified successfully',
            'user': user_info,
            'token': str(uuid.uuid4())  # Generate a simple token (can be replaced with JWT later)
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to verify OTP: {str(e)}'}), 500


@app.route('/api/auth/debug-otp', methods=['GET'])
@require_api_key
def debug_otp():
    """Debug endpoint to check stored OTPs (for troubleshooting)."""
    try:
        mobile = request.args.get('mobile', '').strip()
        
        if mobile:
            # Check MongoDB first
            stored_data = mongo_client.get_otp(mobile)
            
            # Fallback to in-memory
            if not stored_data:
                with _otp_lock:
                    stored_data = otp_storage.get(mobile)
            
            if stored_data:
                time_remaining = stored_data.get('expires_at', 0) - time.time()
                return jsonify({
                    'success': True,
                    'mobile': mobile,
                    'otp': stored_data.get('otp'),
                    'time_remaining_seconds': round(time_remaining, 2),
                    'expired': time_remaining <= 0,
                    'created_at': stored_data.get('created_at'),
                    'expires_at': stored_data.get('expires_at'),
                    'source': 'mongodb' if 'verified' in stored_data else 'memory'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'message': f'No OTP found for mobile {mobile}'
                }), 404
        else:
            # Return all stored OTPs from MongoDB
            all_otps = {}
            if mongo_client.client is not None and mongo_client.db is not None:
                try:
                    collection = mongo_client.db["OTP-Storage"]
                    all_mongo_otps = list(collection.find({}))
                    for doc in all_mongo_otps:
                        mob = doc.get('mobile')
                        time_remaining = doc.get('expires_at', 0) - time.time()
                        all_otps[mob] = {
                            'otp': doc.get('otp'),
                            'time_remaining_seconds': round(time_remaining, 2),
                            'expired': time_remaining <= 0,
                            'source': 'mongodb'
                        }
                except Exception as e:
                    logger.error(f"Error fetching OTPs from MongoDB: {e}")
            
            # Also include in-memory OTPs
            with _otp_lock:
                for mob, data in otp_storage.items():
                    if mob not in all_otps:
                        time_remaining = data.get('expires_at', 0) - time.time()
                        all_otps[mob] = {
                            'otp': data.get('otp'),
                            'time_remaining_seconds': round(time_remaining, 2),
                            'expired': time_remaining <= 0,
                            'source': 'memory'
                        }
            
            return jsonify({
                'success': True,
                'stored_otps': all_otps,
                'total_count': len(all_otps)
            }), 200
    except Exception as e:
        logger.error(f"Error in debug OTP endpoint: {e}", exc_info=True)
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500


@app.route('/api/auth/test-sms', methods=['POST'])
@require_api_key
def test_sms():
    """Test endpoint to verify Twilio SMS configuration."""
    try:
        twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        config_status = {
            'twilio_account_sid': 'SET' if twilio_account_sid and twilio_account_sid != 'your_twilio_account_sid_here' else 'NOT SET',
            'twilio_auth_token': 'SET' if twilio_auth_token and twilio_auth_token != 'your_twilio_auth_token_here' else 'NOT SET',
            'twilio_phone_number': twilio_phone_number if twilio_phone_number else 'NOT SET',
            'twilio_library_installed': False
        }
        
        try:
            from twilio.rest import Client
            config_status['twilio_library_installed'] = True
            
            if config_status['twilio_account_sid'] == 'SET' and config_status['twilio_auth_token'] == 'SET':
                # Test Twilio client initialization
                try:
                    client = Client(twilio_account_sid, twilio_auth_token)
                    # Try to fetch account info to verify credentials
                    account = client.api.accounts(twilio_account_sid).fetch()
                    config_status['twilio_connection'] = 'SUCCESS'
                    config_status['account_status'] = account.status
                except Exception as e:
                    config_status['twilio_connection'] = f'FAILED: {str(e)}'
        except ImportError:
            config_status['twilio_library_installed'] = False
        
        return jsonify({
            'success': True,
            'config': config_status
        }), 200
        
    except Exception as e:
        logger.error(f"Error testing SMS config: {e}", exc_info=True)
        return jsonify({'error': f'Test failed: {str(e)}'}), 500


@app.route('/api/profile', methods=['GET'])
@require_api_key
@cached(TTLCache(maxsize=100, ttl=10))
def get_profile():
    """Get user profile and stats."""
    username = request.args.get('username')
    email = request.args.get('email')
    
    if not username and not email:
        return jsonify({'error': 'Username or email is required'}), 400
    
    # Get user data
    if username:
        user = mongo_client.get_user_by_username(username)
    else:
        user = mongo_client.get_user_by_email(email)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Remove password hash from response
    user_data = {k: v for k, v in user.items() if k != 'password_hash'}
    username_for_batches = user.get('username')
    
    # Get user's stats using optimized aggregation (fast!)
    user_id_for_stats = user.get('email') or user.get('username') or username_for_batches
    stats_data = mongo_client.get_user_stats(user_id_for_stats) if user_id_for_stats else {}
    
    total_batches = stats_data.get('total_batches', 0)
    total_files = stats_data.get('total_files', 0)
    total_piis = stats_data.get('total_piis', 0)
    
    # For detailed breakdown, we still need to load batches (but this is optional)
    gov_piis = 0
    custom_piis = 0
    pii_type_counts = {}
    gov_pii_types = {
        'aadhaar', 'pan', 'passport', 'voter_id', 'driving_license', 
        'bank_account', 'ifsc', 'upi', 'epf', 'gstin', 'cin', 'ration_card'
    }
    
    # Only load batches if we need detailed breakdown (can be made optional)
    if username_for_batches and total_batches > 0:
        try:
            batches = mongo_client.get_batches_by_username(username_for_batches)
            for batch in batches:
                breakdown = batch.get('stats', {}).get('breakdown', {})
                if breakdown:
                    for pii_type, count in breakdown.items():
                        pii_type_counts[pii_type] = pii_type_counts.get(pii_type, 0) + count
                        if pii_type.lower() in gov_pii_types:
                            gov_piis += count
                        else:
                            custom_piis += count
        except Exception as e:
            logger.warning(f"Error loading detailed breakdown: {e}")
    
    logger.info(f"Profile stats - Batches: {total_batches}, Files: {total_files}, PIIs: {total_piis}")
    
    # Calculate percentages
    gov_percentage = (gov_piis / total_piis * 100) if total_piis > 0 else 0
    custom_percentage = (custom_piis / total_piis * 100) if total_piis > 0 else 0
    
    # Prepare PII type data for scatter plot (most/least detected)
    pii_type_list = [
        {'type': pii_type, 'count': count} 
        for pii_type, count in sorted(pii_type_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    logger.info(f"Profile stats - Gov%: {gov_percentage}, Custom%: {custom_percentage}, PII types: {len(pii_type_list)}")
    
    return jsonify({
        'success': True,
        'user': user_data,
        'stats': {
            'total_batches': total_batches,
            'total_files': total_files,
            'total_piis': total_piis,
            'gov_piis': gov_piis,
            'custom_piis': custom_piis,
            'gov_percentage': round(gov_percentage, 2),
            'custom_percentage': round(custom_percentage, 2),
            'pii_type_counts': pii_type_counts,
            'pii_type_list': pii_type_list
        }
    }), 200


@app.route('/api/profile', methods=['PUT'])
@require_api_key
def update_profile():
    """Update user profile data."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username')
        email = data.get('email')
        
        if not username and not email:
            return jsonify({'error': 'Username or email is required'}), 400
        
        # Get user data
        if username:
            user = mongo_client.get_user_by_username(username)
        else:
            user = mongo_client.get_user_by_email(email)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Prepare update data (exclude password_hash, username, email, _id, created_at)
        update_data = {}
        exclude_fields = ['password_hash', 'username', 'email', '_id', 'created_at', 'account_status']
        
        for key, value in data.items():
            if key not in exclude_fields:
                update_data[key] = value
        
        # Update timestamp
        update_data['updated_at'] = datetime.utcnow()
        
        # Update user in database
        if mongo_client.client is not None and mongo_client.db is not None:
            collection = mongo_client.db["User-Base"]
            if username:
                result = collection.update_one(
                    {"username": username},
                    {"$set": update_data}
                )
            else:
                result = collection.update_one(
                    {"email": email},
                    {"$set": update_data}
                )
            
            if result.modified_count > 0:
                # Fetch updated user
                if username:
                    updated_user = mongo_client.get_user_by_username(username)
                else:
                    updated_user = mongo_client.get_user_by_email(email)
                
                # Remove password hash from response
                user_data = {k: v for k, v in updated_user.items() if k != 'password_hash'}
                
                return jsonify({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'user': user_data
                }), 200
            else:
                return jsonify({'error': 'No changes were made'}), 400
        
        return jsonify({'error': 'Database connection failed'}), 500
        
    except Exception as e:
        logger.error(f"Error updating profile: {e}", exc_info=True)
        return jsonify({'error': f'Failed to update profile: {str(e)}'}), 500


@app.route('/api/create-account', methods=['POST'])
@require_api_key
def create_account():
    """Create a new user account and store in User-Base collection."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['username', 'fullName', 'email', 'phoneNumber', 'password', 'country', 'preferredLanguage']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate username format
        username = data.get('username', '').strip()
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400
        if not username.replace('_', '').isalnum():
            return jsonify({'error': 'Username can only contain letters, numbers, and underscores'}), 400
        
        # Check if username already exists
        if mongo_client.client is not None and mongo_client.db is not None:
            try:
                collection = mongo_client.db["User-Base"]
                existing_username = collection.find_one({"username": username})
                if existing_username:
                    return jsonify({'error': 'Username already taken'}), 409
            except Exception as e:
                logger.error(f"Error checking username: {e}")
                return jsonify({'error': 'Database error while checking username'}), 500
        
        # Check if user already exists by email
        existing_user = mongo_client.get_user_by_email(data.get('email'))
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Hash password before storing
        password_hash = bcrypt.hashpw(data.get('password').encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Prepare user data for storage
        user_data = {
            # Step 1: Personal & Account Information
            'username': username,  # Unique username
            'fullName': data.get('fullName'),
            'email': data.get('email'),
            'phoneNumber': data.get('phoneNumber'),
            'password_hash': password_hash,  # Store hashed password, not plain text
            'country': data.get('country'),
            'preferredLanguage': data.get('preferredLanguage'),
            'profilePicture': data.get('profilePicturePreview'),  # Store base64 encoded image if provided
            
            # Step 2: Professional & Company Details
            'userType': data.get('userType'),
            'organizationName': data.get('organizationName'),
            'organizationType': data.get('organizationType'),
            'industry': data.get('industry'),
            'companySize': data.get('companySize'),
            'website': data.get('website'),
            'designation': data.get('designation'),
            'department': data.get('department'),
            'yearsOfExperience': data.get('yearsOfExperience'),
            'complianceFrameworks': data.get('complianceFrameworks', []),
            'teamSize': data.get('teamSize'),
            'companyLocation': data.get('companyLocation'),
            
            # Step 3: Use Case & Motivation
            'primaryGoal': data.get('primaryGoal'),
            'reason': data.get('reason'),
            'dataTypes': data.get('dataTypes', []),
            'usageEnvironment': data.get('usageEnvironment'),
            'averageVolume': data.get('averageVolume'),
            'needApiAccess': data.get('needApiAccess', False),
            'internalUsers': data.get('internalUsers', []),
            'deploymentPlan': data.get('deploymentPlan'),
            
            # Step 4: Security & Consent
            'enable2FA': data.get('enable2FA', False),
            'preferredAuthMethod': data.get('preferredAuthMethod'),
            'acceptTerms': data.get('acceptTerms', False),
            'acceptPrivacy': data.get('acceptPrivacy', False),
            'consentDataProcessing': data.get('consentDataProcessing', False),
            'receiveUpdates': data.get('receiveUpdates', False),
        }
        
        # Create user in database
        user_id = mongo_client.create_user(user_data)
        
        if not user_id:
            return jsonify({'error': 'Failed to create user account'}), 500
        
        logger.info(f"User account created successfully: {user_id} for email: {data.get('email')}")
        
        # Return success response (don't include password hash)
        response_data = {
            'success': True,
            'user_id': user_id,
            'message': 'Account created successfully',
            'email': data.get('email')
        }
        
        return jsonify(response_data), 201
        
    except Exception as e:
        logger.error(f"Error creating account: {e}", exc_info=True)
        return jsonify({'error': f'Failed to create account: {str(e)}'}), 500


@app.route('/api/activate-plan', methods=['POST'])
@require_api_key
def activate_plan():
    """Activate a subscription plan for a user."""
    try:
        data = request.get_json()
        plan_name = data.get('plan_name')
        billing_period = data.get('billing_period', 'monthly')
        email = data.get('email')
        
        if not plan_name or not email:
            return jsonify({'error': 'plan_name and email are required'}), 400
        
        # Plan pricing mapping
        plan_prices = {
            'Starter': {'monthly': 0, 'yearly': 0},
            'Professional': {'monthly': 999, 'yearly': 9999},
            'Enterprise': {'monthly': 4999, 'yearly': 49999}
        }
        
        if plan_name not in plan_prices:
            return jsonify({'error': 'Invalid plan name'}), 400
        
        amount = plan_prices[plan_name][billing_period]
        plan_type_map = {
            'Starter': 'starter',
            'Professional': 'professional',
            'Enterprise': 'enterprise'
        }
        plan_type = plan_type_map.get(plan_name, plan_name.lower())
        
        success = mongo_client.update_user_subscription(
            email=email,
            plan_name=plan_name,
            plan_type=plan_type,
            amount=amount,
            billing_period=billing_period
        )
        
        if success:
            logger.info(f"Plan activated for {email}, plan: {plan_name}")
            return jsonify({
                'success': True,
                'message': 'Plan activated successfully',
                'plan_name': plan_name,
                'plan_type': plan_type,
                'amount': amount
            }), 200
        else:
            return jsonify({'error': 'Failed to activate plan'}), 500
        
    except Exception as e:
        logger.error(f"Error activating plan: {e}", exc_info=True)
        return jsonify({'error': f'Failed to activate plan: {str(e)}'}), 500


@app.route('/api/subscription', methods=['GET'])
@require_api_key
def get_subscription():
    """Get user subscription details."""
    try:
        email = request.args.get('email')
        
        if not email:
            return jsonify({'error': 'email is required'}), 400
        
        subscription = mongo_client.get_user_subscription(email)
        
        if not subscription:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'subscription': subscription
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting subscription: {e}", exc_info=True)
        return jsonify({'error': f'Failed to get subscription: {str(e)}'}), 500


@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors."""
    logger.error(f"Internal error: {error}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500


# ============================================
# SETTINGS ROUTES
# ============================================

@app.route('/api/settings/update-status', methods=['POST'])
@require_api_key
def update_account_status():
    """Update user account status."""
    try:
        data = request.get_json()
        email = data.get('email')
        status = data.get('status', 'active')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if status not in ['active', 'inactive', 'logged_out']:
            return jsonify({'error': 'Invalid status'}), 400
        
        success = mongo_client.update_user_status(email, status)
        if success:
            user = mongo_client.get_user_by_email(email)
            if user and '_id' in user:
                user['_id'] = str(user['_id'])
            return jsonify({
                'success': True,
                'message': 'Account status updated successfully',
                'user': user
            }), 200
        else:
            return jsonify({'error': 'Failed to update account status'}), 500
    
    except Exception as e:
        logger.error(f"Error updating account status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/update-plan', methods=['POST'])
@require_api_key
def update_plan():
    """Update user subscription plan."""
    try:
        data = request.get_json()
        email = data.get('email')
        plan = data.get('plan', 'free')
        billing_period = data.get('billingPeriod', 'monthly')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if plan not in ['free', 'pro', 'enterprise']:
            return jsonify({'error': 'Invalid plan'}), 400
        
        if billing_period not in ['monthly', 'yearly']:
            return jsonify({'error': 'Invalid billing period'}), 400
        
        success = mongo_client.update_user_plan(email, plan, billing_period)
        if success:
            user = mongo_client.get_user_by_email(email)
            if user and '_id' in user:
                user['_id'] = str(user['_id'])
            return jsonify({
                'success': True,
                'message': 'Plan updated successfully',
                'user': user
            }), 200
        else:
            return jsonify({'error': 'Failed to update plan'}), 500
    
    except Exception as e:
        logger.error(f"Error updating plan: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/update-security', methods=['POST'])
@require_api_key
def update_security():
    """Update user security settings."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        security_data = {k: v for k, v in data.items() if k != 'email'}
        
        updated_user = mongo_client.update_user_security(email, security_data)
        if updated_user:
            if '_id' in updated_user:
                updated_user['_id'] = str(updated_user['_id'])
            # Remove password hash from response
            updated_user.pop('password_hash', None)
            return jsonify({
                'success': True,
                'message': 'Security settings updated successfully',
                'user': updated_user
            }), 200
        else:
            return jsonify({'error': 'Failed to update security settings'}), 500
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating security settings: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/update-preferences', methods=['POST'])
@require_api_key
def update_preferences():
    """Update user preferences."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        preferences = {
            'emailUpdates': data.get('emailUpdates'),
            'dataConsent': data.get('dataConsent')
        }
        
        updated_user = mongo_client.update_user_preferences(email, preferences)
        if updated_user:
            if '_id' in updated_user:
                updated_user['_id'] = str(updated_user['_id'])
            return jsonify({
                'success': True,
                'message': 'Preferences updated successfully',
                'user': updated_user
            }), 200
        else:
            return jsonify({'error': 'Failed to update preferences'}), 500
    
    except Exception as e:
        logger.error(f"Error updating preferences: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/download-data', methods=['POST'])
@require_api_key
def download_user_data():
    """Download user data as ZIP file."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Get all user data
        user_data = mongo_client.get_user_data_for_export(email)
        
        # Create temporary JSON file
        import tempfile
        import json as json_lib
        
        temp_dir = tempfile.mkdtemp()
        json_file = os.path.join(temp_dir, f'user_data_{email}_{int(time.time())}.json')
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json_lib.dump(user_data, f, indent=2, default=str)
        
        # Create ZIP file
        zip_file = os.path.join(temp_dir, f'user_data_{email}_{int(time.time())}.zip')
        create_zip([json_file], zip_file)
        
        # Return file path (in production, upload to S3 or similar and return URL)
        return jsonify({
            'success': True,
            'downloadUrl': f'/api/settings/download-file?file={os.path.basename(zip_file)}',
            'message': 'Data export prepared successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"Error downloading user data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/download-file', methods=['GET'])
@require_api_key
def download_settings_file():
    """Serve downloaded file."""
    try:
        file_name = request.args.get('file')
        if not file_name:
            return jsonify({'error': 'File name required'}), 400
        
        # Security: Validate file name to prevent directory traversal
        if '..' in file_name or '/' in file_name or '\\' in file_name:
            return jsonify({'error': 'Invalid file name'}), 400
        
        # In production, retrieve from secure storage (S3, etc.)
        # For now, serve from temp directory (implement proper secure file serving)
        import tempfile
        import glob
        
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, file_name)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True, download_name=file_name)
    
    except Exception as e:
        logger.error(f"Error serving file: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/clear-activity', methods=['POST'])
@require_api_key
def clear_activity():
    """Clear user activity logs."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        success = mongo_client.clear_user_activity_logs(email)
        if success:
            return jsonify({
                'success': True,
                'message': 'Activity logs cleared successfully'
            }), 200
        else:
            return jsonify({'error': 'Failed to clear activity logs'}), 500
    
    except Exception as e:
        logger.error(f"Error clearing activity logs: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/logout', methods=['POST'])
@require_api_key
def logout():
    """Logout user and update status."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Update status to logged_out
        success = mongo_client.update_user_status(email, 'logged_out')
        if success:
            return jsonify({
                'success': True,
                'message': 'Logged out successfully'
            }), 200
        else:
            return jsonify({'error': 'Failed to logout'}), 500
    
    except Exception as e:
        logger.error(f"Error logging out: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings/delete-account', methods=['POST'])
@require_api_key
def delete_account():
    """Delete user account."""
    try:
        data = request.get_json()
        email = data.get('email')
        reason = data.get('reason', 'Not specified')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        success = mongo_client.delete_user_account(email, reason)
        if success:
            return jsonify({
                'success': True,
                'message': 'Account deleted successfully'
            }), 200
        else:
            return jsonify({'error': 'Failed to delete account'}), 500
    
    except Exception as e:
        logger.error(f"Error deleting account: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


PLAN_CATALOG = {
    'starter': {
        'id': 'starter',
        'name': 'Starter',
        'price_inr': 0,
        'monthly_tokens': 150,  # 5 tokens/day approximated to monthly bucket
        'features': {
            'lock_json': False,
            'unlock_json': False,
            'advanced_analysis': False,
            'log_records': False
        }
    },
    'professional': {
        'id': 'professional',
        'name': 'Professional',
        'price_inr': 999,
        'monthly_tokens': 500,
        'features': {
            'lock_json': True,
            'unlock_json': True,
            'advanced_analysis': True,
            'log_records': False
        }
    },
    'enterprise': {
        'id': 'enterprise',
        'name': 'Enterprise',
        'price_inr': 4999,
        'monthly_tokens': None,  # Unlimited tokens
        'features': {
            'lock_json': True,
            'unlock_json': True,
            'advanced_analysis': True,
            'log_records': True
        }
    }
}

TOKEN_ACTION_COSTS = {
    'upload': 1,
    'lock_json': 5,
    'unlock_json': 5
}

ADDON_TOKEN_PRICE_INR = 20
PAYMENT_SIMULATION_ENABLED = os.getenv('ENABLE_PAYMENT_SIMULATION', 'true').lower() in ('1', 'true', 'yes')

mongo_client.configure_plans(PLAN_CATALOG)

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    
    logger.info(f"Starting Flask server on {host}:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)

