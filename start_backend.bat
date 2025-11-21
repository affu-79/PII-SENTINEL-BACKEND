@echo off
title PII Sentinel - Backend Server
echo ========================================
echo PII Sentinel Backend Server
echo ========================================
echo Starting Flask server on http://localhost:5000
echo Press Ctrl+C to stop
echo.
cd backend
call venv\Scripts\activate.bat
python app.py
pause

