# PowerShell setup script for PPG ML Service (Windows)

Write-Host "Setting up PPG ML Service..." -ForegroundColor Cyan

# Check Python installation
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python 3.9+ from https://www.python.org/" -ForegroundColor Red
    exit 1
}

# Create virtual environment
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Create weights directory
if (-not (Test-Path "weights")) {
    New-Item -ItemType Directory -Path "weights" | Out-Null
}

# Check if PaPaGei model weights exist
if (-not (Test-Path "weights\papagei_s.pt")) {
    Write-Host ""
    Write-Host "⚠️  WARNING: PaPaGei model weights not found!" -ForegroundColor Yellow
    Write-Host "Please download papagei_s.pt from: https://zenodo.org/record/13983110" -ForegroundColor Yellow
    Write-Host "And place it in the weights\ directory" -ForegroundColor Yellow
    Write-Host ""
    
    # Offer to open download page
    $download = Read-Host "Would you like to open the download page? (y/n)"
    if ($download -eq "y" -or $download -eq "Y") {
        Start-Process "https://zenodo.org/record/13983110"
    }
} else {
    Write-Host "✅ PaPaGei model weights found" -ForegroundColor Green
}

# Initialize or clone PaPaGei repository
if (-not (Test-Path "papagei-foundation-model")) {
    Write-Host ""
    Write-Host "Initializing PaPaGei repository (git submodule)..." -ForegroundColor Yellow
    
    # Check if git is available
    try {
        git --version | Out-Null
        
        # Try to initialize submodule first
        try {
            git submodule update --init --recursive
            Write-Host "✅ PaPaGei repository initialized (submodule)" -ForegroundColor Green
        } catch {
            # Fallback: clone directly if submodule init fails
            Write-Host "Submodule not found, cloning repository..." -ForegroundColor Yellow
            git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
            Write-Host "✅ PaPaGei repository cloned" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Git not found. Please install Git or manually clone:" -ForegroundColor Yellow
        Write-Host "   git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "⚠️  NOTE: You may need to add papagei-foundation-model to your PYTHONPATH" -ForegroundColor Yellow
    Write-Host "   `$env:PYTHONPATH = `"`$env:PYTHONPATH;$(Get-Location)\papagei-foundation-model`"" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Download model weights (if not already done):" -ForegroundColor Yellow
Write-Host "   python download_model.py" -ForegroundColor White
Write-Host ""
Write-Host "2. Start the service:" -ForegroundColor Yellow
Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "   python main.py" -ForegroundColor White
Write-Host ""
Write-Host "3. Test the service (in another terminal):" -ForegroundColor Yellow
Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "   python test_service.py" -ForegroundColor White
Write-Host ""
Write-Host "4. Or use the test script:" -ForegroundColor Yellow
Write-Host "   .\run_tests.ps1" -ForegroundColor White
Write-Host ""
