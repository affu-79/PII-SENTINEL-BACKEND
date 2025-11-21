"""
Utility functions for file handling, JSON operations, and conversions.
Optimized with caching and performance improvements.
"""
import os
import json
import zipfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

# Cache for file type checks
_file_type_cache = {}


def ensure_dir(path: str) -> None:
    """Create directory if it doesn't exist."""
    Path(path).mkdir(parents=True, exist_ok=True)


def save_json(data: Dict[str, Any], filepath: str, indent: int = 2) -> None:
    """Save dictionary to JSON file (optimized)."""
    ensure_dir(os.path.dirname(filepath))
    # Use separators for more compact JSON (faster writes)
    with open(filepath, 'w', encoding='utf-8', buffering=8192) as f:
        json.dump(data, f, indent=indent, ensure_ascii=False, separators=(',', ': '))
    logger.debug(f"Saved JSON to {filepath}")


def load_json(filepath: str) -> Dict[str, Any]:
    """Load JSON file (optimized with buffering)."""
    with open(filepath, 'r', encoding='utf-8', buffering=8192) as f:
        return json.load(f)


def create_zip(files: List[str], zip_path: str, compression_level: int = 6) -> str:
    """Create a zip file from a list of file paths (optimized)."""
    ensure_dir(os.path.dirname(zip_path))
    # Use compression level 6 (balanced speed/compression)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=compression_level) as zipf:
        for file_path in files:
            if os.path.exists(file_path):
                # Use arcname to avoid path issues
                arcname = os.path.basename(file_path)
                zipf.write(file_path, arcname)
    logger.info(f"Created zip file: {zip_path} with {len(files)} files")
    return zip_path


def get_timestamp() -> str:
    """Get ISO format timestamp."""
    return datetime.utcnow().isoformat() + 'Z'


@lru_cache(maxsize=1000)
def get_file_extension(filename: str) -> str:
    """Get file extension in lowercase (cached)."""
    return os.path.splitext(filename)[1].lower()

# Pre-computed sets for faster lookups
_IMAGE_EXTENSIONS = frozenset(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.svg'])
_TEXT_EXTENSIONS = frozenset(['.txt', '.csv', '.json'])

@lru_cache(maxsize=1000)
def is_image_file(filename: str) -> bool:
    """Check if file is an image (cached)."""
    return get_file_extension(filename) in _IMAGE_EXTENSIONS

@lru_cache(maxsize=1000)
def is_pdf_file(filename: str) -> bool:
    """Check if file is a PDF (cached)."""
    return get_file_extension(filename) == '.pdf'

@lru_cache(maxsize=1000)
def is_docx_file(filename: str) -> bool:
    """Check if file is a DOCX (cached)."""
    return get_file_extension(filename) == '.docx'

@lru_cache(maxsize=1000)
def is_doc_file(filename: str) -> bool:
    """Check if file is a DOC (older Word format) (cached)."""
    return get_file_extension(filename) == '.doc'

@lru_cache(maxsize=1000)
def is_text_file(filename: str) -> bool:
    """Check if file is a text file (cached)."""
    return get_file_extension(filename) in _TEXT_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage."""
    # Remove path separators and dangerous characters
    filename = os.path.basename(filename)
    # Replace spaces and special chars with underscores
    safe_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"
    sanitized = ''.join(c if c in safe_chars else '_' for c in filename)
    return sanitized[:255]  # Limit length


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

