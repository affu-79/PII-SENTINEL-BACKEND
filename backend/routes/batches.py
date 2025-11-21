"""
Batch management routes for PII Sentinel backend.
"""
import uuid
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify

from mongo_client import mongo_client
from utils import get_timestamp
from middleware.security import rate_limit

logger = logging.getLogger(__name__)

batches_bp = Blueprint('batches', __name__)


def require_api_key(f):
    """Decorator to require API key."""
    from functools import wraps
    from config import config
    import secrets
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-KEY')
        expected_key = config.API_KEY
        
        if not expected_key:
            if config.is_production():
                logger.error("API_KEY not set in production environment")
                return jsonify({'error': 'Server configuration error'}), 500
            return f(*args, **kwargs)
        
        if not api_key or len(api_key) != len(expected_key) or not secrets.compare_digest(api_key, expected_key):
            return jsonify({'error': 'Invalid or missing API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


@batches_bp.route('/create-batch', methods=['POST'])
@require_api_key
def create_batch():
    """Create a new batch."""
    try:
        data = request.get_json()
        name = data.get('name', f'Batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}')
        user_id = data.get('user_id', 'default')
        username = data.get('username')
        
        if user_id == 'default':
            logger.warning(f"Batch creation attempted with default user_id. Request data: {data}")
        
        # Verify user exists if not default
        if user_id != 'default':
            user = mongo_client.get_user_by_email(user_id)
            if not user:
                user = mongo_client.get_user_by_username(user_id)
            if user and user.get('email'):
                user_id = user.get('email')
                logger.info(f"[CREATE BATCH] User verified - Email: {user.get('email')}")
            else:
                logger.warning(f"[CREATE BATCH] User not found for user_id: {user_id}")
        
        # Check for duplicate batch names
        existing_batches = mongo_client.list_batches(user_id, limit=1000)
        for batch in existing_batches:
            if batch.get('name', '').strip().lower() == name.strip().lower():
                return jsonify({
                    'error': f'Batch name "{name}" already exists. Please choose a different name.'
                }), 400
        
        batch_id = str(uuid.uuid4())
        batch_doc = mongo_client.create_batch(batch_id, name, user_id, username)
        
        logger.info(f"[CREATE BATCH] Created batch '{name}' (ID: {batch_id}) for user_id: {user_id}")
        
        return jsonify({
            'batch_id': batch_id,
            'name': name,
            'created_at': batch_doc.get('created_at', get_timestamp()),
            'message': 'Batch created successfully'
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating batch: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@batches_bp.route('/batches', methods=['GET'])
@require_api_key
def list_batches():
    """List all batches for a user."""
    try:
        user_id = request.args.get('user_id', 'default')
        limit = int(request.args.get('limit', 100))
        
        batches = mongo_client.list_batches(user_id, limit=limit)
        
        return jsonify({
            'batches': batches,
            'count': len(batches)
        }), 200
    
    except Exception as e:
        logger.error(f"Error listing batches: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@batches_bp.route('/batch/<batch_id>', methods=['DELETE'])
@require_api_key
def delete_batch(batch_id):
    """Delete a batch."""
    try:
        success = mongo_client.delete_batch(batch_id)
        
        if success:
            return jsonify({'message': 'Batch deleted successfully'}), 200
        else:
            return jsonify({'error': 'Batch not found'}), 404
    
    except Exception as e:
        logger.error(f"Error deleting batch: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@batches_bp.route('/batch/<batch_id>/analysis', methods=['GET'])
@require_api_key
def get_batch_analysis(batch_id):
    """Get analysis data for a batch."""
    try:
        analysis = mongo_client.get_batch_analysis(batch_id)
        
        if not analysis:
            return jsonify({'error': 'Batch not found'}), 404
        
        return jsonify(analysis), 200
    
    except Exception as e:
        logger.error(f"Error getting batch analysis: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

