"""
Document Context-Aware PII Detection
Intelligently detects document type and only returns relevant PIIs
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DocumentContext:
    """Document context with expected PIIs"""
    doc_type: str
    keywords: List[str]
    expected_piis: List[str]
    max_pii_count: Optional[int] = None


# Government Document Definitions
DOCUMENT_CONTEXTS = {
    "AADHAAR": DocumentContext(
        doc_type="AADHAAR",
        keywords=["aadhaar", "aadhar", "unique identification", "uidai", "government of india"],
        expected_piis=["aadhaar", "phone", "dob"],
        max_pii_count=4  # allow multiple Aadhaar numbers plus common PIIs
    ),
    "PAN": DocumentContext(
        doc_type="PAN",
        keywords=["pan", "permanent account number", "income tax"],
        expected_piis=["pan", "dob", "phone"],
        max_pii_count=3
    ),
    "PASSPORT": DocumentContext(
        doc_type="PASSPORT",
        keywords=["passport", "republic of india", "nationality", "passport no"],
        expected_piis=["passport", "dob"],
        max_pii_count=2
    ),
    "VOTER_ID": DocumentContext(
        doc_type="VOTER_ID",
        keywords=["voter", "election", "elector", "epic no"],
        expected_piis=["voter_id", "dob"],
        max_pii_count=2
    ),
    "DRIVING_LICENSE": DocumentContext(
        doc_type="DRIVING_LICENSE",
        keywords=["driving licence", "driving license", "dl no", "transport"],
        expected_piis=["driving_license", "dob"],
        max_pii_count=2
    ),
    "BANK_STATEMENT": DocumentContext(
        doc_type="BANK_STATEMENT",
        keywords=["bank", "statement", "account", "ifsc", "branch"],
        expected_piis=["bank_account", "ifsc", "phone", "email"],
        max_pii_count=4
    ),
    "GST_CERTIFICATE": DocumentContext(
        doc_type="GST_CERTIFICATE",
        keywords=["gstin", "gst", "goods and services tax"],
        expected_piis=["gstin", "pan", "phone", "email"],
        max_pii_count=4
    ),
    "RATION_CARD": DocumentContext(
        doc_type="RATION_CARD",
        keywords=["ration card", "food", "civil supplies"],
        expected_piis=["ration_card", "aadhaar"],
        max_pii_count=2
    ),
    "MEDICAL_RECORD": DocumentContext(
        doc_type="MEDICAL_RECORD",
        keywords=["hospital", "medical", "patient", "prescription", "doctor"],
        expected_piis=["medical_record_id", "phone", "dob", "aadhaar"],
        max_pii_count=4
    ),
    "INSURANCE_POLICY": DocumentContext(
        doc_type="INSURANCE_POLICY",
        keywords=["insurance", "policy", "premium", "sum assured"],
        expected_piis=["insurance_policy_no", "pan", "phone", "email", "dob"],
        max_pii_count=5
    ),
}


class DocumentClassifier:
    """Classify document type based on extracted text"""
    
    def __init__(self):
        self.contexts = DOCUMENT_CONTEXTS
    
    def classify(self, text: str) -> Optional[DocumentContext]:
        """
        Classify document type from extracted text
        
        Args:
            text: Extracted text from document
        
        Returns:
            DocumentContext if identified, None otherwise
        """
        if not text:
            return None
        
        text_lower = text.lower()
        
        # Score each document type
        scores = {}
        for doc_type, context in self.contexts.items():
            score = 0
            for keyword in context.keywords:
                if keyword.lower() in text_lower:
                    score += 1
            scores[doc_type] = score
        
        # Get highest scoring document type
        if scores:
            max_score = max(scores.values())
            if max_score > 0:
                # Get document type with highest score
                for doc_type, score in scores.items():
                    if score == max_score:
                        logger.info(f"📄 Document classified as: {doc_type} (score: {score})")
                        return self.contexts[doc_type]
        
        logger.info("📄 Document type: GENERIC (no specific classification)")
        return None


class ContextAwarePIIFilter:
    """Filter PIIs based on document context"""
    
    def __init__(self):
        self.classifier = DocumentClassifier()
    
    def normalize_pii_type(self, pii_type: str) -> str:
        """Normalize PII type names"""
        type_map = {
            "AADHAAR": "aadhaar",
            "aadhar": "aadhaar",
            "PAN_CARD": "pan",
            "PAN": "pan",
            "PHONE_NUMBER": "phone",
            "PHONE": "phone",
            "MOBILE": "phone",
            "DOB": "dob",
            "DATE_OF_BIRTH": "dob",
            "PASSPORT_NO": "passport",
            "PASSPORT": "passport",
            "VOTER_ID": "voter_id",
            "EPIC": "voter_id",
            "DRIVING_LICENSE": "driving_license",
            "DL": "driving_license",
            "BANK_ACCOUNT": "bank_account",
            "ACCOUNT_NO": "bank_account",
            "IFSC": "ifsc",
            "GSTIN": "gstin",
            "GST": "gstin",
            "RATION_CARD": "ration_card",
            "MEDICAL_RECORD": "medical_record_id",
            "INSURANCE_POLICY": "insurance_policy_no",
            "EMAIL": "email",
        }
        
        return type_map.get(pii_type.upper(), pii_type.lower())
    
    def deduplicate_exact(self, piis: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove exact duplicates (character-by-character, same PII type)
        Keep only one instance for DISPLAY, but return ALL for masking metadata
        
        Args:
            piis: List of PII matches
        
        Returns:
            Deduplicated list with occurrence metadata
        """
        seen = {}  # key: (type, normalized_value), value: first occurrence
        all_instances = {}  # key: (type, normalized_value), value: list of all instances
        
        for pii in piis:
            pii_type = self.normalize_pii_type(pii.get('type', ''))
            pii_value = pii.get('value', '').strip()
            
            # Normalize value for comparison (remove spaces, dashes)
            normalized = pii_value.replace(' ', '').replace('-', '').replace('_', '').upper()
            
            key = (pii_type, normalized)
            
            if key not in seen:
                # First occurrence
                seen[key] = pii.copy()
                seen[key]['occurrence_count'] = 1
                seen[key]['all_bboxes'] = [pii.get('bbox')] if pii.get('bbox') else []
                all_instances[key] = [pii]
            else:
                # Duplicate found
                seen[key]['occurrence_count'] += 1
                if pii.get('bbox'):
                    seen[key]['all_bboxes'].append(pii.get('bbox'))
                all_instances[key].append(pii)
        
        result = list(seen.values())
        
        logger.info(f"🔄 Exact deduplication: {len(piis)} → {len(result)} unique PIIs")
        
        # Store all instances for masking
        for pii in result:
            key = (self.normalize_pii_type(pii.get('type', '')), 
                   pii.get('value', '').replace(' ', '').replace('-', '').replace('_', '').upper())
            if key in all_instances:
                pii['all_instances'] = all_instances[key]
        
        return result
    
    def filter_by_context(
        self,
        piis: List[Dict[str, Any]],
        extracted_text: str
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Filter PIIs based on document context
        
        Args:
            piis: All detected PIIs
            extracted_text: Full extracted text from document
        
        Returns:
            (filtered_piis, document_type)
        """
        # Step 1: Classify document
        context = self.classifier.classify(extracted_text)
        
        if not context:
            # Generic document - return all PIIs (with deduplication)
            logger.info("📋 Generic document: returning all detected PIIs")
            deduplicated = self.deduplicate_exact(piis)
            return deduplicated, "GENERIC"
        
        # Step 2: Normalize PII types
        for pii in piis:
            pii['type'] = self.normalize_pii_type(pii.get('type', ''))
        
        # Step 3: Filter by expected PIIs
        expected_types = set(context.expected_piis)
        filtered = [pii for pii in piis if pii.get('type', '').lower() in expected_types]
        
        logger.info(f"📊 Context filter: {len(piis)} → {len(filtered)} PIIs (expected types: {context.expected_piis})")
        
        # Step 4: Deduplicate exact matches
        deduplicated = self.deduplicate_exact(filtered)
        
        # Step 5: Limit to max PII count (keep highest confidence)
        if context.max_pii_count is not None and len(deduplicated) > context.max_pii_count:
            logger.warning(f"⚠️ Found {len(deduplicated)} PIIs but max is {context.max_pii_count}, keeping top {context.max_pii_count} by confidence")
            deduplicated = sorted(deduplicated, key=lambda x: x.get('confidence', 0), reverse=True)[:context.max_pii_count]
        
        # Step 6: Reorder according to expected PII priority
        ordered_results = []
        seen_indices = set()
        for expected_type in context.expected_piis:
            for idx, pii in enumerate(deduplicated):
                if idx in seen_indices:
                    continue
                if pii.get('type') == expected_type:
                    ordered_results.append(pii)
                    seen_indices.add(idx)
        # Append any remaining PIIs (unlikely) to ensure nothing gets lost
        for idx, pii in enumerate(deduplicated):
            if idx not in seen_indices:
                ordered_results.append(pii)
        deduplicated = ordered_results
        
        logger.info(f"✅ Final result: {len(deduplicated)} unique PIIs for {context.doc_type}")
        
        # Log PII types found
        types_found = [pii.get('type') for pii in deduplicated]
        logger.info(f"   PII types: {', '.join(types_found)}")
        
        # Log occurrence counts
        for pii in deduplicated:
            if pii.get('occurrence_count', 1) > 1:
                logger.info(f"   - {pii.get('type')}: {pii.get('occurrence_count')} occurrences")
            # Add document type to each PII for later retrieval
            pii['document_type'] = context.doc_type
        
        return deduplicated, context.doc_type
    
    def get_all_masking_instances(self, pii: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Get all instances of a PII for masking (including duplicates)
        
        Args:
            pii: PII dictionary with 'all_instances' metadata
        
        Returns:
            List of all PII instances to mask
        """
        return pii.get('all_instances', [pii])


# Singleton instance
_filter_instance = None


def get_context_aware_filter():
    """Get or create context-aware PII filter instance"""
    global _filter_instance
    if _filter_instance is None:
        _filter_instance = ContextAwarePIIFilter()
    return _filter_instance

