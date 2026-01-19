# PowerShell script to run tests for PPG ML Service

Write-Host "Running PPG ML Service Tests..." -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "❌ Virtual environment not found. Please run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
& "venv\Scripts\Activate.ps1"

# Check if service is running
Write-Host "Checking if service is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Service is running" -ForegroundColor Green
    Write-Host ""
    python test_service.py
} catch {
    Write-Host "⚠️  Service not running. Starting service..." -ForegroundColor Yellow
    Write-Host "Please start the service manually in another terminal:" -ForegroundColor Yellow
    Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  python main.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}
