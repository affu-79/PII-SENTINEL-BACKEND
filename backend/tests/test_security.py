"""
Security tests for PII Sentinel backend.
"""
import unittest
import os
import sys
from unittest.mock import patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from middleware.security import (
    add_security_headers,
    rate_limit,
    sanitize_input,
    validate_file_upload,
    validate_path
)


class TestSecurityHeaders(unittest.TestCase):
    """Test security headers middleware."""
    
    def test_security_headers_added(self):
        """Test that security headers are added to response."""
        from flask import Flask
        app = Flask(__name__)
        
        @app.route('/test')
        def test():
            return {'status': 'ok'}
        
        app.after_request(add_security_headers)
        
        with app.test_client() as client:
            response = client.get('/test')
            
            # Check security headers
            self.assertIn('X-Frame-Options', response.headers)
            self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
            
            self.assertIn('X-Content-Type-Options', response.headers)
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
            
            self.assertIn('X-XSS-Protection', response.headers)
            self.assertIn('Content-Security-Policy', response.headers)


class TestRateLimiting(unittest.TestCase):
    """Test rate limiting middleware."""
    
    def test_rate_limit_allows_requests(self):
        """Test that rate limiting allows requests within limit."""
        from flask import Flask
        
        app = Flask(__name__)
        
        @app.route('/test')
        @rate_limit(max_requests=5, window=60)
        def test():
            return {'status': 'ok'}
        
        with app.test_client() as client:
            # Make 5 requests (within limit)
            for i in range(5):
                response = client.get('/test')
                self.assertEqual(response.status_code, 200)
    
    def test_rate_limit_blocks_excess(self):
        """Test that rate limiting blocks excess requests."""
        from flask import Flask
        
        app = Flask(__name__)
        
        @app.route('/test')
        @rate_limit(max_requests=2, window=60)
        def test():
            return {'status': 'ok'}
        
        with app.test_client() as client:
            # Make 2 requests (within limit)
            response1 = client.get('/test')
            self.assertEqual(response1.status_code, 200)
            
            response2 = client.get('/test')
            self.assertEqual(response2.status_code, 200)
            
            # Third request should be blocked
            response3 = client.get('/test')
            self.assertEqual(response3.status_code, 429)


class TestInputSanitization(unittest.TestCase):
    """Test input sanitization."""
    
    def test_sanitize_string(self):
        """Test string sanitization."""
        dangerous_input = "test<script>alert('xss')</script>"
        sanitized = sanitize_input(dangerous_input)
        self.assertNotIn('<script>', sanitized)
        self.assertNotIn('</script>', sanitized)
    
    def test_sanitize_dict(self):
        """Test dictionary sanitization."""
        dangerous_dict = {
            'name': "test<script>alert('xss')</script>",
            'email': 'test@example.com'
        }
        sanitized = sanitize_input(dangerous_dict)
        self.assertNotIn('<script>', sanitized['name'])
    
    def test_sanitize_list(self):
        """Test list sanitization."""
        dangerous_list = [
            "test<script>alert('xss')</script>",
            "normal text"
        ]
        sanitized = sanitize_input(dangerous_list)
        self.assertNotIn('<script>', sanitized[0])


class TestFileValidation(unittest.TestCase):
    """Test file upload validation."""
    
    def test_validate_file_upload_valid(self):
        """Test validation of valid file."""
        from werkzeug.datastructures import FileStorage
        from io import BytesIO
        
        file = FileStorage(
            stream=BytesIO(b'test content'),
            filename='test.pdf',
            content_type='application/pdf'
        )
        
        is_valid, error = validate_file_upload(file)
        self.assertTrue(is_valid)
        self.assertIsNone(error)
    
    def test_validate_file_upload_invalid_extension(self):
        """Test validation of file with invalid extension."""
        from werkzeug.datastructures import FileStorage
        from io import BytesIO
        
        file = FileStorage(
            stream=BytesIO(b'test content'),
            filename='test.exe',
            content_type='application/x-msdownload'
        )
        
        is_valid, error = validate_file_upload(file)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)
    
    def test_validate_file_upload_empty(self):
        """Test validation of empty file."""
        from werkzeug.datastructures import FileStorage
        from io import BytesIO
        
        file = FileStorage(
            stream=BytesIO(b''),
            filename='test.pdf',
            content_type='application/pdf'
        )
        
        is_valid, error = validate_file_upload(file)
        self.assertFalse(is_valid)
        self.assertIsNotNone(error)


class TestPathValidation(unittest.TestCase):
    """Test path validation."""
    
    def test_validate_path_valid(self):
        """Test validation of valid path."""
        self.assertTrue(validate_path('test/file.pdf'))
        self.assertTrue(validate_path('results/batch_123/file.json'))
    
    def test_validate_path_traversal(self):
        """Test that path traversal is blocked."""
        self.assertFalse(validate_path('../etc/passwd'))
        self.assertFalse(validate_path('../../etc/passwd'))
        self.assertFalse(validate_path('/etc/passwd'))
    
    def test_validate_path_dangerous_chars(self):
        """Test that dangerous characters are blocked."""
        self.assertFalse(validate_path('test;rm -rf /'))
        self.assertFalse(validate_path('test|cat /etc/passwd'))
        self.assertFalse(validate_path('test&rm -rf /'))


if __name__ == '__main__':
    unittest.main()

