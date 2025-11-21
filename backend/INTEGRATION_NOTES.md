# Backend Integration Notes for Report Generation

## Required Changes to `app.py`

### 1. Import Report Routes

Add this to the imports section of `backend/app.py`:

```python
from routes.reports import reports_bp
```

### 2. Register Blueprint

After creating the Flask app and before running it, register the reports blueprint:

```python
# Around line 100-150, where other blueprints are registered:
app.register_blueprint(reports_bp)

# Example location in app.py:
if __name__ == '__main__':
    # ... existing setup code ...
    
    # Register blueprints
    app.register_blueprint(reports_bp)  # Add this line
    
    # ... rest of the code ...
```

### 3. Ensure Headers are Set

The report routes expect these headers from the client:

```python
# The routes automatically extract:
# - Authorization: Bearer <token>  (required)
# - X-User-ID: <user_id>          (optional, defaults to 'anonymous')
# - User-Agent: <client_info>     (optional, for audit logging)
```

Make sure your frontend is sending these headers. Update `frontend/src/api.js`:

```javascript
// Add to API instance configuration:
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'X-User-ID': localStorage.getItem('userId')
  }
});
```

## Database Collection Initialization

### Option 1: Python Migration Script (Recommended)

The Python migration script is the recommended approach:

```bash
python backend/migrations/001_create_reports_collections.py
```

This script will automatically:
- ✅ Create `reports` collection with JSON schema validation
- ✅ Create `reports_audit` collection with JSON schema validation
- ✅ Create 6 indexes on `reports` (including TTL for auto-cleanup)
- ✅ Create 6 indexes on `reports_audit`
- ✅ Verify collections were created
- ✅ Display migration statistics

### Option 2: MongoDB Shell Manual Setup

If you prefer manual setup, use mongosh:

```javascript
use pii_sentinel_main

// Create reports collection with validation
db.createCollection("reports", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["batch_id", "file_path", "file_name", "created_at", "created_by", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        batch_id: { bsonType: "string" },
        file_path: { bsonType: "string" },
        file_name: { bsonType: "string" },
        file_size: { bsonType: "int" },
        created_at: { bsonType: "date" },
        created_by: { bsonType: "string" },
        status: { bsonType: "string", enum: ["pending", "started", "ready", "failed", "deleted"] },
        job_id: { bsonType: "string" },
        error_log: { bsonType: "string" },
        options: { bsonType: "object" },
        checksum: { bsonType: "string" },
        expires_at: { bsonType: "date" },
        deleted_at: { bsonType: "date" }
      }
    }
  }
});

// Create reports_audit collection
db.createCollection("reports_audit", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["report_id", "user_id", "action", "timestamp"],
      properties: {
        _id: { bsonType: "objectId" },
        report_id: { bsonType: "objectId" },
        batch_id: { bsonType: "string" },
        user_id: { bsonType: "string" },
        action: { bsonType: "string", enum: ["created", "viewed", "downloaded", "deleted", "expired"] },
        timestamp: { bsonType: "date" },
        ip_address: { bsonType: "string" },
        user_agent: { bsonType: "string" },
        notes: { bsonType: "string" }
      }
    }
  }
});

// Create indexes
db.reports.createIndex({ batch_id: 1 });
db.reports.createIndex({ created_by: 1 });
db.reports.createIndex({ created_at: -1 });
db.reports.createIndex({ status: 1 });
db.reports.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
db.reports.createIndex({ batch_id: 1, status: 1 });

db.reports_audit.createIndex({ report_id: 1 });
db.reports_audit.createIndex({ batch_id: 1 });
db.reports_audit.createIndex({ user_id: 1 });
db.reports_audit.createIndex({ timestamp: -1 });
db.reports_audit.createIndex({ action: 1 });
db.reports_audit.createIndex({ batch_id: 1, action: 1 });
```

## Environment Configuration

### Add to `.env`:

```env
# Report Generation Settings
REPORTS_PATH=/var/pii-sentinel/reports
MAX_REPORT_AGE=30
TEMP_DIR=/tmp/pii-sentinel

# Logging (optional)
REPORT_LOG_LEVEL=INFO

# Storage limits (optional)
MAX_REPORT_SIZE_MB=50
MAX_REPORTS_PER_BATCH=5
```

### Add to `.env.example`:

```env
# Report Generation
REPORTS_PATH=/var/pii-sentinel/reports    # Secure storage path
MAX_REPORT_AGE=30                           # Days before auto-cleanup
TEMP_DIR=/tmp/pii-sentinel                  # Temporary file directory
```

## Security Configuration

### 1. File Permissions (Linux/Mac)

```bash
# Create reports directory with restrictive permissions
sudo mkdir -p /var/pii-sentinel/reports
sudo chmod 700 /var/pii-sentinel/reports
sudo chown appuser:appuser /var/pii-sentinel/reports
```

### 2. Nginx Configuration (if using Nginx)

```nginx
# Add to nginx.conf to prevent direct access to reports
location /data/reports {
    deny all;
}
```

### 3. Apache Configuration (if using Apache)

```apache
# Add to .htaccess in web root
<FilesMatch "\.pdf$">
    Deny from all
</FilesMatch>

# Or if reports are in a specific directory:
<Directory /var/www/reports>
    Deny from all
</Directory>
```

## Testing the Integration

### 1. Test Database Connection

```bash
python -c "from mongo_client import mongo_client; print(mongo_client.db.reports.count_documents({}))"
```

### 2. Test API Endpoint

```bash
# Start Flask server
python backend/app.py

# In another terminal:
curl -X POST http://localhost:5000/api/report/generate/test_batch_123 \
  -H "Authorization: Bearer test-token" \
  -H "X-User-ID: test-user" \
  -H "Content-Type: application/json" \
  -d '{"include_raw_pii": false, "include_charts": true}'
```

### 3. Test Frontend Integration

```javascript
// In browser console on Analysis page:
import GenerateReportButton from '../components/GenerateReportButton';
// Check if component loads without errors
```

## Debugging

### Enable Debug Logging

In `backend/routes/reports.py`:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Add debug statements
logger.debug(f"Generating report for batch: {batch_id}")
```

### Check Report Status

```bash
# Query database
mongosh
use pii_sentinel_main
db.reports.find().sort({created_at: -1}).limit(5).pretty()

# Check audit log
db.reports_audit.find().sort({timestamp: -1}).limit(10).pretty()
```

### View Server Logs

```bash
# Flask development server
# Logs appear in console

# Production (systemd)
sudo journalctl -u pii-sentinel -f

# Production (gunicorn + systemd)
sudo journalctl -u gunicorn -f
```

## Performance Considerations

1. **Database Indexes:** Already created during migration
2. **Report Caching:** Existing reports reused if generated within 1 hour
3. **File Storage:** Clean up old reports regularly with cleanup endpoint
4. **Memory Usage:** Large batches may require more memory for PDF generation

## Rollback Instructions

If you need to remove the feature:

1. Delete collections:
```bash
db.reports.drop()
db.reports_audit.drop()
```

2. Remove routes:
```python
# Comment out in app.py:
# app.register_blueprint(reports_bp)
```

3. Delete files:
```bash
rm -rf backend/routes/reports.py
rm -rf backend/report_generator.py
```

---

**Integration Version:** 1.0
**Tested with:** Flask 2.x, MongoDB 5.x+
**For Support:** Check REPORT_GUIDE.md

