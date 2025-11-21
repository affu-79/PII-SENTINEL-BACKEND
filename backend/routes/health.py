"""
Health check routes for PII Sentinel backend.
"""
import logging
from flask import Blueprint, jsonify

from mongo_client import mongo_client
from utils import get_timestamp

logger = logging.getLogger(__name__)

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    mongo_status = mongo_client.get_connection_status()
    return jsonify({
        'status': 'healthy',
        'timestamp': get_timestamp(),
        'mongodb': mongo_status
    })

