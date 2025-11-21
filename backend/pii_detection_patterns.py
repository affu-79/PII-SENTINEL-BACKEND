"""
PII Detection Patterns Module
Comprehensive regex patterns for detecting various PII types in documents
"""

import re

# PII Detection Patterns with labels
PII_PATTERNS = {
    # Indian Government IDs
    "Aadhaar": {
        "pattern": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
        "label": "Aadhaar Number",
        "category": "Government ID"
    },
    "PAN": {
        "pattern": r"\b[A-Z]{5}\d{4}[A-Z]{1}\b",
        "label": "PAN",
        "category": "Government ID"
    },
    "Passport": {
        "pattern": r"\bA\d{7}\b",
        "label": "Passport Number",
        "category": "Government ID"
    },
    "VoterID": {
        "pattern": r"\bEPIC/[A-Z]{3}\d{6}\b",
        "label": "Voter ID",
        "category": "Government ID"
    },
    "DrivingLicense": {
        "pattern": r"\b[A-Z]{2}-\d{4}-\d{7}\b",
        "label": "Driving License",
        "category": "Government ID"
    },
    
    # Financial Information
    "BankAccount": {
        "pattern": r"(?:account|account\s*number|bank\s*account)[\s:]*(\d{10,18})\b",
        "label": "Bank Account Number",
        "category": "Financial",
        "flags": re.IGNORECASE
    },
    "IFSC": {
        "pattern": r"\b([A-Z]{4}0[A-Z0-9]{6})\b",
        "label": "IFSC Code",
        "category": "Financial"
    },
    "UPIID": {
        "pattern": r"\b[a-z0-9]+@(paytm|ybl|okaxis|okhdfcbank|okicici)\b",
        "label": "UPI ID",
        "category": "Financial",
        "flags": re.IGNORECASE
    },
    "CreditCard": {
        "pattern": r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b",
        "label": "Credit Card Number",
        "category": "Financial"
    },
    
    # Contact Information
    "Phone": {
        "pattern": r"(?:phone|mobile|contact)[\s:]*(?:\+?91|0)?[\s\-]?[6-9]\d{3}[\s\-]?\d{5}\b",
        "label": "Phone Number",
        "category": "Contact",
        "flags": re.IGNORECASE
    },
    "Email": {
        "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "label": "Email Address",
        "category": "Contact"
    },
    
    # Personal Information
    "DOB": {
        "pattern": r"(?:date\s*of\s*birth|dob|born)[\s:]*(\d{1,2}[-/]\d{1,2}[-/]\d{4})",
        "label": "Date of Birth",
        "category": "Personal",
        "flags": re.IGNORECASE
    },
    "Name": {
        "pattern": r"(?:name|full\s*name|person)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        "label": "Name",
        "category": "Personal",
        "flags": re.IGNORECASE
    },
    "Address": {
        "pattern": r"(?:address|location)[\s:]*([A-Za-z0-9\s,#.-]+),\s*([A-Za-z\s]+)-?\s*(\d{6})",
        "label": "Address",
        "category": "Personal",
        "flags": re.IGNORECASE
    },
    
    # Employee/Student Information
    "EmployeeID": {
        "pattern": r"(?:employee\s*id|emp[\s#]*)([A-Z]{2}\d{4})\b",
        "label": "Employee ID",
        "category": "Employment",
        "flags": re.IGNORECASE
    },
    "StudentRoll": {
        "pattern": r"(?:roll\s*(?:number|no)|student\s*id)[\s:]*([A-Z]{3}\d{7})\b",
        "label": "Student Roll Number",
        "category": "Education",
        "flags": re.IGNORECASE
    },
    
    # Transaction Information
    "TransactionID": {
        "pattern": r"(?:transaction|txn|reference)[\s#:]*([A-Z]{3}\d{6})\b",
        "label": "Transaction ID",
        "category": "Financial",
        "flags": re.IGNORECASE
    },
    
    # Salary/Income
    "Salary": {
        "pattern": r"(?:salary|income|amount)[\s:]*₹?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
        "label": "Salary Amount",
        "category": "Financial",
        "flags": re.IGNORECASE
    },
    
    # Location Information
    "GPS": {
        "pattern": r"\b(\d{1,2}\.\d{6}),\s*(\d{1,2}\.\d{6})\b",
        "label": "GPS Coordinates",
        "category": "Location"
    },
    
    # API Keys and Credentials
    "APIKey": {
        "pattern": r"(?:api[_-]?key|secret|token)[\s:]*['\"]?([a-zA-Z0-9_-]{20,})['\"]?",
        "label": "API Key",
        "category": "Credentials",
        "flags": re.IGNORECASE
    },
    "Username": {
        "pattern": r"(?:username|user)[\s:]*([a-zA-Z0-9_.-]+)",
        "label": "Username",
        "category": "Credentials",
        "flags": re.IGNORECASE
    },
    "Password": {
        "pattern": r"(?:password|passwd|pwd)[\s:]*['\"]?([a-zA-Z0-9!@#$%^&*()_+-=\[\]{};:'\"<>?,./]{6,})['\"]?",
        "label": "Password",
        "category": "Credentials",
        "flags": re.IGNORECASE
    },
    
    # Additional Identifiers
    "GSTIN": {
        "pattern": r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[A-Z0-9]{1}\b",
        "label": "GSTIN",
        "category": "Business ID"
    },
    "LinkedinProfile": {
        "pattern": r"(?:linkedin|linkedin\.com|in\.com)[\s/]*(?:in/)?([a-z0-9-]+)",
        "label": "LinkedIn Profile",
        "category": "Social Media",
        "flags": re.IGNORECASE
    }
}


class PIIDetector:
    """Generic PII Detector with pattern matching"""
    
    def __init__(self):
        self.patterns = PII_PATTERNS
        self.compiled_patterns = self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile all regex patterns"""
        compiled = {}
        for pii_type, config in self.patterns.items():
            flags = config.get('flags', 0)
            compiled[pii_type] = {
                'regex': re.compile(config['pattern'], flags),
                'label': config['label'],
                'category': config['category']
            }
        return compiled
    
    def detect(self, text):
        """
        Detect all PII in text
        
        Returns:
            list: List of detected PII with details
        """
        detections = []
        
        for pii_type, compiled_config in self.compiled_patterns.items():
            regex = compiled_config['regex']
            matches = regex.finditer(text)
            
            for match in matches:
                detection = {
                    'type': pii_type,
                    'label': compiled_config['label'],
                    'category': compiled_config['category'],
                    'value': match.group(0),
                    'start_pos': match.start(),
                    'end_pos': match.end(),
                    'confidence': 0.95  # High confidence for regex matches
                }
                detections.append(detection)
        
        # Sort by position
        detections.sort(key=lambda x: x['start_pos'])
        return detections
    
    def detect_by_category(self, text, category):
        """Detect PII of specific category"""
        detections = self.detect(text)
        return [d for d in detections if d['category'] == category]
    
    def get_pii_summary(self, detections):
        """Get summary of detected PII"""
        summary = {}
        for detection in detections:
            pii_type = detection['type']
            if pii_type not in summary:
                summary[pii_type] = []
            summary[pii_type].append(detection['value'])
        
        return summary


# Export detector instance
pii_detector = PIIDetector()

