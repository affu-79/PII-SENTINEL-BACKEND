"""
Shared job storage and management utilities.
"""
import threading
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory job storage (for real-time processing)
# Use thread-safe dict for concurrent access
jobs: Dict[str, Dict[str, Any]] = {}
_jobs_lock = threading.Lock()


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job by ID."""
    with _jobs_lock:
        return jobs.get(job_id)


def update_job_status(job_id: str, status: str, **kwargs) -> bool:
    """Update job status and additional fields."""
    with _jobs_lock:
        if job_id in jobs:
            jobs[job_id]['status'] = status
            jobs[job_id].update(kwargs)
            jobs[job_id]['updated_at'] = datetime.utcnow().isoformat()
            return True
        return False


def create_job(job_id: str, batch_id: str, file_infos: list) -> Dict[str, Any]:
    """Create a new job."""
    import time
    from utils import get_timestamp
    
    job = {
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
            'eta_seconds': len(file_infos) * 5  # Initial estimate
        }
    }
    
    with _jobs_lock:
        jobs[job_id] = job
    
    return job

