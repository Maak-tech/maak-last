# PowerShell development startup script
# Starts ML service with hot reload and logging

Write-Host "Starting PPG ML Service in development mode..." -ForegroundColor Cyan

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "❌ Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
& "venv\Scripts\Activate.ps1"

# Check if model weights exist
if (-not (Test-Path "weights\papagei_s.pt")) {
    Write-Host "⚠️  Warning: Model weights not found!" -ForegroundColor Yellow
    Write-Host "   Run: python download_model.py" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Set development environment variables
$env:LOG_LEVEL = "DEBUG"
$env:DEVICE = "cpu"
$env:MODEL_PATH = "weights\papagei_s.pt"

# Start service with auto-reload
Write-Host "Starting service on http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
