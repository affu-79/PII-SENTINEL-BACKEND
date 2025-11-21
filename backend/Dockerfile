FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .
COPY requirements-optional.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Optionally install transformers (uncomment if needed)
# RUN pip install --no-cache-dir -r requirements-optional.txt

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/results /app/data/masked

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Run application
CMD ["python", "app.py"]

