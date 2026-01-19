# Safe startup script that handles PyTorch errors gracefully
# This will start the service even if PyTorch has issues

Write-Host "Starting PPG ML Service (Safe Mode)..." -ForegroundColor Cyan

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "❌ Virtual environment not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# Set PYTHONPATH to include PaPaGei repository
$papageiPath = Join-Path (Get-Location) "papagei-foundation-model"
if (Test-Path $papageiPath) {
    $env:PYTHONPATH = "$env:PYTHONPATH;$papageiPath"
    Write-Host "✅ Added PaPaGei to PYTHONPATH" -ForegroundColor Green
}

# Check if model weights exist
if (-not (Test-Path "weights\papagei_s.pt")) {
    Write-Host "⚠️  Model weights not found!" -ForegroundColor Yellow
    Write-Host "   The service will start but ML endpoints will be disabled." -ForegroundColor Yellow
    Write-Host ""
}

# Set environment variables
$env:MODEL_PATH = "weights\papagei_s.pt"
$env:DEVICE = "cpu"
$env:LOG_LEVEL = "INFO"

Write-Host ""
Write-Host "Starting service on http://localhost:8000" -ForegroundColor Green
Write-Host "Note: If PyTorch fails to load, the service will still start" -ForegroundColor Yellow
Write-Host "      but ML endpoints will return errors. Health endpoint will work." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start the service
try {
    python main.py
} catch {
    Write-Host ""
    Write-Host "Service stopped with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "If PyTorch failed to load, install Visual C++ Redistributable:" -ForegroundColor Yellow
    Write-Host "  https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor Yellow
}
