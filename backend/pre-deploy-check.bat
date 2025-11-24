@echo off
REM Pre-deployment check script for PII Sentinel Backend (Windows)

echo ========================================
echo PII Sentinel Backend - Pre-Deployment Check
echo ========================================
echo.

REM Check if we're in the backend directory
if not exist "app.py" (
    echo [X] Error: Run this script from the backend\ directory
    exit /b 1
)

echo [OK] In backend directory
echo.

REM Check for required files
echo Checking required files...
call :checkfile "app.py"
call :checkfile "requirements.txt"
call :checkfile "gunicorn_config.py"
call :checkfile "render.yaml"
call :checkfile ".env.production"
call :checkfile "mongo_client.py"
call :checkfile "worker_stub.py"
echo.

REM Check if gunicorn is in requirements.txt
echo Checking dependencies...
findstr /C:"gunicorn" requirements.txt >nul
if %errorlevel% == 0 (
    echo   [OK] gunicorn in requirements.txt
) else (
    echo   [X] gunicorn missing from requirements.txt
)
echo.

REM Check Python version
echo Checking Python version...
python --version
python -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if %errorlevel% == 0 (
    echo   [OK] Python 3.11+ detected
) else (
    echo   [!] Warning: Python 3.11+ recommended
)
echo.

REM Check if virtual environment is activated
echo Checking virtual environment...
if not defined VIRTUAL_ENV (
    echo   [!] Virtual environment not activated
    echo   Run: venv\Scripts\activate
) else (
    echo   [OK] Virtual environment active
)
echo.

REM Check environment files
echo Checking environment files...
if exist ".env" (
    echo   [!] .env file found (ensure it's in .gitignore)
) else (
    echo   [OK] No .env file (use Render environment variables)
)

if exist ".env.production" (
    echo   [OK] .env.production template exists
) else (
    echo   [X] .env.production template missing
)
echo.

REM Check git status
echo Checking git status...
where git >nul 2>&1
if %errorlevel% == 0 (
    git status >nul 2>&1
    if %errorlevel% == 0 (
        git status --porcelain | find /c /v "" >nul
        echo   Current branch: 
        git rev-parse --abbrev-ref HEAD
    ) else (
        echo   [!] Not a git repository
    )
) else (
    echo   [!] Git not installed
)
echo.

REM Test imports
echo Testing Python imports...
python -c "import flask; import pymongo; import gunicorn" >nul 2>&1
if %errorlevel% == 0 (
    echo   [OK] Core dependencies installed
) else (
    echo   [X] Missing dependencies. Run: pip install -r requirements.txt
)
echo.

REM Final recommendations
echo ========================================
echo Pre-Deployment Summary
echo ========================================
echo.
echo Before deploying to Render:
echo 1. Commit all changes: git commit -am "Production ready"
echo 2. Push to GitHub: git push origin main
echo 3. Generate secrets: python generate_secrets.py
echo 4. Setup MongoDB Atlas cluster
echo 5. Create Render web service
echo 6. Set environment variables in Render dashboard
echo 7. Deploy and test /api/health endpoint
echo.
echo Read: RENDER_DEPLOYMENT_GUIDE.md for full instructions
echo.

exit /b 0

:checkfile
if exist %1 (
    echo   [OK] %~1
) else (
    echo   [X] Missing: %~1
)
exit /b 0

