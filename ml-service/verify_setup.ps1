# Verification script for PPG ML Service setup

Write-Host "`n=== PPG ML Service Setup Verification ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check virtual environment
Write-Host "Checking virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "  ✅ Virtual environment exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Virtual environment not found" -ForegroundColor Red
    $allGood = $false
}

# Check model weights
Write-Host "`nChecking model weights..." -ForegroundColor Yellow
if (Test-Path "weights\papagei_s.pt") {
    $size = (Get-Item "weights\papagei_s.pt").Length / 1MB
    Write-Host "  ✅ Model weights found ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Model weights not found" -ForegroundColor Red
    Write-Host "     Run: python download_model.py" -ForegroundColor Yellow
    $allGood = $false
}

# Check PaPaGei repository
Write-Host "`nChecking PaPaGei repository..." -ForegroundColor Yellow
if (Test-Path "papagei-foundation-model") {
    Write-Host "  ✅ PaPaGei repository cloned" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  PaPaGei repository not found" -ForegroundColor Yellow
    Write-Host "     Run: git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git" -ForegroundColor Yellow
}

# Check key files
Write-Host "`nChecking key files..." -ForegroundColor Yellow
$files = @("main.py", "requirements.txt", "models\papagei.py", "preprocessing\ppg.py")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING" -ForegroundColor Red
        $allGood = $false
    }
}

# Test Python imports
Write-Host "`nTesting Python imports..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1" | Out-Null
try {
    $result = python -c "import fastapi; import numpy; print('OK')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Core packages import successfully" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Some imports may have issues" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Could not test imports" -ForegroundColor Yellow
}

# Test PyTorch
Write-Host "`nTesting PyTorch..." -ForegroundColor Yellow
try {
    $torchTest = python -c "import torch; print(torch.__version__)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ PyTorch available: $torchTest" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PyTorch import failed (may need Visual C++ Redistributable)" -ForegroundColor Yellow
        Write-Host "     Download: https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Could not test PyTorch" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ Setup looks good! You can start the service." -ForegroundColor Green
    Write-Host "`nTo start:" -ForegroundColor Cyan
    Write-Host "  .\start_service_safe.ps1" -ForegroundColor White
} else {
    Write-Host "⚠️  Some issues found. Please fix them before starting." -ForegroundColor Yellow
}

Write-Host ""
