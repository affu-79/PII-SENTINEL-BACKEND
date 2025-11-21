@echo off
echo ========================================
echo PII Sentinel - Starting All Servers
echo ========================================
echo.
echo Starting Backend and Frontend servers...
echo Two windows will open - one for each server.
echo.
start "PII Sentinel - Backend" cmd /k start_backend.bat
timeout /t 3 /nobreak >nul
start "PII Sentinel - Frontend" cmd /k start_frontend.bat
echo.
echo Servers are starting in separate windows.
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo To stop servers, close the respective windows.
echo.
pause

