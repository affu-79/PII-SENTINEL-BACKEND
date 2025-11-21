"""
Quick test script to verify app startup and basic functionality.
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all modules can be imported."""
    print("Testing imports...")
    
    try:
        from config import config
        print("✓ Config imported")
    except Exception as e:
        print(f"✗ Config import failed: {e}")
        return False
    
    try:
        from middleware.security import add_security_headers, rate_limit
        print("✓ Security middleware imported")
    except Exception as e:
        print(f"✗ Security middleware import failed: {e}")
        return False
    
    try:
        from routes import register_blueprints
        print("✓ Routes imported")
    except Exception as e:
        print(f"✗ Routes import failed: {e}")
        return False
    
    try:
        from mongo_client import mongo_client
        print("✓ MongoDB client imported")
    except Exception as e:
        print(f"✗ MongoDB client import failed: {e}")
        return False
    
    return True


def test_config():
    """Test configuration."""
    print("\nTesting configuration...")
    
    try:
        from config import config
        
        print(f"  Environment: {config.FLASK_ENV}")
        print(f"  Storage path: {config.STORAGE_PATH}")
        print(f"  Allowed extensions: {len(config.ALLOWED_EXTENSIONS)}")
        print(f"  Max content length: {config.MAX_CONTENT_LENGTH / (1024*1024)}MB")
        
        if config.is_production():
            print("  ⚠ Running in production mode")
        else:
            print("  ✓ Running in development mode")
        
        return True
    except Exception as e:
        print(f"✗ Config test failed: {e}")
        return False


def test_app_creation():
    """Test Flask app creation."""
    print("\nTesting Flask app creation...")
    
    try:
        # Import app_new if available, otherwise app
        try:
            from app_new import app
            print("✓ Using modular app (app_new.py)")
        except ImportError:
            from app import app
            print("✓ Using original app (app.py)")
        
        # Test app configuration
        assert app is not None
        print(f"  App name: {app.name}")
        print(f"  Debug mode: {app.debug}")
        
        # Test routes registration
        routes = [rule.rule for rule in app.url_map.iter_rules()]
        print(f"  Registered routes: {len(routes)}")
        
        # Check for key routes
        key_routes = ['/api/health', '/api/login', '/api/create-batch']
        found_routes = [r for r in routes if any(kr in r for kr in key_routes)]
        print(f"  Key routes found: {len(found_routes)}/{len(key_routes)}")
        
        return True
    except Exception as e:
        print(f"✗ App creation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_security_middleware():
    """Test security middleware."""
    print("\nTesting security middleware...")
    
    try:
        from flask import Flask
        from middleware.security import add_security_headers
        
        app = Flask(__name__)
        
        @app.route('/test')
        def test():
            return {'status': 'ok'}
        
        app.after_request(add_security_headers)
        
        with app.test_client() as client:
            response = client.get('/test')
            
            headers_to_check = [
                'X-Frame-Options',
                'X-Content-Type-Options',
                'X-XSS-Protection',
                'Content-Security-Policy'
            ]
            
            for header in headers_to_check:
                if header in response.headers:
                    print(f"  ✓ {header}: {response.headers[header]}")
                else:
                    print(f"  ✗ {header}: Missing")
                    return False
        
        return True
    except Exception as e:
        print(f"✗ Security middleware test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_mongodb_connection():
    """Test MongoDB connection."""
    print("\nTesting MongoDB connection...")
    
    try:
        from mongo_client import mongo_client
        
        status = mongo_client.get_connection_status()
        print(f"  Connected: {status.get('connected', False)}")
        print(f"  URI set: {status.get('uri_set', False)}")
        
        if status.get('connected'):
            print(f"  Database: {status.get('database', 'N/A')}")
            print("  ✓ MongoDB connection successful")
        else:
            print(f"  ⚠ MongoDB not connected: {status.get('error', 'Unknown error')}")
            print("  (This is OK if MongoDB is not configured)")
        
        return True
    except Exception as e:
        print(f"✗ MongoDB connection test failed: {e}")
        return False


if __name__ == '__main__':
    print("=" * 50)
    print("PII Sentinel - Application Startup Test")
    print("=" * 50)
    print()
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Configuration", test_config()))
    results.append(("App Creation", test_app_creation()))
    results.append(("Security Middleware", test_security_middleware()))
    results.append(("MongoDB Connection", test_mongodb_connection()))
    
    print()
    print("=" * 50)
    print("Test Results Summary")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("⚠ Some tests failed (check output above)")
        sys.exit(1)

