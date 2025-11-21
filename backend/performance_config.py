"""
Performance optimization configuration for high-volume file processing.
Enables ultra-fast processing of 1000+ files with optimized parallel execution.
"""
import os
import multiprocessing

# Simplified and aggressive performance settings for maximum throughput.
# These values are set high to prioritize speed.

class PerformanceConfig:
    # ============================================================================
    # Core Parallel Processing Settings
    # ============================================================================
    CPU_COUNT = multiprocessing.cpu_count()

    # Aggressively high worker counts for I/O and CPU tasks.
    MAX_IO_WORKERS = int(os.getenv('MAX_IO_WORKERS', 200))
    MAX_CPU_WORKERS = int(os.getenv('MAX_CPU_WORKERS', CPU_COUNT * 4))
    MAX_CONCURRENT_FILES = int(os.getenv('MAX_CONCURRENT_FILES', 256))

    # ============================================================================
    # OCR and PII Detection Settings
    # ============================================================================
    OCR_QUANTIZED = os.getenv('OCR_QUANTIZED', 'True').lower() == 'true'
    USE_GPU_OCR = os.getenv('USE_GPU_OCR', 'false').lower() == 'true'
    PDF_DPI = int(os.getenv('PDF_DPI', 150)) # Lower DPI for faster processing
    REGEX_CACHING = os.getenv('REGEX_CACHING', 'True').lower() == 'true'
    SMART_TYPE_DETECTION = os.getenv('SMART_TYPE_DETECTION', 'True').lower() == 'true'

    # ============================================================================
    # Error Handling and Timeouts
    # ============================================================================
    FILE_TIMEOUT = int(os.getenv('FILE_TIMEOUT', 45)) # Shorter timeout per file
    JOB_TIMEOUT = int(os.getenv('JOB_TIMEOUT', 3600))
    RETRY_ATTEMPTS = int(os.getenv('RETRY_ATTEMPTS', 1)) # Reduce retries to fail faster
    
    # ============================================================================
    # Caching & Network
    # ============================================================================
    REDIS_CACHING = os.getenv('REDIS_CACHING', 'false').lower() == 'true'
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')

perf_config = PerformanceConfig()

