#!/usr/bin/env python3
"""
Test the export logic directly
"""
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

# Import backend modules
from mongo_client import MongoClientWrapper

mongo = MongoClientWrapper()

# Get all batches (use find directly)
from pymongo import DESCENDING
batches_col = mongo.db.batches
batch_doc = batches_col.find_one({}, sort=[("created_at", DESCENDING)])

if not batch_doc:
    print("❌ No batches found in database")
    sys.exit(1)

batch_id = batch_doc.get('batch_id')
print(f"\n{'='*80}")
print(f"Testing export with batch: {batch_id}")
print(f"{'='*80}\n")

# Fetch batch analysis
batch = mongo.get_batch_analysis(batch_id)

if not batch:
    print("❌ Batch not found")
    sys.exit(1)

print(f"✓ Batch loaded: {batch.get('name')}")
print(f"  Keys: {list(batch.keys())}")

files = batch.get('files', [])
print(f"\n✓ Files: {len(files)}")

for file_idx, file_data in enumerate(files):
    filename = file_data.get('filename')
    piis_list = file_data.get('piis', [])
    
    print(f"\n  File {file_idx}: {filename}")
    print(f"    File keys: {list(file_data.keys())}")
    print(f"    'piis' field type: {type(piis_list).__name__}")
    print(f"    'piis' field length: {len(piis_list) if isinstance(piis_list, list) else 'N/A'}")
    
    if isinstance(piis_list, list) and len(piis_list) > 0:
        sample_pii = piis_list[0]
        print(f"    Sample PII[0] type: {type(sample_pii).__name__}")
        if isinstance(sample_pii, dict):
            print(f"    Sample PII keys: {list(sample_pii.keys())}")
            print(f"    Sample PII['value']: {sample_pii.get('value')}")
        print(f"\n    Full sample PII: {json.dumps(sample_pii, indent=2, default=str)[:300]}")
    else:
        print(f"    ⚠️  piis_list is empty or not a list!")

print(f"\n{'='*80}")
print("TEST COMPLETE")
print(f"{'='*80}\n")

