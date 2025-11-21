# PII Sentinel Backend

A production-ready MVP for real-time PII (Personally Identifiable Information) detection and masking from documents and images. Supports 13 Indian government PIIs + 20 custom PIIs with parallel processing capabilities.

## Features

- **Real-time Document Processing**: Upload PDFs, DOCX, TXT, CSV, and images (PNG, JPG/JPEG)
- **OCR Engine**: EasyOCR (GPU-accelerated) with Tesseract fallback
- **PII Detection**: 
  - 13 Indian Government PIIs (PAN, Aadhaar, Phone, Email, IFSC, UPI, Passport, Voter ID, Driving License, Bank Account, DOB, Name, Address)
  - 20 Custom PIIs (Employee ID, Customer ID, Vehicle Number, etc.)
- **Parallel Processing**: Handle 100-200 documents concurrently
- **Masking Options**:
  - Deterministic reversible hashing (AES-GCM encryption)
  - Visual blur masking
- **Batch Management**: Organize files into batches with analytics
- **MongoDB Integration**: Store batch metadata and results
- **React Frontend**: ChatGPT-style UI with analysis dashboard

## Hardware Requirements

### For 100-200 Documents in Seconds:

**Recommended Setup:**
- **GPU**: NVIDIA GPU with CUDA support (e.g., RTX 4090, A100, or AWS p4/gn instances)
- **CPU**: 16+ cores (e.g., Intel Xeon or AMD EPYC)
- **RAM**: 32GB+ (64GB recommended for large batches)
- **Storage**: SSD with high I/O throughput
- **Network**: High bandwidth for MongoDB Atlas connection

**Minimum Setup (Slower Processing):**
- **CPU**: 8+ cores
- **RAM**: 16GB
- **Storage**: SSD
- Processing will be slower without GPU acceleration

### Scaling Tips for Production:

1. **GPU Inference**: Use TensorRT or ONNX Runtime for optimized model inference
2. **Distributed Processing**: Consider using Celery with Redis/RabbitMQ for distributed task queues
3. **Triton Inference Server**: For high-throughput model serving
4. **Batch Optimization**: Tune `MAX_WORKERS` and `MAX_CONCURRENCY` based on your hardware
5. **Database**: Use MongoDB connection pooling and read replicas for high load

## Installation

### Backend Setup

1. **Clone and navigate to backend:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Optional: Install transformers for NER (recommended):**
```bash
pip install -r requirements-optional.txt
```

5. **Install Tesseract OCR:**
   - **Ubuntu/Debian**: `sudo apt-get install tesseract-ocr tesseract-ocr-eng`
   - **macOS**: `brew install tesseract`
   - **Windows**: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

6. **Configure environment:**
```bash
cp env.example .env
# Edit .env with your MongoDB Atlas URI and other settings
```

7. **Create data directories:**
```bash
mkdir -p data/uploads data/results data/masked
```

### Frontend Setup

1. **Navigate to frontend:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure (optional):**
Create `.env` file:
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_API_KEY=your-api-key
```

## Running

### Backend

**Option 1: Using run script (Linux/macOS):**
```bash
chmod +x run.sh
./run.sh
```

**Option 2: Manual:**
```bash
python app.py
```

The API will run on `http://localhost:5000` (or port specified in `.env`).

### Frontend

```bash
npm start
```

The frontend will run on `http://localhost:3000`.

## Environment Variables

Create a `.env` file in the `backend` directory:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_PREFIX=pii_sentinel_
FLASK_SECRET=your-secret-key-change-in-production
API_KEY=your-api-key-change-in-production
MAX_WORKERS=16
MAX_CONCURRENCY=50
USE_GPU=true
STORAGE_PATH=./data
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
```

## API Endpoints

### Authentication
All endpoints require `X-API-KEY` header.

### Create Batch
```bash
curl -X POST http://localhost:5000/api/create-batch \
  -H "X-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Batch"}'
```

Response:
```json
{
  "batch_id": "uuid-here",
  "name": "My Batch",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Upload Files
```bash
curl -X POST "http://localhost:5000/api/upload?batch_id=uuid-here" \
  -H "X-API-KEY: your-api-key" \
  -F "files[]=@document1.pdf" \
  -F "files[]=@document2.jpg"
```

Response:
```json
{
  "job_id": "job-uuid",
  "batch_id": "batch-uuid",
  "file_count": 2,
  "status": "processing"
}
```

### Get Job Result
```bash
curl -X GET "http://localhost:5000/api/job-result?job_id=job-uuid" \
  -H "X-API-KEY: your-api-key"
```

### Apply Masking
```bash
curl -X POST http://localhost:5000/api/mask \
  -H "X-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job-uuid",
    "mask_type": "blur",
    "password": "optional-for-hash"
  }'
```

### Get Batch Analysis
```bash
curl -X GET "http://localhost:5000/api/batch/batch-uuid/analysis" \
  -H "X-API-KEY: your-api-key"
```

### List Batches
```bash
curl -X GET "http://localhost:5000/api/batches?user_id=default&limit=100" \
  -H "X-API-KEY: your-api-key"
```

## Testing

Run unit tests:
```bash
cd backend
python -m pytest tests/ -v
```

Or using unittest:
```bash
python -m unittest tests.test_validators
```

## Docker Deployment

Build image:
```bash
docker build -t pii-sentinel-backend .
```

Run container:
```bash
docker run -p 5000:5000 \
  -e MONGO_URI=your-mongo-uri \
  -e API_KEY=your-api-key \
  -v $(pwd)/data:/app/data \
  pii-sentinel-backend
```

## Project Structure

```
PII-Sentinel-backend/
├── backend/
│   ├── app.py                 # Flask API main
│   ├── ocr_engine.py          # OCR wrapper (EasyOCR/Tesseract)
│   ├── pii_detector.py        # PII detection logic
│   ├── parallel_processor.py  # Parallel processing manager
│   ├── maskers.py             # Masking utilities
│   ├── mongo_client.py        # MongoDB operations
│   ├── worker_stub.py         # File processing workers
│   ├── utils.py               # Helper functions
│   ├── requirements.txt       # Python dependencies
│   ├── tests/                 # Unit tests
│   └── Dockerfile             # Docker configuration
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main React app
│   │   ├── components/        # React components
│   │   ├── api.js             # API client
│   │   └── styles.css         # Styling
│   └── package.json           # NPM dependencies
└── README.md                  # This file
```

## Production Hardening (TODOs)

- [ ] Add proper authentication (JWT, OAuth)
- [ ] Implement rate limiting (Flask-Limiter)
- [ ] Add request validation and sanitization
- [ ] Set up logging and monitoring (Sentry, CloudWatch)
- [ ] Add health checks and metrics endpoints
- [ ] Implement retry logic for external services
- [ ] Add caching layer (Redis) for frequently accessed data
- [ ] Set up CI/CD pipeline
- [ ] Add comprehensive error handling and user feedback
- [ ] Implement file size and type validation
- [ ] Add audit logging for compliance
- [ ] Set up backup and disaster recovery
- [ ] Optimize database queries and indexing
- [ ] Add API versioning
- [ ] Implement request/response compression

## License

This is a production-ready MVP scaffold. Customize as needed for your use case.

## Support

For issues or questions, please check the code comments and TODOs for guidance on production hardening.

