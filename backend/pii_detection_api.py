"""
PII Detection API Endpoints
Flask blueprints for PII detection operations
"""

import os
import logging
import time
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import tempfile
from functools import lru_cache

# ========== ONLY LABEL-BASED DETECTION ==========
# NO fallback to other detectors!
# NO pii_detector.py, pii_detector_advanced.py, or unified_detector

# Import FORMAT-SPECIFIC TEXT EXTRACTORS (NOT detectors)
try:
    from pii_detector_pdf import PDFPIIDetector
    from pii_detector_txt import TXTPIIDetector
    from pii_detector_docx import DOCXPIIDetector
    TEXT_EXTRACTORS_AVAILABLE = True
except ImportError:
    TEXT_EXTRACTORS_AVAILABLE = False
    logger.error("❌ Text extractors not available!")

# Import LABEL-BASED DETECTOR (ONLY detection method)
try:
    from pii_detector_label_based import label_based_detector
    LABEL_DETECTOR_AVAILABLE = True
except ImportError:
    LABEL_DETECTOR_AVAILABLE = False
    logger.error("❌ Label-based detector not available!")

logger = logging.getLogger(__name__)

# Create blueprint
pii_detection_bp = Blueprint('pii_detection', __name__, url_prefix='/api/pii')

# Configuration
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'doc'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
UPLOAD_FOLDER = tempfile.gettempdir()


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@pii_detection_bp.route('/detect-file', methods=['POST'])
def detect_file():
    """
    Detect PII in uploaded file
    
    DETECTION LOGIC:
    - PDF, TXT, DOCX → LABEL-BASED detection (ONLY)
    - Other formats → Unsupported
    
    Returns:
        json: Detection results with processing_time_ms
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'File type not allowed. Supported: PDF, TXT, DOCX'}), 400
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        try:
            start_time = time.time()  # Track performance
            
            # Get file extension
            file_ext = os.path.splitext(filename)[1].lower()
            
            # CRITICAL: Validate requirements
            if not TEXT_EXTRACTORS_AVAILABLE:
                logger.error("❌ Text extractors not available")
                return jsonify({'error': 'Text extraction modules not available'}), 500
            if not LABEL_DETECTOR_AVAILABLE:
                logger.error("❌ Label-based detector not available")
                return jsonify({'error': 'Label-based detector not available'}), 500
            
            logger.info(f"🔍 Processing {file_ext} file: {filename}")
            logger.info(f"📋 Detection method: LABEL-BASED ONLY")
            
            # STEP 1: Determine file type and extract text
            extracted_text = ""
            file_type = ""
            
            if file_ext == '.pdf':
                file_type = "PDF"
                logger.info(f"📄 PDF detected - extracting text...")
                extracted_text = PDFPIIDetector().extract_text_from_pdf(file_path)
                
            elif file_ext == '.txt':
                file_type = "TXT"
                logger.info(f"📝 TXT detected - extracting text...")
                extracted_text = TXTPIIDetector().extract_text_from_txt(file_path)
                
            elif file_ext in ['.docx', '.doc']:
                file_type = "DOCX"
                logger.info(f"📘 DOCX detected - extracting text...")
                extracted_text = DOCXPIIDetector().extract_text_from_docx(file_path)
                
            else:
                # Unsupported format
                logger.warning(f"⚠️  Unsupported file format: {file_ext}")
                return jsonify({
                    'success': False,
                    'error': f'Unsupported file format: {file_ext}. Only PDF, TXT, DOCX are supported.',
                    'supported_formats': ['PDF', 'TXT', 'DOCX']
                }), 400
            
            # STEP 2: Validate extracted text
            if not extracted_text or len(extracted_text.strip()) < 2:
                logger.warning(f"⚠️  Failed to extract text from {file_type} file")
                return jsonify({
                    'success': False,
                    'error': f'Failed to extract text from {file_type} file',
                    'file': filename,
                    'format': file_type
                }), 400
            
            logger.info(f"✓ Text extracted: {len(extracted_text)} characters")
            
            # STEP 3: LABEL-BASED DETECTION (ONLY METHOD)
            logger.info(f"🎯 Starting LABEL-BASED detection (ONLY)...")
            label_detections = label_based_detector.detect_by_labels(extracted_text)
            logger.info(f"✓ Found {len(label_detections)} PII instances")
            
            # STEP 4: Categorize results
            categorized_by_label = label_based_detector.categorize_by_label(label_detections)
            
            # STEP 5: Calculate metrics
            processing_time = round(time.time() - start_time, 3)
            
            # STEP 6: Prepare response
            result = {
                'success': True,
                'file': filename,
                'format': file_type,
                'total_pii_found': len(label_detections),
                'detections': label_detections,
                'categorized_by_label': categorized_by_label,
                'detection_method': 'LABEL-BASED (ONLY)',
                'extraction_length': len(extracted_text),
                'processing_time_ms': round(processing_time * 1000, 2),
                'status': '✓ Detection complete'
            }
            
            logger.info(f"✅ Detection complete - {len(label_detections)} PII found in {processing_time*1000:.2f}ms")
            
            return jsonify(result), 200
        
        finally:
            # Clean up
            if os.path.exists(file_path):
                os.remove(file_path)
    
    except Exception as e:
        logger.error(f"❌ Error in detect_file: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'detection_method': 'LABEL-BASED'
        }), 500


@pii_detection_bp.route('/detect-batch', methods=['POST'])
def detect_batch():
    """
    Detect PII in multiple files using LABEL-BASED detection ONLY
    
    Returns:
        json: Batch detection results
    """
    return jsonify({'error': 'Batch detection not implemented - use /detect-file for individual files'}), 400


@pii_detection_bp.route('/detect-directory', methods=['POST'])
def detect_directory():
    """
    NOT SUPPORTED - Label-based detection is for individual files only
    
    Returns:
        json: Error message
    """
    return jsonify({'error': 'Directory scanning not supported - use /detect-file for individual files'}), 400


@pii_detection_bp.route('/status', methods=['GET'])
def status():
    """
    Get PII detection API status
    
    Returns:
        json: API status information
    """
    return jsonify({
        'service': 'PII Detection API',
        'status': 'operational',
        'supported_formats': list(ALLOWED_EXTENSIONS),
        'max_file_size_mb': MAX_FILE_SIZE // (1024 * 1024),
        'endpoints': [
            '/api/pii/detect-file',
            '/api/pii/detect-batch',
            '/api/pii/detect-directory',
            '/api/pii/status'
        ]
    }), 200


# Export blueprint
__all__ = ['pii_detection_bp']

