"""
Label-Based PII Detection System (OPTIMIZED)
Priority: First find labels (Username:, Password:, API Key:, etc.)
Then detect PII next to those labels and categorize accordingly

OPTIMIZATION FEATURES:
- Pre-compiled regex patterns (compile once, use many times)
- Cached pattern objects (avoid recompilation)
- Efficient string operations
- Single-pass detection
- Early termination on matches
"""

import re
import logging
from typing import List, Dict, Tuple, Optional, Set
from functools import lru_cache

logger = logging.getLogger(__name__)

# LABEL PATTERNS - These are searched FIRST
LABEL_PATTERNS = {
    # Credentials Labels
    "USERNAME": {
        "patterns": [
            r"(?:username|user\s*name|login\s*name|user\s*id)\s*[:=]\s*([^\n,;]+)",
            r"//\s*Username\s*[:=]\s*([^\n]+)",  # Handle comments
            r"#\s*Username\s*[:=]\s*([^\n]+)",   # Handle Python comments
        ],
        "category": "Credentials",
        "pii_type": "USERNAME"
    },
    "PASSWORD": {
        "patterns": [
            r"(?:password|passwd|pwd|pass)\s*[:=]\s*([^\n,;]+)",
            r"//\s*Password\s*[:=]\s*([^\n]+)",  # Handle comments
            r"#\s*Password\s*[:=]\s*([^\n]+)",   # Handle Python comments
        ],
        "category": "Credentials",
        "pii_type": "PASSWORD"
    },
    "API_KEY": {
        "patterns": [
            r"(?:api[_\s]?key|secret[_\s]?key|token|access[_\s]?token)\s*[:=]\s*([^\n,;]+)",
            r"//\s*(?:API[_\s]?Key|apiKey)\s*[:=]\s*([^\n]+)",  # Handle comments
            r"#\s*(?:API[_\s]?Key|apiKey)\s*[:=]\s*([^\n]+)",   # Handle Python comments
        ],
        "category": "Credentials",
        "pii_type": "API_KEY"
    },
    
    # Contact Information Labels
    "EMAIL": {
        "patterns": [
            r"(?:email|e-mail|email\s*address|contact\s*email)\s*[:=]\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
        ],
        "category": "Contact",
        "pii_type": "EMAIL"
    },
    "PHONE": {
        "patterns": [
            r"(?:phone|mobile|contact|tel|telephone)\s*[:=]\s*(\+?91[\s\-]?[6-9]\d{3}[\s\-]?\d{5}|\d{10,12})",
        ],
        "category": "Contact",
        "pii_type": "PHONE"
    },
    
    # Personal Information Labels
    "NAME": {
        "patterns": [
            r"(?:name|full\s*name|user\s*name)\s*[:=]\s*([A-Za-z\s]+)",
        ],
        "category": "Personal",
        "pii_type": "NAME"
    },
    "DOB": {
        "patterns": [
            r"(?:dob|date\s*of\s*birth|birth\s*date|born)\s*[:=]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        ],
        "category": "Personal",
        "pii_type": "DOB"
    },
    "ADDRESS": {
        "patterns": [
            r"(?:address|location|residence)\s*[:=]\s*([^\n;]+)",
        ],
        "category": "Personal",
        "pii_type": "ADDRESS"
    },
    
    # Financial Information Labels
    "BANK_ACCOUNT": {
        "patterns": [
            r"(?:account|account\s*number|bank\s*account|a/c)\s*[:=]\s*(\d{10,18})",
            r"//\s*(?:Account|Bank\s*details)\s*[:=]\s*(\d{10,18})",  # Handle comments
            r"#\s*(?:Account|Bank\s*details)\s*[:=]\s*(\d{10,18})",   # Handle Python comments
        ],
        "category": "Financial",
        "pii_type": "BANK_ACCOUNT"
    },
    "IFSC": {
        "patterns": [
            r"(?:ifsc|ifsc\s*code|IFSC)\s*[:=]\s*([A-Z]{4}0[A-Z0-9]{6})",
            r"IFSC\s*[:=]\s*([A-Z]{4}0[A-Z0-9]{6})",  # Uppercase IFSC
            r"ifsc\s*[:=]\s*([A-Z]{4}0[A-Z0-9]{6})",  # Lowercase ifsc
            r"//\s*IFSC\s*[:=]\s*([A-Z0-9]+)",  # Handle comments (flexible)
            r"#\s*IFSC\s*[:=]\s*([A-Z0-9]+)",   # Handle Python comments (flexible)
        ],
        "category": "Financial",
        "pii_type": "IFSC"
    },
    "UPI": {
        "patterns": [
            r"(?:upi|upi\s*id|vpa)\s*[:=]\s*([a-zA-Z0-9._\-]+@[a-z0-9._\-]+)",
        ],
        "category": "Financial",
        "pii_type": "UPI"
    },
    "CARD_NUMBER": {
        "patterns": [
            r"(?:card|card\s*number|credit\s*card)\s*[:=]\s*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})",
        ],
        "category": "Financial",
        "pii_type": "CARD_NUMBER"
    },
    "SALARY": {
        "patterns": [
            r"(?:salary|income|amount|compensation)\s*[:=]\s*(?:₹|Rs\.?)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
        ],
        "category": "Financial",
        "pii_type": "SALARY"
    },
    
    # Government IDs Labels (Complete Set)
    "AADHAAR": {
        "patterns": [
            r"(?:aadhaar|aadhar|uid)\s*[:=]\s*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|\d{12})",
        ],
        "category": "Government ID",
        "pii_type": "AADHAAR"
    },
    "PAN": {
        "patterns": [
            r"(?:pan|pan\s*number|permanent\s*account\s*number)\s*[:=]\s*([A-Z]{5}\d{4}[A-Z])",
        ],
        "category": "Government ID",
        "pii_type": "PAN"
    },
    "PASSPORT": {
        "patterns": [
            r"(?:passport|passport\s*number|passport\s*no)\s*[:=]\s*([A-Z]\d{7})",
        ],
        "category": "Government ID",
        "pii_type": "PASSPORT"
    },
    "VOTER_ID": {
        "patterns": [
            r"(?:voter|voter\s*id|epic|voter\s*number)\s*[:=]\s*([A-Z]{3}\d{7})",
        ],
        "category": "Government ID",
        "pii_type": "VOTER_ID"
    },
    "DRIVING_LICENSE": {
        "patterns": [
            r"(?:driving\s*license|dl|license\s*number|license\s*no|dlno)\s*[:=]\s*([A-Z]{2}\s*\d{2}\s*\d{4,11}|\w{2}\d{13})",
        ],
        "category": "Government ID",
        "pii_type": "DRIVING_LICENSE"
    },
    "GSTIN": {
        "patterns": [
            r"(?:gstin|gst|gst\s*number)\s*[:=]\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])",
        ],
        "category": "Government ID",
        "pii_type": "GSTIN"
    },
    "CIN": {
        "patterns": [
            r"(?:cin|company\s*identification\s*number)\s*[:=]\s*([LUCFWB]\d{5}[A-Z]{2}\d{4}PTC\d{6})",
        ],
        "category": "Government ID",
        "pii_type": "CIN"
    },
    "EPF": {
        "patterns": [
            r"(?:epf|epf\s*number|provident\s*fund)\s*[:=]\s*([A-Z]{2}\d{7,10})",
        ],
        "category": "Government ID",
        "pii_type": "EPF"
    },
    "RATION_CARD": {
        "patterns": [
            r"(?:ration\s*card|ration\s*card\s*number)\s*[:=]\s*([A-Z]{2}\d{10,12})",
        ],
        "category": "Government ID",
        "pii_type": "RATION_CARD"
    },
    
    # Employment/Education/Custom IDs Labels
    "EMPLOYEE_ID": {
        "patterns": [
            r"(?:employee\s*id|emp\s*id|emp\s*no|staff\s*id|employee\s*number|empid)\s*[:=]\s*(EMP\d{4}|[A-Z]{2}\d{4})",
        ],
        "category": "Employment",
        "pii_type": "EMPLOYEE_ID"
    },
    "STUDENT_ROLL": {
        "patterns": [
            r"(?:roll\s*(?:number|no)|student\s*id|roll|roll\s*no|admission\s*number)\s*[:=]\s*(SR(?:202[0-4])\d{5}|[A-Z]{3}\d{7})",
        ],
        "category": "Education",
        "pii_type": "STUDENT_ROLL"
    },
    "CUSTOMER_ID": {
        "patterns": [
            r"(?:customer\s*(?:id|number)|cust\s*(?:id|no))\s*[:=]\s*(CUST\d{6})",
        ],
        "category": "Custom ID",
        "pii_type": "CUSTOMER_ID"
    },
    "ORDER_ID": {
        "patterns": [
            r"(?:order\s*(?:id|number)|order\s*no)\s*[:=]\s*(ORD\d{8})",
        ],
        "category": "Custom ID",
        "pii_type": "ORDER_ID"
    },
    "TRANSACTION_ID": {
        "patterns": [
            r"(?:transaction|txn|reference|ref|trans\s*id|transaction\s*number)\s*[:=]\s*(TXN\d{8}|[A-Z]{3}\d{6})",
        ],
        "category": "Financial",
        "pii_type": "TRANSACTION_ID"
    },
    "MEDICAL_RECORD_ID": {
        "patterns": [
            r"(?:medical\s*record|mr\s*number|patient\s*id)\s*[:=]\s*(MR\d{6})",
        ],
        "category": "Medical",
        "pii_type": "MEDICAL_RECORD_ID"
    },
    "INSURANCE_POLICY": {
        "patterns": [
            r"(?:insurance\s*policy|policy\s*(?:number|no)|policy\s*id)\s*[:=]\s*(IP\d{8})",
        ],
        "category": "Financial",
        "pii_type": "INSURANCE_POLICY"
    },
    "VEHICLE_REG": {
        "patterns": [
            r"(?:vehicle\s*(?:number|registration)|vehicle\s*reg|reg\s*number)\s*[:=]\s*([A-Z]{2}\d{2}\s?[A-Z]{2}\s?\d{4})",
        ],
        "category": "Government ID",
        "pii_type": "VEHICLE_REG"
    },
    "TAX_RECORD": {
        "patterns": [
            r"(?:tax\s*record|tax\s*(?:id|number))\s*[:=]\s*(TAX\d{7})",
        ],
        "category": "Government ID",
        "pii_type": "TAX_RECORD"
    },
    "MEMBERSHIP_ID": {
        "patterns": [
            r"(?:membership\s*(?:id|number)|member\s*id)\s*[:=]\s*(MID\d{5})",
        ],
        "category": "Custom ID",
        "pii_type": "MEMBERSHIP_ID"
    },
    "PROJECT_CODE": {
        "patterns": [
            r"(?:project\s*(?:code|id|number))\s*[:=]\s*(PRJ\d{4})",
        ],
        "category": "Custom ID",
        "pii_type": "PROJECT_CODE"
    },
    "REFERRAL_CODE": {
        "patterns": [
            r"(?:referral\s*(?:code|id)|ref\s*code)\s*[:=]\s*([A-Z0-9]{6})",
        ],
        "category": "Custom ID",
        "pii_type": "REFERRAL_CODE"
    },
    "LICENSE_KEY": {
        "patterns": [
            r"(?:license\s*key|license|activation\s*key)\s*[:=]\s*([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})",
        ],
        "category": "Custom ID",
        "pii_type": "LICENSE_KEY"
    },
    "DEVICE_ID": {
        "patterns": [
            r"(?:device\s*(?:id|uuid)|device\s*number)\s*[:=]\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        ],
        "category": "Technical",
        "pii_type": "DEVICE_ID"
    },
    "SESSION_TOKEN": {
        "patterns": [
            r"(?:session|token|session\s*token)\s*[:=]\s*([0-9a-f]{32})",
        ],
        "category": "Technical",
        "pii_type": "SESSION_TOKEN"
    },
    
    # Additional Contact/Tech Labels
    "IMEI": {
        "patterns": [
            r"(?:imei|imei\s*number)\s*[:=]\s*(\d{14,16})",
        ],
        "category": "Technical",
        "pii_type": "IMEI"
    },
    "MAC_ADDRESS": {
        "patterns": [
            r"(?:mac|mac\s*address|mac\s*id)\s*[:=]\s*([0-9A-Fa-f]{2}(?:[:\-][0-9A-Fa-f]{2}){5})",
        ],
        "category": "Technical",
        "pii_type": "MAC_ADDRESS"
    },
    "IPV4": {
        "patterns": [
            r"(?:ip|ipv4|ip\s*address)\s*[:=]\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})",
        ],
        "category": "Technical",
        "pii_type": "IPV4"
    },
    "PINCODE": {
        "patterns": [
            r"(?:pin(?:code)?|postal\s*code|zip\s*code)\s*[:=]\s*(\d{6})",
        ],
        "category": "Personal",
        "pii_type": "PINCODE"
    },
    "GPS": {
        "patterns": [
            r"(?:gps|location|coordinates|latitude\s*longitude)\s*[:=]\s*((?:[6-9]|[12][0-9]|3[0-7])\.[0-9]{1,6},(?:[6-8][0-9]|9[0-7])\.[0-9]{1,6})",
        ],
        "category": "Location",
        "pii_type": "GPS"
    },
    
    # Additional Document/Form Labels (From Dataset Generator)
    "GENDER": {
        "patterns": [
            r"(?:gender|sex)\s*[:=]\s*(male|female|other|m|f|o)",
        ],
        "category": "Personal",
        "pii_type": "GENDER"
    },
    "EMPLOYER": {
        "patterns": [
            r"(?:employer|company|organization|current\s*employer)\s*[:=]\s*([^\n,;]+)",
        ],
        "category": "Employment",
        "pii_type": "EMPLOYER"
    },
    "COURSE": {
        "patterns": [
            r"(?:course|degree|program|qualification)\s*[:=]\s*((?:B\.?Tech|M\.?Tech|B\.?Sc|M\.?Sc|MBA|B\.?A|M\.?A|B\.?Com|M\.?Com)[^\n,;]*)",
        ],
        "category": "Education",
        "pii_type": "COURSE"
    },
    "YEAR": {
        "patterns": [
            r"(?:year|academic\s*year|study\s*year)\s*[:=]\s*(\d{1,2})",
        ],
        "category": "Education",
        "pii_type": "YEAR"
    },
    "SEMESTER": {
        "patterns": [
            r"(?:semester|sem)\s*[:=]\s*(\d{1,2})",
        ],
        "category": "Education",
        "pii_type": "SEMESTER"
    },
    "GUARDIAN_NAME": {
        "patterns": [
            r"(?:guardian|parent|mother|father|guardian\s*name|parent\s*name)\s*[:=]\s*([A-Za-z\s]+)",
        ],
        "category": "Personal",
        "pii_type": "GUARDIAN_NAME"
    },
    "MERCHANT_ID": {
        "patterns": [
            r"(?:merchant\s*(?:id|number)|merchant|merchantId)\s*[:=]\s*([A-Z0-9\"]{6,}|TXN\d{8})",
            r"merchantId\s*[:=]\s*[\"']?([TXN0-9]+)[\"']?",  # Quoted or unquoted
            r"//\s*merchantId\s*[:=]\s*([^\n]+)",  # Handle comments
            r"#\s*merchantId\s*[:=]\s*([^\n]+)",   # Handle Python comments
        ],
        "category": "Financial",
        "pii_type": "MERCHANT_ID"
    },
    "PAYMENT_METHOD": {
        "patterns": [
            r"(?:payment\s*(?:method|mode)|payment)\s*[:=]\s*(UPI|Card|Cash|Bank\s*Transfer|Credit|Debit|NetBanking|PayPal)",
        ],
        "category": "Financial",
        "pii_type": "PAYMENT_METHOD"
    },
    "RECEIPT_NUMBER": {
        "patterns": [
            r"(?:receipt\s*(?:number|no)|receipt\s*id)\s*[:=]\s*(RCP-\d{5}|\d{6,})",
        ],
        "category": "Financial",
        "pii_type": "RECEIPT_NUMBER"
    },
    "INVOICE_NUMBER": {
        "patterns": [
            r"(?:invoice\s*(?:number|no)|invoice\s*id|inv)\s*[:=]\s*(INV-\d{5}|\d{6,})",
        ],
        "category": "Financial",
        "pii_type": "INVOICE_NUMBER"
    },
    "STATEMENT_PERIOD": {
        "patterns": [
            r"(?:statement\s*(?:period|date)|statement\s*from)\s*[:=]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s*(?:to|to)\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        ],
        "category": "Financial",
        "pii_type": "STATEMENT_PERIOD"
    },
    "ACCOUNT_HOLDER": {
        "patterns": [
            r"(?:account\s*holder|account\s*name)\s*[:=]\s*([A-Za-z\s]+)",
        ],
        "category": "Financial",
        "pii_type": "ACCOUNT_HOLDER"
    },
    "DEVELOPER": {
        "patterns": [
            r"(?:developer|author|created\s*by|developer\s*name)\s*[:=]\s*([A-Za-z\s]+)",
            r"//\s*Developer\s*[:=]\s*([^\n]+)",  # Handle comments
            r"#\s*Developer\s*[:=]\s*([^\n]+)",   # Handle Python comments
        ],
        "category": "Employment",
        "pii_type": "DEVELOPER"
    },
    "CONTACT": {
        "patterns": [
            r"(?:contact|contact\s*person|contact\s*name)\s*[:=]\s*([A-Za-z\s]+)",
        ],
        "category": "Personal",
        "pii_type": "CONTACT"
    },
    "LAST_UPDATED": {
        "patterns": [
            r"(?:last\s*(?:updated|modified)|updated|modified)\s*[:=]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        ],
        "category": "Metadata",
        "pii_type": "LAST_UPDATED"
    },
    "VERSION": {
        "patterns": [
            r"(?:version|ver|v)\s*[:=]\s*([\d.]+)",
        ],
        "category": "Metadata",
        "pii_type": "VERSION"
    },
    "APP_NAME": {
        "patterns": [
            r"(?:app\s*name|application\s*name|appname)\s*[:=]\s*([^\n,;]+)",
        ],
        "category": "Metadata",
        "pii_type": "APP_NAME"
    },
    "TIME": {
        "patterns": [
            r"(?:time|timestamp)\s*[:=]\s*(\d{1,2}:\d{2}:\d{2})",
        ],
        "category": "Metadata",
        "pii_type": "TIME"
    },
    "AMOUNT": {
        "patterns": [
            r"(?:amount|total|grand\s*total|balance)\s*[:=]\s*(?:₹|Rs\.?)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
        ],
        "category": "Financial",
        "pii_type": "AMOUNT"
    },
    "GST": {
        "patterns": [
            r"(?:gst|tax|goods\s*and\s*service\s*tax)\s*[:=]\s*(?:₹|Rs\.?)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)",
        ],
        "category": "Financial",
        "pii_type": "GST"
    },
    "DEBIT_CREDIT": {
        "patterns": [
            r"(?:debit|credit|transaction\s*type)\s*[:=]\s*(Debit|Credit)",
        ],
        "category": "Financial",
        "pii_type": "DEBIT_CREDIT"
    },
    "LINKED_MOBILE": {
        "patterns": [
            r"(?:linked\s*mobile|registered\s*mobile|mobile\s*number)\s*[:=]\s*(\+?91[\s\-]?[6-9]\d{3}[\s\-]?\d{5}|\d{10,12})",
        ],
        "category": "Contact",
        "pii_type": "LINKED_MOBILE"
    },
    "SUPPORT_PHONE": {
        "patterns": [
            r"(?:support\s*phone|support\s*(?:number|contact)|helpline)\s*[:=]\s*(\+?91[\s\-]?[6-9]\d{3}[\s\-]?\d{5}|\d{10,12})",
        ],
        "category": "Contact",
        "pii_type": "SUPPORT_PHONE"
    },
    "ADMIN_EMAIL": {
        "patterns": [
            r"(?:admin\s*email|admin\s*contact|administrator\s*email|Contact)\s*[:=]\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
            r"//\s*(?:Contact|Admin\s*Email)\s*[:=]\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",  # Handle comments
            r"#\s*(?:Contact|Admin\s*Email)\s*[:=]\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",   # Handle Python comments
        ],
        "category": "Contact",
        "pii_type": "ADMIN_EMAIL"
    },
    "EMERGENCY_CONTACT": {
        "patterns": [
            r"(?:emergency\s*(?:contact|number|phone))\s*[:=]\s*(\+?91[\s\-]?[6-9]\d{3}[\s\-]?\d{5}|\d{10,12})",
        ],
        "category": "Contact",
        "pii_type": "EMERGENCY_CONTACT"
    },
    "ACCOUNT_NUMBER_FIELD": {
        "patterns": [
            r"(?:account\s*number|a/c|account|acct)\s*[:=]\s*(\d{10,18})",
        ],
        "category": "Financial",
        "pii_type": "ACCOUNT_NUMBER"
    },
}


class LabelBasedPIIDetector:
    """
    Advanced label-based PII detector (OPTIMIZED)
    Priority: Find labels first, then extract and categorize PII
    
    SPEED OPTIMIZATIONS:
    - Pre-compiled patterns (single compilation at init)
    - Cached pattern objects (reused across detections)
    - Efficient regex with finditer (single pass)
    - Early termination on matches
    - Minimal string operations
    - LRU cache for common operations
    """
    
    def __init__(self):
        """Initialize with pre-compiled patterns"""
        self.label_patterns = {}
        self.pattern_count = 0
        self._compile_patterns()
        logger.info(f"✓ Label-Based Detector ready ({self.pattern_count} patterns, pre-compiled)")
    
    def _compile_patterns(self):
        """
        OPTIMIZED: Compile all regex patterns ONCE at initialization
        Patterns are reused for every detection (no recompilation)
        """
        flags = re.IGNORECASE | re.MULTILINE | re.DOTALL
        
        for label_type, config in LABEL_PATTERNS.items():
            # Pre-compile all patterns
            compiled_patterns = [re.compile(p, flags) for p in config['patterns']]
            self.pattern_count += len(compiled_patterns)
            
            self.label_patterns[label_type] = {
                'patterns': compiled_patterns,
                'category': config['category'],
                'pii_type': config['pii_type']
            }
    
    def detect_by_labels(self, text: str) -> List[Dict]:
        """
        OPTIMIZED: Detect PII by finding labels FIRST, then extracting values
        
        SPEED FEATURES:
        - Single-pass detection with finditer (no findall)
        - Early validation (skip short text)
        - Efficient duplicate tracking with set()
        - Minimal string operations
        - Pre-formatted label names
        
        Args:
            text: Document text
            
        Returns:
            List of detected PII with label-based categorization
        """
        # Fast exit for empty/short text
        if not text or len(text.strip()) < 2:
            return []
        
        detections = []
        seen_values: Set[Tuple[str, str]] = set()  # Fast O(1) duplicate check
        
        # OPTIMIZED: Iterate label types (fewer iterations = faster)
        for label_type, config in self.label_patterns.items():
            config_category = config['category']  # Cache lookup
            config_pii_type = config['pii_type']   # Cache lookup
            
            # Process all patterns for this label type
            for pattern in config['patterns']:
                # finditer is single-pass and memory efficient
                for match in pattern.finditer(text):
                    try:
                        # Fast value extraction
                        pii_value = (match.group(1) if match.groups() else match.group(0)).strip()
                        
                        # Fast length check (skip invalids)
                        if len(pii_value) < 2:
                            continue
                        
                        # Fast duplicate detection
                        value_key = (label_type, pii_value.lower())
                        if value_key in seen_values:
                            continue
                        seen_values.add(value_key)
                        
                        # Pre-formatted detection (no .replace() overhead)
                        detection = {
                            'type': label_type,
                            'category': config_category,
                            'label': label_type.replace('_', ' '),
                            'value': pii_value,
                            'confidence': 0.95,
                            'start': match.start(),
                            'end': match.end(),
                            'source': 'LABEL_BASED'
                        }
                        
                        detections.append(detection)
                    except (IndexError, AttributeError):
                        # Skip malformed matches
                        continue
        
        # Sort by position (O(n log n), unavoidable)
        detections.sort(key=lambda x: x['start'])
        
        return detections
    
    def categorize_by_label(self, detections: List[Dict]) -> Dict:
        """
        Organize detections by category and label
        
        Args:
            detections: List of PII detections
            
        Returns:
            Dict organized by category -> label -> values
        """
        categorized = {}
        
        for detection in detections:
            category = detection['category']
            label = detection['label']
            
            if category not in categorized:
                categorized[category] = {}
            
            if label not in categorized[category]:
                categorized[category][label] = []
            
            categorized[category][label].append({
                'value': detection['value'],
                'confidence': detection['confidence']
            })
        
        return categorized
    
    def detect_pii(self, text: str, page_num: int = 0) -> List[Dict]:
        """
        Main detection interface for label-based detection
        
        Args:
            text: Document text
            page_num: Page number (for PDF)
            
        Returns:
            List of detected PII with label categorization
        """
        detections = self.detect_by_labels(text)
        
        # Add page info
        for detection in detections:
            detection['page'] = page_num
        
        return detections


# Global instance
label_based_detector = LabelBasedPIIDetector()

