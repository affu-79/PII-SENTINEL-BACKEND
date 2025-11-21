# Check server status
Write-Host "Checking PII Sentinel servers..." -ForegroundColor Cyan
Write-Host ""

# Wait a bit longer for startup
Start-Sleep -Seconds 5

# Check backend
Write-Host "Backend Status:" -ForegroundColor Yellow
try {
    $backend = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($backend) {
        Write-Host "✅ Backend is running on http://localhost:5000" -ForegroundColor Green
    }
} catch {
    Write-Host "⏳ Backend still starting or not responding..." -ForegroundColor Yellow
}

# Check frontend
Write-Host ""
Write-Host "Frontend Status:" -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($frontend) {
        Write-Host "✅ Frontend is running on http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "⏳ Frontend still starting or not responding..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Ready to Test Google OAuth!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser: http://localhost:3000/signup" -ForegroundColor White
Write-Host "2. Click 'Continue with Google'" -ForegroundColor White
Write-Host "3. Sign in with your Google account" -ForegroundColor White
Write-Host "4. Should redirect to dashboard" -ForegroundColor White
Write-Host ""

