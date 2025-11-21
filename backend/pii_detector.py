"""
Ultra-Fast PII Detection System
Optimized for maximum speed and accuracy with single-pass scanning.
"""
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# ==========================================================
# VALIDATION UTILITIES (Optimized)
# ==========================================================

# Pre-computed Verhoeff tables for Aadhaar validation
_VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5], [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7], [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3], [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
]
_VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4], [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7], [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
]

@lru_cache(maxsize=1000)
def verhoeff_check(num: str) -> bool:
    """Fast Aadhaar validation with caching."""
    digits = ''.join(c for c in num if c.isdigit())
    if len(digits) != 12:
        return False
    c = 0
    for i, d in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(d)]]
    return c == 0

@lru_cache(maxsize=1000)
def luhn_check(num: str) -> bool:
    """Fast Luhn checksum validation with caching."""
    digits = [int(c) for c in num if c.isdigit()]
    if len(digits) < 14:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0

# ==========================================================
# OPTIMIZED REGEX PATTERNS (Single-pass, efficient)
# ==========================================================

PATTERNS = {
    # Government IDs (High priority, high confidence)
    "aadhaar": re.compile(r'\b(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d{12})\b', re.IGNORECASE),
    "pan": re.compile(r'\b([A-Z]{5}\d{4}[A-Z])\b'),
    "passport": re.compile(r'\b([A-Z]\d{7})\b'),
    "voter_id": re.compile(r'\b([A-Z]{3}\d{7})\b'),  # Specific format: 3 letters + 7 digits
    "driving_license": re.compile(r'\b([A-Z]{2}\s*\d{2}\s*\d{4,11}|\w{2}\d{13})\b'),
    "ifsc": re.compile(r'\b([A-Z]{4}0[A-Z0-9]{6})\b'),
    "gstin": re.compile(r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b'),
    "cin": re.compile(r'\b([LUCFWB]\d{5}[A-Z]{2}\d{4}PTC\d{6})\b'),
    "epf": re.compile(r'\b([A-Z]{2}\d{7,10})\b'),  # More specific: 2 letters + 7-10 digits
    "ration_card": re.compile(r'\b([A-Z]{2}\d{10,12})\b'),  # More specific: 2 letters + 10-12 digits
    
    # Financial (High priority)
    "card_number": re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}|\d{15,19}\b'),
    # CVV removed from general scan - requires context
    "card_expiry": re.compile(r'\b((?:0[1-9]|1[0-2])[/\-\s]?(?:\d{2}|\d{4}))\b'),
    "bank_account": re.compile(r'\b(\d{10,18})\b'),
    "upi": re.compile(r'\b([A-Za-z0-9._\-]{2,256}@(?!gmail\.com|yahoo\.(?:com|in|co\.in)|outlook\.com|hotmail\.(?:com|in))[a-z0-9._\-]{2,64})\b', re.IGNORECASE),
    
    # Contact Info
    "email": re.compile(r'\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b'),
    "phone": re.compile(r'\b(?:\+91[\-\s]?|91[\-\s]?|0)?([6-9]\d{9})\b'),
    "pincode": re.compile(r'\b(\d{6})\b'),
    
    # Dates
    "dob": re.compile(r'\b([0-3]?\d[\/\-\.\s][0-1]?\d[\/\-\.\s](?:\d{4}|\d{2}))\b'),
    
    # Technical IDs
    "imei": re.compile(r'\b(\d{14,16})\b'),
    "ipv4": re.compile(r'\b(?:(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)(?:\d{1,3}\.){2}\d{1,3}|(?:\d{1,3}\.){3}\d{1,3})\b'),
    "ipv6": re.compile(r'\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b'),
    "mac": re.compile(r'\b([0-9A-Fa-f]{2}(?:[:\-][0-9A-Fa-f]{2}){5})\b'),
    "api_key": re.compile(r'\b([A-Za-z0-9\-_]{16,128})\b'),
    
    # Custom CSV PIIs (Structured IDs - High confidence)
    "employee_id": re.compile(r'\b(EMP\d{4})\b'),
    "student_roll": re.compile(r'\b(SR(?:202[0-4])\d{5})\b'),
    "transaction_id": re.compile(r'\b(TXN\d{8})\b'),
    "customer_id": re.compile(r'\b(CUST\d{6})\b'),
    "order_id": re.compile(r'\b(ORD\d{8})\b'),
    "medical_record_id": re.compile(r'\b(MR\d{6})\b'),
    "insurance_policy_no": re.compile(r'\b(IP\d{8})\b'),
    "vehicle_reg_no": re.compile(r'\b([A-Z]{2}\d{2}\s?[A-Z]{2}\s?\d{4})\b'),
    "tax_record": re.compile(r'\b(TAX\d{7})\b'),
    "membership_id": re.compile(r'\b(MID\d{5})\b'),
    "project_code": re.compile(r'\b(PRJ\d{4})\b'),
    "referral_code": re.compile(r'\b([A-Z0-9]{6})\b'),
    "license_key": re.compile(r'\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b'),
    "device_id": re.compile(r'\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b', re.IGNORECASE),
    "session_token": re.compile(r'\b([0-9a-f]{32})\b', re.IGNORECASE),
    "salary": re.compile(r'\b(₹\d{1,3}(?:,\d{2,3})*)\b'),
    "gps": re.compile(r'\b((?:[6-9]|[12][0-9]|3[0-7])\.[0-9]{1,6},(?:[6-8][0-9]|9[0-7])\.[0-9]{1,6})\b'),
    
    # Other
    # Removed username and password - too many false positives
    # These should only be detected with explicit context
    "email_domain": re.compile(r'@\b([A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b'),
    "social_handle": re.compile(r'@\b([A-Za-z0-9._]{1,50})\b'),
}

# Pre-compiled whitespace removal
_WHITESPACE_PATTERN = re.compile(r'\s+')

# Confidence mapping (pre-computed for speed)
_CONFIDENCE_MAP = {
    "aadhaar": 0.95, "pan": 0.9, "passport": 0.9, "voter_id": 0.85,
    "driving_license": 0.85, "ifsc": 0.9, "gstin": 0.9, "cin": 0.9,
    "epf": 0.8, "ration_card": 0.8,     "card_number": 0.85,
    "card_expiry": 0.85, "bank_account": 0.75, "upi": 0.8, "email": 0.85,
    "phone": 0.8, "pincode": 0.8, "dob": 0.75, "imei": 0.8, "ipv4": 0.7,
    "ipv6": 0.7, "mac": 0.7, "api_key": 0.7, "employee_id": 0.9,
    "student_roll": 0.9, "transaction_id": 0.9, "customer_id": 0.9,
    "order_id": 0.9, "medical_record_id": 0.9, "insurance_policy_no": 0.9,
    "vehicle_reg_no": 0.85, "tax_record": 0.9, "membership_id": 0.9,
    "project_code": 0.9, "referral_code": 0.85, "license_key": 0.85,
    "device_id": 0.75, "session_token": 0.75, "salary": 0.7, "gps": 0.6,
    "email_domain": 0.5, "social_handle": 0.5,
}

# Priority order for scanning (high-confidence first)
_PRIORITY_ORDER = [
    "aadhaar", "pan", "ifsc", "gstin", "cin", "passport", "voter_id",
    "driving_license", "epf", "ration_card",     "card_number",
    "card_expiry", "bank_account", "upi", "email", "phone", "pincode",
    "employee_id", "student_roll", "transaction_id", "customer_id",
    "order_id", "medical_record_id", "insurance_policy_no", "tax_record",
    "membership_id", "project_code", "vehicle_reg_no", "referral_code",
    "license_key", "device_id", "session_token", "salary", "gps",
    "imei", "ipv4", "ipv6", "mac", "api_key", "dob",
    "email_domain", "social_handle",
]


class PIIDetector:
    """Ultra-fast PII Detector with single-pass scanning."""
    
    def __init__(self):
        """Initialize detector with pre-compiled patterns."""
        self.patterns = PATTERNS
        logger.info(f"PII Detector initialized with {len(PATTERNS)} patterns")
    
    def _normalize(self, text: str) -> str:
        """Fast normalization - remove whitespace."""
        return _WHITESPACE_PATTERN.sub('', text)
    
    def _calculate_confidence(self, pii_type: str, value: str, normalized: str) -> float:
        """Fast confidence calculation with validation."""
        base_conf = _CONFIDENCE_MAP.get(pii_type, 0.5)
        
        # Validation-based confidence boost
        if pii_type == "aadhaar":
            digits = ''.join(c for c in normalized if c.isdigit())
            if len(digits) == 12:
                if verhoeff_check(digits):
                    return 0.95
                return 0.7
        
        elif pii_type == "card_number":
            digits = ''.join(c for c in normalized if c.isdigit())
            if len(digits) >= 15:
                if luhn_check(digits):
                    return 0.9
                return 0.6
        
        elif pii_type == "imei":
            digits = ''.join(c for c in normalized if c.isdigit())
            if len(digits) >= 14:
                if luhn_check(digits):
                    return 0.85
                return 0.6
        
        elif pii_type == "upi":
            if '@' in value:
                domain = value.split('@')[1].lower()
                email_domains = {'gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com'}
                if any(ed in domain for ed in email_domains) or '.com' in domain or '.in' in domain:
                    return 0.2
                return 0.85
        
        return base_conf
    
    def scan_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Ultra-fast single-pass PII detection.
        Returns list of dicts: {type, match, normalized, confidence, start, end}
        """
        if not text or len(text.strip()) < 2:
            return []
        
        results = []
        seen_positions = {}  # (start, end) -> (type, normalized, confidence)
        
        # Single pass through all patterns
        for pii_type in _PRIORITY_ORDER:
            if pii_type not in self.patterns:
                continue
            
            pattern = self.patterns[pii_type]
            
            for match in pattern.finditer(text):
                start_pos = match.start()
                end_pos = match.end()
                
                # Extract value
                val = match.group(1) if match.groups() and match.group(1) else match.group(0)
                val_stripped = val.strip()
                
                # Skip if too short
                if len(val_stripped) < 2:
                    continue
                
                # Normalize
                norm = self._normalize(val)
                norm_lower = norm.lower()
                
                # Calculate confidence first
                conf = self._calculate_confidence(pii_type, val, norm)
                
                # Check for duplicates at same position
                pos_key = (start_pos, end_pos)
                if pos_key in seen_positions:
                    existing_type, existing_norm, existing_conf = seen_positions[pos_key]
                    # Skip if same normalized value (cross-type duplicate)
                    if existing_norm.lower() == norm_lower:
                        continue
                    # If different types at same position, keep higher confidence
                    if conf <= existing_conf:
                        continue
                    # Remove existing lower-confidence match
                    results = [r for r in results if not (r['start'] == start_pos and r['end'] == end_pos)]
                
                # Filter false positives
                # Skip if it's a common word (too short or common patterns)
                if len(val_stripped) < 3:
                    continue
                
                # Skip if it's just numbers and too short (likely not PII)
                if val_stripped.isdigit() and len(val_stripped) < 6 and pii_type not in ("pincode"):
                    continue
                
                # Skip CVV-like numbers that are part of longer numbers (like Aadhaar)
                if val_stripped.isdigit() and len(val_stripped) == 4:
                    # Check if it's part of a longer number nearby
                    if start_pos > 0 and end_pos < len(text):
                        before = text[max(0, start_pos-5):start_pos]
                        after = text[end_pos:min(len(text), end_pos+5)]
                        if (before.rstrip().isdigit() or after.lstrip().isdigit()):
                            continue
                
                # Skip voter_id matches that are actually phone numbers or transaction IDs
                if pii_type == "voter_id":
                    # If it matches phone pattern, skip
                    if re.match(r'^[6-9]\d{9}$', val_stripped):
                        continue
                    # If it matches transaction ID pattern, skip
                    if val_stripped.startswith('TXN') and len(val_stripped) == 11:
                        continue
                    # If it matches employee ID pattern, skip
                    if val_stripped.startswith('EMP') and len(val_stripped) == 7:
                        continue
                
                # Skip bank_account matches that are phone numbers (10 digits starting with 6-9)
                if pii_type == "bank_account":
                    if re.match(r'^[6-9]\d{9}$', val_stripped):
                        continue
                
                # Skip common words that match patterns
                common_words = {'my', 'is', 'id', 'no', 'pan', 'email', 'phone', 'upi', 'ifsc', 'aadhaar'}
                if val_stripped.lower() in common_words:
                    continue
                
                # Store result
                result = {
                    "type": pii_type.upper(),
                    "match": val,
                    "normalized": norm,
                    "confidence": round(conf, 2),
                    "start": start_pos,
                    "end": end_pos
                }
                
                results.append(result)
                seen_positions[pos_key] = (pii_type, norm, conf)
        
        # Fast deduplication: remove same type + normalized at nearby positions
        return self._deduplicate_fast(results)
    
    def _deduplicate_fast(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fast O(n) deduplication."""
        if not results:
            return []
        
        # Sort by confidence (desc) then position
        results.sort(key=lambda x: (-x['confidence'], x['start']))
        
        unique = []
        seen = {}  # (type, normalized) -> last position
        
        for result in results:
            key = (result['type'], result['normalized'].lower())
            start, end = result['start'], result['end']
            
            if key in seen:
                last_start, last_end = seen[key]
                # Check if overlapping or too close (within 20 chars)
                overlap = max(0, min(last_end, end) - max(last_start, start))
                distance = abs(last_start - start)
                
                if overlap > 0 or distance < 20:
                    continue  # Skip duplicate
            
            unique.append(result)
            seen[key] = (start, end)
        
        # Sort by position for final output
        unique.sort(key=lambda x: x['start'])
        return unique
    
    def detect_pii(self, text: str, page_num: int = 0, bbox: Optional[Tuple[int, int, int, int]] = None) -> List[Dict[str, Any]]:
        """
        Main detection interface.
        Returns list of PII detections compatible with existing codebase.
        """
        scan_results = self.scan_text(text)
        
        # Convert to expected format
        results = []
        for item in scan_results:
            result = {
                'type': item['type'],
                'value': item['match'],
                'normalized': item.get('normalized', item['match']),
                'start': item.get('start', 0),
                'end': item.get('end', 0),
                'page': page_num,
                'confidence': item.get('confidence', 0.8)
            }
            
            if bbox:
                result['bbox'] = bbox
            
            results.append(result)
        
        return results
    
    def validate_aadhaar(self, aadhaar: str) -> bool:
        """Validate Aadhaar using Verhoeff algorithm."""
        return verhoeff_check(aadhaar)
    
    def validate_pan(self, pan: str) -> bool:
        """Validate PAN format."""
        return bool(re.match(r'^[A-Z]{5}\d{4}[A-Z]$', pan.strip()))


# Global instance
pii_detector = PIIDetector()
