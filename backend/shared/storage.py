"""
Shared storage utilities for OTP and temporary data.
"""
import threading
import logging

logger = logging.getLogger(__name__)

# OTP storage - Now using MongoDB instead of in-memory
# Keeping in-memory as fallback for backward compatibility
otp_storage: dict = {}
_otp_lock = threading.Lock()

