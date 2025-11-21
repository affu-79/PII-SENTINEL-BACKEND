#!/usr/bin/env python3
"""
Direct MongoDB inspection tool to see what's actually stored in batches.
"""
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('MONGO_DB_PREFIX', 'pii_sentinel_') + 'main'

print(f"MongoDB URI: {MONGO_URI[:50]}...")
print(f"Database: {DB_NAME}")
print()

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("✓ Connected to MongoDB")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    exit(1)

db = client[DB_NAME]
batches_col = db.batches

print("\n" + "="*80)
print("BATCHES IN DATABASE")
print("="*80)

batches = list(batches_col.find({}, {"_id": 0, "batch_id": 1, "name": 1, "files": 1}).sort("created_at", -1).limit(3))

for batch in batches:
    batch_id = batch.get('batch_id')
    name = batch.get('name')
    files = batch.get('files', [])
    
    print(f"\nBatch: {name} (ID: {batch_id})")
    print(f"Files: {len(files)}")
    
    for file_idx, file_data in enumerate(files):
        filename = file_data.get('filename')
        piis = file_data.get('piis', [])
        pii_count = file_data.get('pii_count', 0)
        
        print(f"\n  File {file_idx}: {filename}")
        print(f"    pii_count field: {pii_count}")
        print(f"    piis array length: {len(piis) if isinstance(piis, list) else 'NOT A LIST'}")
        print(f"    piis type: {type(piis).__name__}")
        
        if isinstance(piis, list) and len(piis) > 0:
            sample = piis[0]
            print(f"    Sample PII[0]:")
            print(f"      Type: {type(sample).__name__}")
            if isinstance(sample, dict):
                print(f"      Keys: {list(sample.keys())}")
                print(f"      Value: {str(sample.get('value', sample.get('match', '')))[:60]}")
            else:
                print(f"      Content: {str(sample)[:60]}")
        else:
            print(f"    ⚠️  No PIIs in this file!")

print("\n" + "="*80)

