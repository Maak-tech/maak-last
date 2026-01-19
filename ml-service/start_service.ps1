# PowerShell script to start PPG ML Service with proper environment setup

Write-Host "Starting PPG ML Service..." -ForegroundColor Cyan

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
} else {
    Write-Host "⚠️  PaPaGei repository not found. Cloning..." -ForegroundColor Yellow
    git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
    $env:PYTHONPATH = "$env:PYTHONPATH;$papageiPath"
}

# Check if model weights exist
if (-not (Test-Path "weights\papagei_s.pt")) {
    Write-Host "⚠️  Model weights not found!" -ForegroundColor Yellow
    Write-Host "   Download from: https://zenodo.org/record/13983110" -ForegroundColor Yellow
    Write-Host "   Or run: python download_model.py" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Set environment variables
$env:MODEL_PATH = "weights\papagei_s.pt"
$env:DEVICE = "cpu"
$env:LOG_LEVEL = "INFO"

Write-Host ""
Write-Host "Starting service on http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start the service
python main.py
