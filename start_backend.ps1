# PII Sentinel - Backend Server
$Host.UI.RawUI.WindowTitle = "PII Sentinel - Backend Server"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PII Sentinel Backend Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Flask server on http://localhost:5000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Change to backend directory
$backendDir = Join-Path $PSScriptRoot "backend"
Set-Location -Path $backendDir

# Check if .env exists
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "Created .env file from env.example" -ForegroundColor Yellow
    }
}

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        $line = $line.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                $value = $value -replace '^["]', '' -replace '["]$', ''
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "  Set $key" -ForegroundColor Gray
            }
        }
    }
}

# Google OAuth envs (read from .env or existing environment)
if (-not $env:GOOGLE_CLIENT_ID) {
    Write-Host "WARNING: GOOGLE_CLIENT_ID is not set. Please add GOOGLE_CLIENT_ID to backend/.env" -ForegroundColor Yellow
} else {
    Write-Host "Using GOOGLE_CLIENT_ID=[configured]" -ForegroundColor Gray
}

if (-not $env:GOOGLE_CLIENT_SECRET) {
    Write-Host "WARNING: GOOGLE_CLIENT_SECRET is not set. Please add GOOGLE_CLIENT_SECRET to backend/.env" -ForegroundColor Yellow
} else {
    Write-Host "Using GOOGLE_CLIENT_SECRET=[configured]" -ForegroundColor Gray
}

# Ensure redirect URI is set for code exchange
if (-not $env:GOOGLE_REDIRECT_URI) {
    $env:GOOGLE_REDIRECT_URI = "postmessage"
}
Write-Host "Using GOOGLE_REDIRECT_URI=$env:GOOGLE_REDIRECT_URI" -ForegroundColor Gray

# Check if venv exists
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run: python -m venv venv" -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Activate virtual environment and run
Write-Host "Using Python: $venvPython" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Yellow
Write-Host ""
& $venvPython "app.py"
