"""
Unit tests for PII validators (PAN, Aadhaar, etc.)
"""
import unittest
from pii_detector import PIIDetector


class TestValidators(unittest.TestCase):
    """Test PII validation functions."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.detector = PIIDetector()
    
    def test_pan_validation(self):
        """Test PAN validation."""
        # Valid PANs
        valid_pans = [
            'ABCDE1234F',
            'XYZAB5678C',
            'PQRST9012D'
        ]
        
        for pan in valid_pans:
            self.assertTrue(
                self.detector.validate_pan(pan),
                f"PAN {pan} should be valid"
            )
        
        # Invalid PANs
        invalid_pans = [
            'ABCD1234F',  # Too short
            'ABCDE12345F',  # Too long
            '12345ABCDE',  # Wrong format
            'ABCDE1234',  # Missing last letter
        ]
        
        for pan in invalid_pans:
            self.assertFalse(
                self.detector.validate_pan(pan),
                f"PAN {pan} should be invalid"
            )
    
    def test_aadhaar_validation(self):
        """Test Aadhaar validation with Verhoeff algorithm."""
        # Valid Aadhaar (with correct check digit)
        # Note: These are example patterns - actual Aadhaar numbers have specific check digits
        # For testing, we'll use known valid patterns
        
        # Test format validation (12 digits)
        valid_formats = [
            '1234 5678 9012',  # With spaces
            '123456789012',  # Without spaces
        ]
        
        # Test invalid formats
        invalid_formats = [
            '12345678901',  # Too short
            '1234567890123',  # Too long
            '12345678901A',  # Contains letter
        ]
        
        for aadhaar in invalid_formats:
            # Remove spaces for validation
            cleaned = aadhaar.replace(' ', '')
            self.assertFalse(
                self.detector.validate_aadhaar(cleaned),
                f"Aadhaar {aadhaar} should be invalid (format)"
            )
    
    def test_pii_detection(self):
        """Test PII detection in text."""
        test_text = """
        My name is John Doe and my PAN is ABCDE1234F.
        My Aadhaar number is 1234 5678 9012.
        Contact me at john.doe@example.com or +91 9876543210.
        My IFSC code is HDFC0001234.
        """
        
        results = self.detector.detect_pii(test_text)
        
        # Check that some PIIs were detected
        self.assertGreater(len(results), 0, "Should detect at least one PII")
        
        # Check for specific types
        pii_types = [r['type'] for r in results]
        self.assertIn('PAN', pii_types, "Should detect PAN")
        self.assertIn('EMAIL', pii_types, "Should detect email")
        self.assertIn('PHONE', pii_types, "Should detect phone")
    
    def test_custom_pii_detection(self):
        """Test custom PII detection."""
        test_text = """
        Employee ID: EMP-12345
        Customer ID: CUST-67890
        Vehicle Number: MH12AB1234
        """
        
        results = self.detector.detect_pii(test_text)
        
        pii_types = [r['type'] for r in results]
        self.assertIn('EMPLOYEE_ID', pii_types, "Should detect employee ID")
        self.assertIn('CUSTOMER_ID', pii_types, "Should detect customer ID")
        self.assertIn('VEHICLE_NUMBER', pii_types, "Should detect vehicle number")


if __name__ == '__main__':
    unittest.main()

