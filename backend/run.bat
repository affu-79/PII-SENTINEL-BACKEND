@echo off
REM PII Sentinel Backend Run Script for Windows

echo Starting PII Sentinel Backend...

REM Check if .env file exists
if not exist .env (
    echo Warning: .env file not found. Copy env.example to .env and configure it.
    echo Using default environment variables...
)

REM Check Python version
python --version

REM Check if virtual environment exists
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Optional: Install transformers if needed
set /p install_optional="Install optional dependencies (transformers, torch)? [y/N] "
if /i "%install_optional%"=="y" (
    pip install -r requirements-optional.txt
)

REM Create data directories
if not exist data\uploads mkdir data\uploads
if not exist data\results mkdir data\results
if not exist data\masked mkdir data\masked

REM Run the application
echo Starting Flask server...
python app.py

pause

