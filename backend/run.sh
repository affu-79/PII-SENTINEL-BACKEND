#!/bin/bash

# PII Sentinel Backend Run Script

echo "Starting PII Sentinel Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Copy env.example to .env and configure it."
    echo "Using default environment variables..."
fi

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $python_version"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Optional: Install transformers if needed
read -p "Install optional dependencies (transformers, torch)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pip install -r requirements-optional.txt
fi

# Create data directories
mkdir -p data/uploads data/results data/masked

# Run the application
echo "Starting Flask server..."
python app.py

