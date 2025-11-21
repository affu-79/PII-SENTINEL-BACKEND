"""
Authentication routes for PII Sentinel backend.
"""
import os
import uuid
import logging
import random
import time
import re
from datetime import datetime, timedelta
from typing import Optional, Dict
from flask import Blueprint, request, jsonify
import bcrypt

from mongo_client import mongo_client
from middleware.security import rate_limit
from config import config
from shared.auth import require_api_key
from utils.jwt_utils import generate_access_token, generate_refresh_token, refresh_access_token

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


def generate_otp():
    """Generate a secure 6-digit OTP (no leading zeros removed)."""
    return str(random.randint(100000, 999999))


def normalize_phone_input(mobile: str, country_code: Optional[str]) -> Optional[Dict[str, str]]:
    """
    Normalize mobile and country code into E.164 friendly pieces.
    Falls back to +91 for legacy 10-digit numbers if no country code supplied.
    """
    if mobile is None:
        return None

    mobile_digits = ''.join(filter(str.isdigit, str(mobile)))
    if not mobile_digits:
        return None

    country_digits = ''
    if country_code:
        country_digits = ''.join(filter(str.isdigit, str(country_code)))
    elif len(mobile_digits) == 10:
        country_digits = '91'  # Legacy fallback for India-specific flow
    else:
        return None

    if not country_digits:
        return None

    full_digits = f"{country_digits}{mobile_digits}"
    if len(full_digits) < 6 or len(full_digits) > 15:
        return None

    return {
        "e164": f"+{full_digits}",
        "digits": full_digits,
        "country_code": f"+{country_digits}",
        "country_digits": country_digits,
        "local_digits": mobile_digits
    }


def send_sms_otp(phone_number: str, otp: str) -> bool:
    """Send OTP via SMS using Twilio."""
    try:
        from twilio.rest import Client
        
        twilio_account_sid = config.TWILIO_ACCOUNT_SID
        twilio_auth_token = config.TWILIO_AUTH_TOKEN
        twilio_phone_number = config.TWILIO_PHONE_NUMBER
        
        if not all([twilio_account_sid, twilio_auth_token, twilio_phone_number]):
            logger.warning("Twilio credentials not configured")
            return False
        
        # Normalize mobile number to E.164
        normalized = str(phone_number).strip()
        if not normalized.startswith('+'):
            digits_only = ''.join(filter(str.isdigit, normalized))
            normalized = f"+{digits_only}" if digits_only else normalized
        
        client = Client(twilio_account_sid, twilio_auth_token)
        
        message_body = f"Your PII Sentinel OTP is: {otp}. Valid for 2 minutes. Do not share this OTP."
        
        message = client.messages.create(
            body=message_body,
            from_=twilio_phone_number,
            to=normalized
        )
        
        logger.info(f"SMS sent successfully to {normalized}. Message SID: {message.sid}")
        return True
        
    except ImportError:
        logger.error("Twilio library not installed. Install with: pip install twilio")
        logger.info(f"OTP for {phone_number}: {otp}")
        return False
    except Exception as e:
        error_msg = str(e)
        if "Invalid" in error_msg or "not found" in error_msg.lower():
            logger.error("Twilio credentials may be invalid. Please check your Account SID and Auth Token.")
        elif "not verified" in error_msg.lower() or "unverified" in error_msg.lower():
            logger.error(f"Twilio phone number {twilio_phone_number} is not verified. Please verify it in Twilio console.")
        else:
            logger.error(f"Error sending SMS: {e}", exc_info=True)
        logger.info(f"OTP for {phone_number}: {otp}")
        return False


@auth_bp.route('/login', methods=['POST'])
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
        
        # Generate JWT tokens
        try:
            access_token = generate_access_token(
                user_id=email,
                email=email,
                username=user.get('username')
            )
            refresh_token = generate_refresh_token(
                user_id=email,
                email=email
            )
        except Exception as e:
            logger.error(f"Error generating JWT tokens: {e}")
            return jsonify({'error': 'Authentication error'}), 500
        
        # Update user status
        mongo_client.update_user_status(email, 'active')
        
        # Login successful
        logger.info(f"User logged in successfully: {email}")
        
        # Return success response with user info (exclude password hash)
        user_info = {k: v for k, v in user.items() if k != 'password_hash'}
        
        response_data = {
            'success': True,
            'message': 'Login successful',
            'user': user_info,
            'access_token': access_token,
            'refresh_token': refresh_token
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error during login: {e}", exc_info=True)
        return jsonify({'error': f'Login failed: {str(e)}'}), 500


@auth_bp.route('/auth/send-otp', methods=['POST'])
@require_api_key
@rate_limit(max_requests=3, window=60)  # 3 requests per minute
def send_otp():
    """Send OTP to mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mobile = data.get('mobile')
        if not mobile:
            return jsonify({'error': 'Mobile number is required'}), 400
        country_code = data.get('country_code')

        phone_info = normalize_phone_input(mobile, country_code)
        if not phone_info:
            if country_code:
                return jsonify({'error': 'Enter a valid mobile number for the selected country.'}), 400
            return jsonify({'error': 'Enter a valid mobile number and country code.'}), 400
        if not country_code:
            logger.debug("Country code missing; defaulted to %s for mobile %s", phone_info['country_code'], phone_info['local_digits'])
        
        # Generate OTP
        otp = generate_otp()
        expires_at = time.time() + config.OTP_EXPIRY_SECONDS
        
        # Store OTP in MongoDB
        otp_stored = mongo_client.store_otp(phone_info['e164'], otp, expires_at)
        
        if not otp_stored:
            logger.error(f"Failed to store OTP for mobile {phone_info['e164']}")
            return jsonify({'error': 'Failed to generate OTP. Please try again.'}), 500
        
        # Send SMS
        sms_sent = send_sms_otp(phone_info['e164'], otp)
        
        if not sms_sent:
            logger.warning(f"SMS not sent for mobile {phone_info['e164']}, but OTP stored")
        
        logger.info(f"OTP sent to mobile: {phone_info['e164']}")
        
        return jsonify({
            'success': True,
            'message': 'OTP sent successfully',
            'mobile': phone_info['local_digits'],
            'country_code': phone_info['country_code'],
            'formatted_mobile': phone_info['e164']
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to send OTP: {str(e)}'}), 500


@auth_bp.route('/auth/resend-otp', methods=['POST'])
@require_api_key
@rate_limit(max_requests=3, window=60)  # 3 requests per minute
def resend_otp():
    """Resend OTP to mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mobile = data.get('mobile')
        if not mobile:
            return jsonify({'error': 'Mobile number is required'}), 400
        country_code = data.get('country_code')

        phone_info = normalize_phone_input(mobile, country_code)
        if not phone_info:
            if country_code:
                return jsonify({'error': 'Enter a valid mobile number for the selected country.'}), 400
            return jsonify({'error': 'Enter a valid mobile number and country code.'}), 400
        if not country_code:
            logger.debug("Country code missing during resend; defaulted to %s for mobile %s", phone_info['country_code'], phone_info['local_digits'])
        
        # Generate new OTP
        otp = generate_otp()
        expires_at = time.time() + config.OTP_EXPIRY_SECONDS
        
        # Update OTP in MongoDB
        otp_stored = mongo_client.store_otp(phone_info['e164'], otp, expires_at)
        
        if not otp_stored:
            logger.error(f"Failed to update OTP for mobile {phone_info['e164']}")
            return jsonify({'error': 'Failed to resend OTP. Please try again.'}), 500
        
        # Send SMS
        send_sms_otp(phone_info['e164'], otp)
        
        logger.info(f"OTP resent to mobile: {phone_info['e164']}")
        
        return jsonify({
            'success': True,
            'message': 'OTP resent successfully',
            'mobile': phone_info['local_digits'],
            'country_code': phone_info['country_code'],
            'formatted_mobile': phone_info['e164']
        }), 200
        
    except Exception as e:
        logger.error(f"Error resending OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to resend OTP: {str(e)}'}), 500


@auth_bp.route('/auth/verify-otp', methods=['POST'])
@require_api_key
@rate_limit(max_requests=10, window=300)  # 10 attempts per 5 minutes
def verify_otp():
    """Verify OTP for mobile number."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        mobile = data.get('mobile')
        otp = data.get('otp')
        country_code = data.get('country_code')
        
        if not mobile or not otp:
            return jsonify({'error': 'Mobile number and OTP are required'}), 400
        
        phone_info = normalize_phone_input(mobile, country_code)
        if not phone_info:
            return jsonify({'error': 'Enter a valid mobile number and country code.'}), 400
        if not country_code:
            logger.debug("Country code missing during verify; defaulted to %s for mobile %s", phone_info['country_code'], phone_info['local_digits'])
        
        otp_normalized = ''.join(filter(str.isdigit, str(otp)))
        if len(otp_normalized) != 6:
            return jsonify({'error': 'OTP must be 6 digits'}), 400
        
        # Get OTP from MongoDB (check both new and legacy keys)
        otp_lookup_key = phone_info['e164']
        stored_otp_data = mongo_client.get_otp(phone_info['e164'])
        if not stored_otp_data:
            stored_otp_data = mongo_client.get_otp(phone_info['local_digits'])
            if stored_otp_data:
                otp_lookup_key = phone_info['local_digits']
        
        if not stored_otp_data:
            return jsonify({
                'error': f'Enter valid OTP sent to your mobile number ({phone_info["country_code"]} {phone_info["local_digits"]}).'
            }), 400
        
        stored_otp = stored_otp_data.get('otp', '')
        
        # Compare OTPs (constant-time comparison)
        import secrets
        if not secrets.compare_digest(otp_normalized, stored_otp):
            return jsonify({
                'error': f'Enter valid OTP sent to your mobile number ({phone_info["country_code"]} {phone_info["local_digits"]}).'
            }), 400
        
        # OTP verified successfully
        logger.info(f"OTP verified for mobile: {phone_info['e164']}")
        
        # Find user by mobile number
        user = None
        input_candidates = {phone_info['digits'], phone_info['local_digits']}
        all_users = mongo_client.db["User-Base"].find({})
        
        for db_user in all_users:
            db_mobile = db_user.get('mobile', '')
            if db_mobile:
                db_mobile_normalized = ''.join(filter(str.isdigit, str(db_mobile)))
                if db_mobile_normalized in input_candidates:
                    user = db_user
                    break
        
        if not user:
            logger.warning(f"OTP verified but user not found for mobile: {phone_info['e164']}")
            return jsonify({
                'otp_verified': True,
                'user_not_found': True,
                'mobile': phone_info['local_digits'],
                'country_code': phone_info['country_code'],
                'message': f'User doesn\'t exist with mobile number ({phone_info["country_code"]} {phone_info["local_digits"]}). Would you like to create a new account?'
            }), 404
        
        # Delete OTP after successful verification (handle both keys)
        mongo_client.delete_otp(phone_info['e164'])
        mongo_client.delete_otp(phone_info['local_digits'])
        
        # Generate JWT tokens
        fallback_identifier = user.get('email') or phone_info['digits']
        try:
            access_token = generate_access_token(
                user_id=fallback_identifier,
                email=user.get('email', ''),
                username=user.get('username')
            )
            refresh_token = generate_refresh_token(
                user_id=fallback_identifier,
                email=user.get('email', '')
            )
        except Exception as e:
            logger.error(f"Error generating JWT tokens: {e}")
            return jsonify({'error': 'Authentication error'}), 500
        
        # Update user status
        user_email = user.get('email', fallback_identifier)
        mongo_client.update_user_status(user_email, 'active')
        
        # Return user info (exclude password hash)
        user_info = {k: v for k, v in user.items() if k != 'password_hash'}
        if '_id' in user_info:
            user_info['_id'] = str(user_info['_id'])
        
        return jsonify({
            'success': True,
            'message': 'OTP verified successfully',
            'user': user_info,
            'access_token': access_token,
            'refresh_token': refresh_token,
            'mobile': phone_info['local_digits'],
            'country_code': phone_info['country_code'],
            'formatted_mobile': phone_info['e164']
        }), 200
        
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}", exc_info=True)
        return jsonify({'error': f'Failed to verify OTP: {str(e)}'}), 500


@auth_bp.route('/auth/refresh-token', methods=['POST'])
@require_api_key
def refresh_token():
    """Refresh access token using refresh token."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        refresh_token_value = data.get('refresh_token')
        if not refresh_token_value:
            return jsonify({'error': 'Refresh token is required'}), 400
        
        # Generate new tokens
        new_tokens = refresh_access_token(refresh_token_value)
        
        if not new_tokens:
            return jsonify({'error': 'Invalid or expired refresh token'}), 401
        
        return jsonify({
            'success': True,
            'access_token': new_tokens['access_token'],
            'refresh_token': new_tokens['refresh_token']
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing token: {e}", exc_info=True)
        return jsonify({'error': f'Failed to refresh token: {str(e)}'}), 500

