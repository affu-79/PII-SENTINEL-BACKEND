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

# Configure Google OAuth Client ID for React (read from environment or backend .env)
if (-not $env:REACT_APP_GOOGLE_CLIENT_ID) {
    try {
        $backendEnvPath = Join-Path $PSScriptRoot "backend\.env"
        if (Test-Path $backendEnvPath) {
            $idLine = (Get-Content $backendEnvPath | Where-Object { $_ -match '^\s*GOOGLE_CLIENT_ID\s*=' } | Select-Object -First 1)
            if ($idLine) {
                $idValue = ($idLine -split "=",2)[1].Trim().Trim('\"')
                if ($idValue) { $env:REACT_APP_GOOGLE_CLIENT_ID = $idValue }
            }
        }
    } catch {}
}
if ($env:REACT_APP_GOOGLE_CLIENT_ID) {
    Write-Host "Using REACT_APP_GOOGLE_CLIENT_ID=[configured]" -ForegroundColor Gray
} else {
    Write-Host "WARNING: REACT_APP_GOOGLE_CLIENT_ID not set. Add GOOGLE_CLIENT_ID to backend/.env or set env var." -ForegroundColor Yellow
}

# Ensure redirect URI matches backend and Google console
$env:REACT_APP_GOOGLE_REDIRECT_URI = "postmessage"
Write-Host "Using REACT_APP_GOOGLE_REDIRECT_URI=$env:REACT_APP_GOOGLE_REDIRECT_URI" -ForegroundColor Gray

# Ensure frontend knows backend URL and API key
$env:REACT_APP_API_URL = "http://localhost:5000"
try {
    $backendEnvPath = Join-Path $PSScriptRoot "backend\.env"
    if (Test-Path $backendEnvPath) {
        $apiKeyLine = (Get-Content $backendEnvPath | Where-Object { $_ -match '^\s*API_KEY\s*=' } | Select-Object -First 1)
        if ($apiKeyLine) {
            $apiKey = ($apiKeyLine -split "=",2)[1].Trim().Trim('"')
            if ($apiKey) {
                $env:REACT_APP_API_KEY = $apiKey
                Write-Host "Using REACT_APP_API_KEY=[loaded from backend .env]" -ForegroundColor Gray
            }
        }
    }
} catch {}

# Run npm start
npm start

