"""
Test MongoDB connection script.
Run this to verify MongoDB connectivity before starting the backend server.
"""
import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Load environment variables
load_dotenv()

def test_mongo_connection():
    """Test MongoDB connection."""
    mongo_uri = os.getenv('MONGO_URI', '')
    
    if not mongo_uri:
        print("❌ ERROR: MONGO_URI not set in .env file")
        print("Please set MONGO_URI in backend/.env file")
        return False
    
    print("=" * 60)
    print("MongoDB Connection Test")
    print("=" * 60)
    print(f"MongoDB URI: {mongo_uri[:30]}...{mongo_uri[-10:]}")
    print()
    
    try:
        print("Attempting to connect to MongoDB...")
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=15000,
            connectTimeoutMS=15000
        )
        
        # Test connection
        print("Testing connection (ping)...")
        client.admin.command('ping')
        print("✅ Connection successful!")
        
        # Get database info
        db_name = f"{os.getenv('MONGO_DB_PREFIX', 'pii_sentinel_')}main"
        db = client[db_name]
        
        # List collections
        collections = db.list_collection_names()
        print(f"\nDatabase: {db_name}")
        print(f"Collections: {', '.join(collections) if collections else 'None'}")
        
        # Test write operation
        print("\nTesting write operation...")
        test_collection = db.test_connection
        test_collection.insert_one({"test": "connection", "timestamp": "now"})
        test_collection.delete_one({"test": "connection"})
        print("✅ Write operation successful!")
        
        client.close()
        print("\n" + "=" * 60)
        print("✅ MongoDB connection test PASSED")
        print("=" * 60)
        return True
        
    except ServerSelectionTimeoutError as e:
        print(f"\n❌ ERROR: Could not connect to MongoDB server")
        print(f"   Timeout: {e}")
        print("\nPossible issues:")
        print("  1. MongoDB Atlas cluster is paused or unavailable")
        print("  2. Network connectivity issues")
        print("  3. IP address not whitelisted in MongoDB Atlas")
        print("  4. Incorrect MongoDB URI")
        return False
        
    except ConnectionFailure as e:
        print(f"\n❌ ERROR: MongoDB connection failed")
        print(f"   Error: {e}")
        return False
        
    except Exception as e:
        print(f"\n❌ ERROR: Unexpected error")
        print(f"   Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_mongo_connection()
    sys.exit(0 if success else 1)

