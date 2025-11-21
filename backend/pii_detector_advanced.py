"""
Ultra-Fast Advanced PII Detection System
Optimized context-aware detection with maximum speed.
"""
import re
import logging
import time
from typing import List, Dict, Any, Tuple, Optional
from functools import lru_cache

from pii_detector import (
    verhoeff_check, luhn_check, PATTERNS,
    PIIDetector as BasePIIDetector
)

logger = logging.getLogger(__name__)


class ContextAwarePIIDetector:
    """
    Ultra-fast context-aware PII detector.
    Uses optimized single-pass scanning with context hints.
    """
    
    def __init__(self):
        """Initialize with base detector."""
        self.base_detector = BasePIIDetector()
        # Use patterns from base detector to ensure consistency
        self.patterns = self.base_detector.patterns
        
        # Fast context keyword lookup (pre-compiled)
        self.context_keywords = {
            "aadhaar": re.compile(r'\b(?:aadhaar|aadhar|uid)\b', re.IGNORECASE),
            "pan": re.compile(r'\b(?:pan|permanent\s+account)\b', re.IGNORECASE),
            "passport": re.compile(r'\b(?:passport)\b', re.IGNORECASE),
            "voter_id": re.compile(r'\b(?:voter|epic)\b', re.IGNORECASE),
            "driving_license": re.compile(r'\b(?:driving|dl)\b', re.IGNORECASE),
            "bank_account": re.compile(r'\b(?:account|a/c|acct)\b', re.IGNORECASE),
            "ifsc": re.compile(r'\b(?:ifsc)\b', re.IGNORECASE),
            "upi": re.compile(r'\b(?:upi|vpa)\b', re.IGNORECASE),
            "phone": re.compile(r'\b(?:phone|mobile|tel|contact)\b', re.IGNORECASE),
            "email": re.compile(r'\b(?:email|e-mail|mail)\b', re.IGNORECASE),
            "dob": re.compile(r'\b(?:dob|date\s+of\s+birth|birth\s+date|born|d\.o\.b)\b', re.IGNORECASE),
            "address": re.compile(r'\b(?:address|residence|location|addr)\b', re.IGNORECASE),
            "card_number": re.compile(r'\b(?:card|card\s+number|card\s+no)\b', re.IGNORECASE),
            "cvv": re.compile(r'\b(?:cvv|cvc)\b', re.IGNORECASE),
            "employee_id": re.compile(r'\b(?:employee|emp|staff)\b', re.IGNORECASE),
            "transaction_id": re.compile(r'\b(?:transaction|txn|reference)\b', re.IGNORECASE),
        }
        
        # Stats
        self.stats = {
            'scans': 0,
            'total_time': 0.0,
            'pii_found': 0
        }
        
        logger.info("Advanced Context-Aware PII Detector initialized")
    
    def _calculate_confidence_fast(self, pii_type: str, value: str, normalized: str) -> float:
        """Fast confidence calculation."""
        from pii_detector import _CONFIDENCE_MAP, verhoeff_check, luhn_check
        
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
    
    def _has_context(self, text: str, start: int, end: int, pii_type: str) -> bool:
        """Fast context check - look 100 chars around match."""
        context_start = max(0, start - 100)
        context_end = min(len(text), end + 100)
        context = text[context_start:context_end]
        
        pattern = self.context_keywords.get(pii_type)
        if pattern:
            return bool(pattern.search(context))
        return False
    
    def scan_text_advanced(self, text: str) -> List[Dict[str, Any]]:
        """
        Ultra-fast context-aware scanning.
        Single-pass with context boost for confidence.
        """
        if not text or len(text.strip()) < 2:
            return []
        
        start_time = time.time()
        results = []
        seen_positions = set()  # (start, end, type) for fast lookup
        
        # Single pass: scan all patterns
        for pii_type, pattern in self.patterns.items():
            for match in pattern.finditer(text):
                start_pos = match.start()
                end_pos = match.end()
                
                # Extract value
                val = match.group(1) if match.groups() and match.group(1) else match.group(0)
                val_stripped = val.strip()
                
                if len(val_stripped) < 2:
                    continue
                
                # Check if already seen at this position
                pos_key = (start_pos, end_pos, pii_type.upper())
                if pos_key in seen_positions:
                    continue
                
                # Normalize
                norm = re.sub(r'\s+', '', val)
                
                # Calculate base confidence
                conf = self._calculate_confidence_fast(pii_type, val, norm)
                
                # Context boost: if context keyword nearby, increase confidence
                if self._has_context(text, start_pos, end_pos, pii_type):
                    conf = min(0.95, conf + 0.1)
                
                # Filter low-confidence context-dependent types
                if conf < 0.5 and pii_type in ("address", "username", "password"):
                    if not self._has_context(text, start_pos, end_pos, pii_type):
                        continue
                
                result = {
                    "type": pii_type.upper(),
                    "match": val,
                    "normalized": norm,
                    "confidence": round(conf, 2),
                    "start": start_pos,
                    "end": end_pos,
                    "context": self._has_context(text, start_pos, end_pos, pii_type)
                }
                
                results.append(result)
                seen_positions.add(pos_key)
        
        # Fast deduplication
        unique_results = self.base_detector._deduplicate_fast(results)
        
        elapsed = time.time() - start_time
        self.stats['scans'] += 1
        self.stats['total_time'] += elapsed
        self.stats['pii_found'] += len(unique_results)
        
        logger.debug(f"Advanced scan: {len(unique_results)} PIIs in {elapsed:.3f}s")
        
        return unique_results
    
    def detect_pii(self, text: str, page_num: int = 0, bbox: Optional[Tuple[int, int, int, int]] = None) -> List[Dict[str, Any]]:
        """
        Main detection interface compatible with existing codebase.
        """
        scan_results = self.scan_text_advanced(text)
        
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
            
            if item.get('context'):
                result['context'] = True
            
            results.append(result)
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        avg_time = self.stats['total_time'] / self.stats['scans'] if self.stats['scans'] > 0 else 0
        return {
            **self.stats,
            'avg_scan_time': round(avg_time, 3),
            'patterns': len(self.patterns)
        }


# Global instance
advanced_pii_detector = ContextAwarePIIDetector()
