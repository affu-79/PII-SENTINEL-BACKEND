"""
Quick diagnostic script to check for import and configuration errors.
"""
import sys
import os

print("=" * 60)
print("PII Sentinel Backend - Error Check")
print("=" * 60)
print()

# Check Python version
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")
print()

# Check if .env exists
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    print("[OK] .env file exists")
else:
    print("[ERROR] .env file NOT FOUND")
print()

# Try importing dependencies
print("Checking dependencies...")
dependencies = [
    'flask',
    'flask_cors',
    'dotenv',
    'pymongo',
    'PIL',
    'cv2',
    'fitz',
    'docx',
    'pytesseract',
    'easyocr',
    'numpy',
    'cryptography',
    'pandas'
]

missing = []
for dep in dependencies:
    try:
        if dep == 'PIL':
            __import__('PIL')
        elif dep == 'cv2':
            __import__('cv2')
        elif dep == 'fitz':
            __import__('fitz')
        elif dep == 'docx':
            __import__('docx')
        else:
            __import__(dep)
        print(f"[OK] {dep}")
    except ImportError as e:
        print(f"[ERROR] {dep} - {e}")
        missing.append(dep)

print()

# Try importing our modules
print("Checking local modules...")
local_modules = [
    'mongo_client',
    'ocr_engine',
    'pii_detector',
    'parallel_processor',
    'maskers',
    'worker_stub',
    'utils'
]

for module in local_modules:
    try:
        __import__(module)
        print(f"[OK] {module}")
    except Exception as e:
        print(f"[ERROR] {module} - {e}")

print()

# Try loading environment
print("Checking environment variables...")
try:
    from dotenv import load_dotenv
    load_dotenv()
    
    import os
    env_vars = ['MONGO_URI', 'FLASK_SECRET', 'API_KEY', 'MAX_WORKERS', 'MAX_CONCURRENCY']
    for var in env_vars:
        value = os.getenv(var)
        if value:
            if 'SECRET' in var or 'KEY' in var:
                print(f"[OK] {var} = {'*' * 10} (hidden)")
            else:
                print(f"[OK] {var} = {value}")
        else:
            print(f"[ERROR] {var} NOT SET")
except Exception as e:
    print(f"✗ Error loading environment: {e}")

print()

# Try importing app
print("Checking app.py...")
try:
    import app
    print("[OK] app.py imported successfully")
    print(f"[OK] Flask app created: {app.app}")
except Exception as e:
    print(f"[ERROR] Error importing app.py: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)

