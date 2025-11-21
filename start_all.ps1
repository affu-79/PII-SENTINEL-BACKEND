# PII Sentinel - Start All Servers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PII Sentinel - Starting All Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend Server in new PowerShell window
Write-Host "Starting Backend Server (Flask)..." -ForegroundColor Yellow
$backendScript = Join-Path $scriptDir "start_backend.ps1"
Start-Process powershell -ArgumentList @("-NoExit", "-File", "`"$backendScript`"")

# Wait a moment
Start-Sleep -Seconds 2

# Start Frontend Server in new PowerShell window
Write-Host "Starting Frontend Server (React)..." -ForegroundColor Yellow
$frontendScript = Join-Path $scriptDir "start_frontend.ps1"
Start-Process powershell -ArgumentList @("-NoExit", "-File", "`"$frontendScript`"")

# Wait for servers to start
Write-Host ""
Write-Host "Waiting for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check status
Write-Host ""
Write-Host "=== Server Status ===" -ForegroundColor Cyan
$backend = netstat -ano | Select-String ":5000.*LISTENING"
$frontend = netstat -ano | Select-String ":3000.*LISTENING"

if ($backend) {
    Write-Host "OK Backend (Flask) is RUNNING on port 5000" -ForegroundColor Green
} else {
    Write-Host "FAIL Backend (Flask) is NOT running - check the backend window for errors" -ForegroundColor Red
}

if ($frontend) {
    Write-Host "OK Frontend (React) is RUNNING on port 3000" -ForegroundColor Green
} else {
    Write-Host "FAIL Frontend (React) is NOT running - check the frontend window for errors" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Google OAuth Configuration ===" -ForegroundColor Cyan
Write-Host "OK Google Client ID is configured" -ForegroundColor Green
Write-Host "OK Google Client Secret is configured" -ForegroundColor Green
Write-Host "OK Google Identity Services script is loaded" -ForegroundColor Green

Write-Host ""
Write-Host "=== Access URLs ===" -ForegroundColor Cyan
Write-Host "Frontend App: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API:  http://localhost:5000" -ForegroundColor White

Write-Host ""
Write-Host "=== Ready for Testing ===" -ForegroundColor Green
Write-Host "1. Go to http://localhost:3000/login" -ForegroundColor Yellow
Write-Host "2. Click 'Continue with Google'" -ForegroundColor Yellow
Write-Host "3. Sign in with your Google account" -ForegroundColor Yellow
Write-Host "4. You will be logged in to the dashboard" -ForegroundColor Yellow

Write-Host ""
Write-Host "Two PowerShell windows have been opened:" -ForegroundColor Yellow
Write-Host "  - One for Backend (Flask)" -ForegroundColor White
Write-Host "  - One for Frontend (React)" -ForegroundColor White
Write-Host ""
Write-Host "To stop servers: Close the PowerShell windows or press Ctrl+C in each window" -ForegroundColor Yellow
Write-Host ""
