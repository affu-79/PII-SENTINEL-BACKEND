#!/usr/bin/env python3
"""
Clear old PII detection data from MongoDB
"""

import logging
from pymongo import MongoClient
import os

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

try:
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    db_prefix = os.getenv('MONGO_DB_PREFIX', 'pii_sentinel_')
    db_name = f"{db_prefix}default"
    
    logger.info(f"🔌 Connecting to MongoDB: {mongo_uri}")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    
    # Test connection
    client.admin.command('ping')
    logger.info("✅ MongoDB connected")
    
    db = client[db_name]
    
    logger.info(f"📊 Database: {db_name}")
    logger.info(f"📋 Collections: {db.list_collection_names()}")
    
    # Clear batches collection (contains PII detection results)
    if 'batches' in db.list_collection_names():
        result = db['batches'].delete_many({})
        logger.info(f"✅ Cleared 'batches': {result.deleted_count} documents deleted")
    
    # Clear detections collection if it exists
    if 'detections' in db.list_collection_names():
        result = db['detections'].delete_many({})
        logger.info(f"✅ Cleared 'detections': {result.deleted_count} documents deleted")
    
    logger.info("")
    logger.info("🧹 DATABASE CLEARED!")
    logger.info("✅ Old PII detection data removed")
    logger.info("✅ Ready for new label-based detection")
    
except Exception as e:
    logger.error(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

