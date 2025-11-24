#!/bin/bash
# Pre-deployment check script for PII Sentinel Backend

echo "🔍 PII Sentinel Backend - Pre-Deployment Check"
echo "=============================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "app.py" ]; then
    echo "❌ Error: Run this script from the backend/ directory"
    exit 1
fi

echo "✓ In backend directory"
echo ""

# Check for required files
echo "📁 Checking required files..."
required_files=(
    "app.py"
    "requirements.txt"
    "gunicorn_config.py"
    "render.yaml"
    ".env.production"
    "mongo_client.py"
    "worker_stub.py"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ❌ Missing: $file"
    fi
done
echo ""

# Check if gunicorn is in requirements.txt
echo "📦 Checking dependencies..."
if grep -q "gunicorn" requirements.txt; then
    echo "  ✓ gunicorn in requirements.txt"
else
    echo "  ❌ gunicorn missing from requirements.txt"
fi
echo ""

# Check Python version
echo "🐍 Checking Python version..."
python_version=$(python --version 2>&1)
echo "  Current: $python_version"
if python -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    echo "  ✓ Python 3.11+ detected"
else
    echo "  ⚠️  Warning: Python 3.11+ recommended"
fi
echo ""

# Check if virtual environment is activated
echo "🔧 Checking virtual environment..."
if [ -z "$VIRTUAL_ENV" ]; then
    echo "  ⚠️  Virtual environment not activated"
    echo "  Run: source venv/bin/activate (Linux/Mac)"
    echo "  Or: venv\\Scripts\\activate (Windows)"
else
    echo "  ✓ Virtual environment active: $VIRTUAL_ENV"
fi
echo ""

# Check if .env file exists (should not in production)
echo "🔐 Checking environment files..."
if [ -f ".env" ]; then
    echo "  ⚠️  .env file found (ensure it's in .gitignore)"
else
    echo "  ✓ No .env file (use Render environment variables)"
fi

if [ -f ".env.production" ]; then
    echo "  ✓ .env.production template exists"
else
    echo "  ❌ .env.production template missing"
fi
echo ""

# Check git status
echo "📦 Checking git status..."
if command -v git &> /dev/null; then
    if git status &> /dev/null; then
        uncommitted=$(git status --porcelain | wc -l)
        if [ $uncommitted -eq 0 ]; then
            echo "  ✓ All changes committed"
        else
            echo "  ⚠️  You have $uncommitted uncommitted changes"
            echo "  Run: git status"
        fi
        
        branch=$(git rev-parse --abbrev-ref HEAD)
        echo "  Current branch: $branch"
    else
        echo "  ⚠️  Not a git repository"
    fi
else
    echo "  ⚠️  Git not installed"
fi
echo ""

# Test imports
echo "📚 Testing Python imports..."
if python -c "import flask; import pymongo; import gunicorn" 2>/dev/null; then
    echo "  ✓ Core dependencies installed"
else
    echo "  ❌ Missing dependencies. Run: pip install -r requirements.txt"
fi
echo ""

# Check MongoDB connection (if .env exists)
echo "🗄️  MongoDB connection check..."
if [ -f ".env" ]; then
    echo "  Testing MongoDB connection..."
    if python -c "from mongo_client import mongo_client; print('✓ MongoDB connection OK' if mongo_client.get_connection_status()['connected'] else '❌ MongoDB connection failed')" 2>/dev/null; then
        :
    else
        echo "  ⚠️  Could not test MongoDB (check mongo_client.py)"
    fi
else
    echo "  ⚠️  No .env file to test (will use Render env vars in production)"
fi
echo ""

# Final recommendations
echo "=============================================="
echo "📋 Pre-Deployment Summary"
echo "=============================================="
echo ""
echo "Before deploying to Render:"
echo "1. ✓ Commit all changes: git commit -am 'Production ready'"
echo "2. ✓ Push to GitHub: git push origin main"
echo "3. ✓ Generate secrets: python generate_secrets.py"
echo "4. ✓ Setup MongoDB Atlas cluster"
echo "5. ✓ Create Render web service"
echo "6. ✓ Set environment variables in Render dashboard"
echo "7. ✓ Deploy and test /api/health endpoint"
echo ""
echo "📖 Read: RENDER_DEPLOYMENT_GUIDE.md for full instructions"
echo ""

