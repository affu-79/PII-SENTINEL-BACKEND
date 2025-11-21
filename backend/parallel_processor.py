import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Callable, Optional

from performance_config import perf_config
try:
    from worker_stub import process_file as pii_process_file
except ImportError:
    try:
        from pii_detector import process_file as pii_process_file
    except ImportError:
        raise ImportError("Could not import process_file from worker_stub or pii_detector")

logger = logging.getLogger(__name__)

class ParallelProcessor:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=perf_config.MAX_IO_WORKERS)

    def process_batch(
        self,
        files: List[Dict[str, Any]],
        callback: Optional[Callable] = None
    ) -> List[Dict[str, Any]]:
        """
        Processes a batch of files with high concurrency.
        Submits all file processing tasks at once and processes results as they complete.
        """
        total_files = len(files)
        if total_files == 0:
            return []

        logger.info(f"Starting batch processing for {total_files} files with {perf_config.MAX_IO_WORKERS} workers.")
        
        futures = {self.executor.submit(pii_process_file, file_info): file_info for file_info in files}
        results = []
        completed_count = 0
        start_time = time.time()

        for future in as_completed(futures):
            file_info = futures[future]
            filename = file_info.get('filename', 'unknown')
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing file {filename}: {e}", exc_info=True)
                results.append({'filename': filename, 'success': False, 'error': str(e)})
            
            completed_count += 1
            if callback:
                elapsed = time.time() - start_time
                avg_time = elapsed / completed_count
                eta = (total_files - completed_count) * avg_time
                callback(completed_count, total_files, filename, int(eta))
        
        logger.info(f"Finished batch processing. Total time: {time.time() - start_time:.2f}s")
        return results

    def shutdown(self):
        self.executor.shutdown(wait=True)

# Global instance
_processor = None

def get_processor():
    global _processor
    if _processor is None:
        _processor = ParallelProcessor()
    return _processor
