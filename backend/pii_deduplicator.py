"""
PII Deduplication Module
Remove duplicate PIIs but keep all bounding boxes for masking
"""

import logging
from typing import List, Dict, Any, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


def normalize_pii_value(value: str, pii_type: str) -> str:
    """
    Normalize PII value for comparison
    Remove spaces, hyphens, and convert to lowercase
    """
    if not value:
        return ""
    
    # Remove common separators
    normalized = value.replace(" ", "").replace("-", "").replace("_", "")
    
    # For specific PII types, apply additional normalization
    if pii_type.upper() == "AADHAAR":
        # Remove all non-digits
        normalized = ''.join(c for c in normalized if c.isdigit())
    elif pii_type.upper() == "PHONE":
        # Remove country code prefixes
        normalized = ''.join(c for c in normalized if c.isdigit())
        if normalized.startswith("91") and len(normalized) > 10:
            normalized = normalized[-10:]  # Keep last 10 digits
    elif pii_type.upper() in ["EMAIL", "UPI"]:
        normalized = normalized.lower()
    
    return normalized


def deduplicate_piis(pii_matches: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Deduplicate PIIs for display while keeping all instances for masking
    
    Args:
        pii_matches: List of PII matches with duplicates
    
    Returns:
        (display_piis, all_piis_for_masking)
        - display_piis: Deduplicated list for showing in table (unique values)
        - all_piis_for_masking: Original list with all duplicates for masking
    """
    
    # Keep all PIIs for masking (no deduplication)
    all_piis_for_masking = pii_matches.copy()
    
    # Create deduplicated list for display
    seen_piis = {}  # key: (type, normalized_value), value: first occurrence
    display_piis = []
    duplicate_count = defaultdict(int)
    
    for pii in pii_matches:
        pii_type = pii.get('type', 'UNKNOWN')
        pii_value = pii.get('value', '')
        
        # Normalize the value
        normalized_value = normalize_pii_value(pii_value, pii_type)
        
        # Create unique key
        key = (pii_type.upper(), normalized_value)
        
        if key not in seen_piis:
            # First occurrence - add to display list
            seen_piis[key] = pii
            
            # Add occurrence count field
            pii_copy = pii.copy()
            pii_copy['occurrence_count'] = 1
            pii_copy['is_deduplicated'] = False
            display_piis.append(pii_copy)
        else:
            # Duplicate found - increment count
            duplicate_count[key] += 1
            
            # Update the occurrence count in the display list
            for display_pii in display_piis:
                if (display_pii.get('type', '').upper(), 
                    normalize_pii_value(display_pii.get('value', ''), display_pii.get('type', ''))) == key:
                    display_pii['occurrence_count'] = display_pii.get('occurrence_count', 1) + 1
                    display_pii['is_deduplicated'] = True
                    break
    
    # Log deduplication results
    total_original = len(pii_matches)
    total_unique = len(display_piis)
    total_duplicates = total_original - total_unique
    
    if total_duplicates > 0:
        logger.info(f"🔄 Deduplicated PIIs: {total_original} → {total_unique} unique ({total_duplicates} duplicates removed from display)")
        
        # Log duplicate types
        for (pii_type, _), count in duplicate_count.items():
            logger.info(f"   - {pii_type}: {count} duplicate(s) found")
    
    return display_piis, all_piis_for_masking


def filter_redundant_piis(pii_matches: List[Dict[str, Any]], confidence_threshold: float = 0.7) -> List[Dict[str, Any]]:
    """
    Filter out low-confidence and redundant PIIs
    
    Args:
        pii_matches: List of PII matches
        confidence_threshold: Minimum confidence to keep (default: 0.7)
    
    Returns:
        Filtered list of PIIs
    """
    
    # Filter by confidence
    filtered = [
        pii for pii in pii_matches
        if pii.get('confidence', 0) >= confidence_threshold
    ]
    
    # Log filtering results
    removed = len(pii_matches) - len(filtered)
    if removed > 0:
        logger.info(f"🗑️ Filtered out {removed} low-confidence PIIs (threshold: {confidence_threshold})")
    
    return filtered


def remove_substring_duplicates(pii_matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove PIIs that are substrings of other PIIs of the same type
    Example: If "1234 5678 9012" and "1234-5678-9012" are both detected as AADHAAR,
             keep only one (preferably with higher confidence)
    
    Args:
        pii_matches: List of PII matches
    
    Returns:
        List with substring duplicates removed
    """
    
    # Group by type
    by_type = defaultdict(list)
    for pii in pii_matches:
        by_type[pii.get('type', 'UNKNOWN').upper()].append(pii)
    
    result = []
    removed_count = 0
    
    for pii_type, piis in by_type.items():
        if len(piis) <= 1:
            result.extend(piis)
            continue
        
        # Sort by confidence (highest first) and length (longest first)
        piis_sorted = sorted(
            piis,
            key=lambda x: (x.get('confidence', 0), len(x.get('value', ''))),
            reverse=True
        )
        
        kept = []
        for pii in piis_sorted:
            normalized_value = normalize_pii_value(pii.get('value', ''), pii_type)
            
            # Check if this value is a substring of any already kept value
            is_substring = False
            for kept_pii in kept:
                kept_normalized = normalize_pii_value(kept_pii.get('value', ''), pii_type)
                
                if normalized_value in kept_normalized and normalized_value != kept_normalized:
                    is_substring = True
                    removed_count += 1
                    logger.debug(f"   Removed substring: {pii.get('value')} (contained in {kept_pii.get('value')})")
                    break
            
            if not is_substring:
                kept.append(pii)
        
        result.extend(kept)
    
    if removed_count > 0:
        logger.info(f"🗑️ Removed {removed_count} substring duplicate(s)")
    
    return result


def smart_pii_deduplication(
    pii_matches: List[Dict[str, Any]],
    confidence_threshold: float = 0.7,
    remove_substrings: bool = True
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Complete smart PII deduplication pipeline
    
    Steps:
    1. Filter low-confidence PIIs
    2. Remove substring duplicates
    3. Deduplicate for display (keep all for masking)
    
    Args:
        pii_matches: Original PII matches
        confidence_threshold: Minimum confidence (default: 0.7)
        remove_substrings: Whether to remove substring duplicates (default: True)
    
    Returns:
        (display_piis, masking_piis)
    """
    
    logger.info(f"🔍 Starting smart deduplication: {len(pii_matches)} PIIs")
    
    # Step 1: Filter low-confidence
    filtered = filter_redundant_piis(pii_matches, confidence_threshold)
    
    # Step 2: Remove substring duplicates
    if remove_substrings:
        filtered = remove_substring_duplicates(filtered)
    
    # Step 3: Deduplicate for display (keep all for masking)
    display_piis, masking_piis = deduplicate_piis(filtered)
    
    logger.info(f"✅ Deduplication complete: {len(display_piis)} unique PIIs for display, {len(masking_piis)} for masking")
    
    return display_piis, masking_piis

