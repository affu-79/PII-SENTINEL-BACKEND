#!/usr/bin/env python3
"""
Test the export endpoint directly by calling it
"""
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('API_KEY', 'test-api-key')
BACKEND_URL = 'http://localhost:5000'

# Get batch ID from database
from mongo_client import MongoClientWrapper
from pymongo import DESCENDING

mongo = MongoClientWrapper()
batch_doc = mongo.db.batches.find_one({}, sort=[("created_at", DESCENDING)])

if not batch_doc:
    print("❌ No batches in database")
    exit(1)

batch_id = batch_doc.get('batch_id')
print(f"\n{'='*80}")
print(f"Testing export endpoint")
print(f"{'='*80}")
print(f"Batch ID: {batch_id}")
print(f"Backend URL: {BACKEND_URL}")

# Prepare request
payload = {
    'batch_id': batch_id,
    'selected_pii_types': [],
    'password': 'test123',
    'lock_file': False
}

headers = {
    'X-API-KEY': API_KEY,
    'Content-Type': 'application/json'
}

print(f"\nRequest:")
print(f"  URL: {BACKEND_URL}/api/export-pii-json")
print(f"  Payload: {json.dumps(payload, indent=2)}")
print(f"  API Key: {API_KEY[:20]}...")

try:
    response = requests.post(
        f'{BACKEND_URL}/api/export-pii-json',
        json=payload,
        headers=headers,
        timeout=30
    )
    
    print(f"\nResponse:")
    print(f"  Status: {response.status_code}")
    print(f"  Headers: {dict(response.headers)}")
    
    try:
        data = response.json()
        print(f"  Body (parsed JSON):")
        print(json.dumps(data, indent=2))
    except:
        print(f"  Body (raw): {response.text[:500]}")
    
except requests.exceptions.ConnectionError as e:
    print(f"❌ Connection error: {e}")
    print(f"   Is the backend running on {BACKEND_URL}?")
except Exception as e:
    print(f"❌ Error: {e}")

print(f"\n{'='*80}\n")

