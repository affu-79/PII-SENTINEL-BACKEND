"""
Settings routes for PII Sentinel backend.
"""
import logging
from flask import Blueprint, request, jsonify

from mongo_client import mongo_client
from middleware.security import rate_limit

logger = logging.getLogger(__name__)

settings_bp = Blueprint('settings', __name__)


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


@settings_bp.route('/settings/update-status', methods=['POST'])
@require_api_key
def update_status():
    """Update user account status."""
    try:
        data = request.get_json()
        email = data.get('email')
        status = data.get('status')
        
        if not email or not status:
            return jsonify({'error': 'Email and status are required'}), 400
        
        success = mongo_client.update_user_status(email, status)
        
        if success:
            return jsonify({'message': 'Status updated successfully'}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    
    except Exception as e:
        logger.error(f"Error updating status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/update-plan', methods=['POST'])
@require_api_key
def update_plan():
    """Update user subscription plan."""
    try:
        data = request.get_json()
        email = data.get('email')
        plan = data.get('plan')
        billing_period = data.get('billingPeriod', 'monthly')
        
        if not email or not plan:
            return jsonify({'error': 'Email and plan are required'}), 400
        
        success = mongo_client.update_user_plan(email, plan, billing_period)
        
        if success:
            token_summary = mongo_client.get_token_summary(email) or {}
            return jsonify({
                'message': 'Plan updated successfully',
                'tokens': token_summary
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    
    except Exception as e:
        logger.error(f"Error updating plan: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/update-security', methods=['POST'])
@require_api_key
@rate_limit(max_requests=10, window=300)  # 10 requests per 5 minutes
def update_security():
    """Update user security settings."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        security_data = {
            'newPassword': data.get('newPassword'),
            'currentPassword': data.get('currentPassword'),
            'twoFactorEnabled': data.get('twoFactorEnabled'),
            'googleLinked': data.get('googleLinked'),
            'emailLoginEnabled': data.get('emailLoginEnabled'),
            'resetSessions': data.get('resetSessions', False)
        }
        
        result = mongo_client.update_user_security(email, security_data)
        
        if result:
            user_info = {k: v for k, v in result.items() if k != 'password_hash'}
            return jsonify({
                'message': 'Security settings updated successfully',
                'user': user_info
            }), 200
        else:
            return jsonify({'error': 'User not found or update failed'}), 404
    
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating security: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/update-preferences', methods=['POST'])
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
        
        result = mongo_client.update_user_preferences(email, preferences)
        
        if result:
            user_info = {k: v for k, v in result.items() if k != 'password_hash'}
            return jsonify({
                'message': 'Preferences updated successfully',
                'user': user_info
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    
    except Exception as e:
        logger.error(f"Error updating preferences: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/download-data', methods=['POST'])
@require_api_key
@rate_limit(max_requests=5, window=3600)  # 5 requests per hour
def download_data():
    """Download user data export."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user_data = mongo_client.get_user_data_for_export(email)
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        # Create zip file (implementation would go here)
        # For now, return the data
        return jsonify({
            'message': 'Data export ready',
            'data': user_data
        }), 200
    
    except Exception as e:
        logger.error(f"Error downloading data: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/logout', methods=['POST'])
@require_api_key
def logout():
    """Logout user and update status."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        success = mongo_client.update_user_status(email, 'logged_out')
        
        if success:
            return jsonify({'message': 'Logged out successfully'}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    
    except Exception as e:
        logger.error(f"Error logging out: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/settings/delete-account', methods=['POST'])
@require_api_key
@rate_limit(max_requests=3, window=3600)  # 3 requests per hour
def delete_account():
    """Delete user account."""
    try:
        data = request.get_json()
        email = data.get('email')
        reason = data.get('reason', 'No reason provided')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        success = mongo_client.delete_user_account(email, reason)
        
        if success:
            return jsonify({'message': 'Account deleted successfully'}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    
    except Exception as e:
        logger.error(f"Error deleting account: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

