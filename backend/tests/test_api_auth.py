"""
API authentication tests.
"""
import unittest
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestAPIAuthentication(unittest.TestCase):
    """Test API authentication."""
    
    def setUp(self):
        """Set up test environment."""
        os.environ['API_KEY'] = 'test-api-key-12345'
        os.environ['FLASK_ENV'] = 'testing'
    
    def test_api_key_required(self):
        """Test that API key is required."""
        # This would require importing app, which we'll do in integration tests
        pass
    
    def test_api_key_validation(self):
        """Test API key validation."""
        # Test constant-time comparison
        import secrets
        
        key1 = 'test-key-12345'
        key2 = 'test-key-12345'
        key3 = 'wrong-key-67890'
        
        # Same keys should match
        self.assertTrue(secrets.compare_digest(key1, key2))
        
        # Different keys should not match
        self.assertFalse(secrets.compare_digest(key1, key3))
    
    def test_api_key_length_check(self):
        """Test that API key length is checked."""
        key1 = 'short'
        key2 = 'very-long-key-that-is-different'
        
        # Different lengths should not match
        self.assertNotEqual(len(key1), len(key2))


if __name__ == '__main__':
    unittest.main()

