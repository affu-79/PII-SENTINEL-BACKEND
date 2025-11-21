# PII Sentinel - Frontend Server
$Host.UI.RawUI.WindowTitle = "PII Sentinel - Frontend Server"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PII Sentinel Frontend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting React app on http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Change to frontend directory
Set-Location -Path (Join-Path $PSScriptRoot "frontend")

# Run npm start
npm start

