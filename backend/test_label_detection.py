#!/usr/bin/env python3
"""
Test script to verify label-based PII detection
"""

import re
from pii_detector_label_based import label_based_detector

# Test cases matching the PDF content
test_cases = [
    # Test 1: Comment style Username
    """
    // Username: nirvi88
    """,
    
    # Test 2: Direct label
    """
    Username: nirvi88
    """,
    
    # Test 3: Password with comment
    """
    // Password: Q4dp5WTd'Q
    """,
    
    # Test 4: API Key
    """
    apiKey: "sk_live_20384156052579398"
    """,
    
    # Test 5: Email
    """
    // Contact: samitha.reddy86@company.in
    """,
    
    # Test 6: Bank Account
    """
    // Account: 8050909387
    """,
    
    # Test 7: IFSC
    """
    // IFSC: ICIC0100
    """,
    
    # Test 8: Merchant ID
    """
    merchantId: "TXN858472"
    """,
    
    # Test 9: Full document
    """
    // Application Configuration File
    // Developer: Samitha Reddy
    // Contact: samitha.reddy86@company.in
    // Last Updated: 09/11/2025
    
    const config = {
      appName: "MyApplication",
      version: "1.0.0",
      // Database connection details
      dbHost: "localhost",
      dbPort: 5432,
      // Support Phone: 91 9872 43846
      // API Keys and secrets
      apiKey: "sk_live_20384156052579398",
      // Test credentials
      // Username: nirvi88
      // Password: Q4dp5WTd'Q
    };
    
    // Payment gateway configuration
    const paymentConfig = {
      merchantId: "TXN858472",
      // Bank details for refunds
      // Account: 8050909387
      // IFSC: ICIC0100
    };
    """
]

print("=" * 60)
print("LABEL-BASED PII DETECTION TEST")
print("=" * 60)
print()

for i, test_text in enumerate(test_cases, 1):
    print(f"\nTest Case {i}:")
    print(f"Input: {test_text.strip()[:60]}...")
    print()
    
    detections = label_based_detector.detect_by_labels(test_text)
    
    if detections:
        print(f"✅ DETECTED: {len(detections)} PII instance(s)")
        for det in detections:
            print(f"   - Type: {det['type']}")
            print(f"     Value: {det['value']}")
            print(f"     Label: {det['label']}")
            print(f"     Confidence: {det['confidence']}")
    else:
        print(f"❌ NO PII DETECTED")
    
    print("-" * 60)

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)

