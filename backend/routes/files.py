"""
File upload and processing routes for PII Sentinel backend.
"""
import os
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from mongo_client import mongo_client
from parallel_processor import get_processor
from worker_stub import process_file
from maskers import masker
from utils import (
    save_json, load_json, create_zip, get_timestamp, ensure_dir,
    sanitize_filename, is_pdf_file, is_docx_file, is_doc_file, is_image_file, is_text_file
)
from middleware.security import rate_limit, validate_file_upload, validate_path
from config import config
from shared.auth import require_api_key
from shared.jobs import create_job, get_job, update_job_status, jobs, _jobs_lock
import threading

logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__)


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS


@files_bp.route('/upload', methods=['POST'])
@require_api_key
@rate_limit(max_requests=20, window=60)  # 20 uploads per minute
def upload_files():
    """Upload and process files."""
    try:
        batch_id = request.args.get('batch_id')
        if not batch_id:
            return jsonify({'error': 'batch_id is required'}), 400
        
        # Verify batch exists
        batch = mongo_client.get_batch(batch_id)
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        if 'files[]' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        files = request.files.getlist('files[]')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400
        
        # Validate and process files
        processed_files = []
        errors = []
        
        for file in files:
            if file.filename == '':
                continue
            
            # Validate file
            is_valid, error_msg = validate_file_upload(file)
            if not is_valid:
                errors.append(f"{file.filename}: {error_msg}")
                continue
            
            if not allowed_file(file.filename):
                errors.append(f"{file.filename}: File type not allowed")
                continue
            
            # Secure filename
            filename = secure_filename(file.filename)
            filename = sanitize_filename(filename)
            
            # Save file
            file_path = os.path.join(config.UPLOAD_FOLDER, batch_id, filename)
            ensure_dir(os.path.dirname(file_path))
            file.save(file_path)
            
            # Process file (async)
            processor = get_processor()
            job_id = processor.submit_job(process_file, file_path, batch_id, filename)
            
            processed_files.append({
                'filename': filename,
                'job_id': job_id,
                'status': 'processing'
            })
        
        return jsonify({
            'batch_id': batch_id,
            'files': processed_files,
            'errors': errors if errors else None,
            'message': f'Uploaded {len(processed_files)} file(s)'
        }), 200
    
    except Exception as e:
        logger.error(f"Error uploading files: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@files_bp.route('/download', methods=['GET'])
@require_api_key
def download_file():
    """Download a file."""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'File path is required'}), 400
        
        # Validate path to prevent traversal
        if not validate_path(file_path):
            return jsonify({'error': 'Invalid file path'}), 400
        
        # Ensure path is within storage directory
        abs_path = os.path.abspath(file_path)
        storage_abs = os.path.abspath(config.STORAGE_PATH)
        
        if not abs_path.startswith(storage_abs):
            return jsonify({'error': 'Access denied'}), 403
        
        if not os.path.exists(abs_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(abs_path, as_attachment=True)
    
    except Exception as e:
        logger.error(f"Error downloading file: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

