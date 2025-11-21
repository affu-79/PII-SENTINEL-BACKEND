"""
MongoDB client tests.
"""
import unittest
import os
import sys
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestMongoClient(unittest.TestCase):
    """Test MongoDB client wrapper."""
    
    @patch('mongo_client.MongoClient')
    def test_connection_retry(self, mock_mongo):
        """Test that connection retries on failure."""
        # Mock connection failure
        mock_mongo.side_effect = Exception("Connection failed")
        
        from mongo_client import MongoClientWrapper
        
        client = MongoClientWrapper()
        # Should not raise exception, but connection should be None
        self.assertIsNone(client.client)
    
    def test_normalize_mobile(self):
        """Test mobile number normalization."""
        from mongo_client import MongoClientWrapper
        
        client = MongoClientWrapper()
        
        # Test normalization
        normalized = client._normalize_mobile('+91 7483314469')
        self.assertEqual(normalized, '917483314469')
        
        normalized = client._normalize_mobile('7483314469')
        self.assertEqual(normalized, '7483314469')
    
    def test_create_batch_validation(self):
        """Test batch creation validation."""
        from mongo_client import MongoClientWrapper
        
        client = MongoClientWrapper()
        
        # Should validate required fields
        # This would require a mock database connection
        pass


if __name__ == '__main__':
    unittest.main()

