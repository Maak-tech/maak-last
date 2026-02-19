# PowerShell script to set up OpenAI API secrets in EAS and Firebase Functions
# Run this from your project root directory: C:\Users\nours\Documents\GitHub\maak-last

Write-Host "Setting up OpenAI API secrets..." -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please ensure you're running this from the project root directory" -ForegroundColor Yellow
    exit 1
}

# Read .env file and extract OPENAI_API_KEY
Write-Host "Reading OPENAI_API_KEY from .env..." -ForegroundColor Yellow
$envLines = Get-Content ".env"
$openaiKey = $null
$zeinaKey = $null

# Parse OPENAI_API_KEY (handle both formats: KEY=value and KEY="value")
foreach ($line in $envLines) {
    if ($line -match '^\s*OPENAI_API_KEY\s*=\s*(.+)$') {
        $value = $matches[1].Trim()
        # Remove quotes if present
        if ($value -match '^"(.*)"$') {
            $openaiKey = $matches[1]
        } else {
            $openaiKey = $value
        }
        Write-Host "   Found OPENAI_API_KEY" -ForegroundColor Green
    }
    if ($line -match '^\s*ZEINA_API_KEY\s*=\s*(.+)$') {
        $value = $matches[1].Trim()
        # Remove quotes if present
        if ($value -match '^"(.*)"$') {
            $zeinaKey = $matches[1]
        } else {
            $zeinaKey = $value
        }
        if ($zeinaKey -ne "" -and $zeinaKey -ne $openaiKey) {
            Write-Host "   Found ZEINA_API_KEY" -ForegroundColor Green
        }
    }
}

if (-not $openaiKey) {
    Write-Host "   Warning: OPENAI_API_KEY not found in .env" -ForegroundColor Yellow
}

# Validate key format
if ($openaiKey -and $openaiKey -notmatch '^sk-') {
    Write-Host "   Warning: OPENAI_API_KEY doesn't start with 'sk-' - may be invalid" -ForegroundColor Yellow
}

if (-not $openaiKey -or $openaiKey -eq "") {
    Write-Host ""
    Write-Host "Error: OPENAI_API_KEY is empty or not found in .env" -ForegroundColor Red
    Write-Host "   Please add OPENAI_API_KEY=your-key-here to your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# ============================================
# 1. Set up EAS Secrets (for Expo builds)
# ============================================
Write-Host "1. Setting up EAS Secrets (for Expo builds)..." -ForegroundColor Cyan
Write-Host ""

# Check if EAS CLI is installed
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Write-Host "   Warning: EAS CLI not found. Install with: npm install -g eas-cli" -ForegroundColor Yellow
    Write-Host "   Skipping EAS secrets setup..." -ForegroundColor Yellow
    $easConfigured = $false
} else {
    Write-Host "   Setting OPENAI_API_KEY in EAS..." -ForegroundColor Yellow
    $easConfigured = $true
    
    # Try to create the secret (using new eas env:create syntax)
    $process = Start-Process -FilePath "eas" -ArgumentList "env:create","--name","OPENAI_API_KEY","--value",$openaiKey,"--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "eas_output.txt" -RedirectStandardError "eas_error.txt"
    
    if ($process.ExitCode -eq 0) {
        Write-Host "   Success: OPENAI_API_KEY set in EAS" -ForegroundColor Green
    } else {
        $errorContent = Get-Content "eas_error.txt" -ErrorAction SilentlyContinue | Out-String
        $outputContent = Get-Content "eas_output.txt" -ErrorAction SilentlyContinue | Out-String
        
        # Check if secret already exists
        if ($errorContent -match "already exists" -or $outputContent -match "already exists" -or $errorContent -match "duplicate" -or $outputContent -match "duplicate") {
            Write-Host "   Info: OPENAI_API_KEY already exists in EAS (updating...)" -ForegroundColor Yellow
            # Try to update instead (using new eas env:update syntax)
            $updateProcess = Start-Process -FilePath "eas" -ArgumentList "env:update","--name","OPENAI_API_KEY","--value",$openaiKey,"--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru
            
            if ($updateProcess.ExitCode -eq 0) {
                Write-Host "   Success: OPENAI_API_KEY updated in EAS" -ForegroundColor Green
            } else {
                Write-Host "   Warning: Could not update OPENAI_API_KEY in EAS (may need manual update)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   Warning: Failed to set OPENAI_API_KEY in EAS" -ForegroundColor Yellow
            if ($errorContent) {
                Write-Host "      Error: $errorContent" -ForegroundColor Red
            }
        }
    }
    
    # Clean up temp files
    Remove-Item "eas_output.txt" -ErrorAction SilentlyContinue
    Remove-Item "eas_error.txt" -ErrorAction SilentlyContinue

    # Always set ZEINA_API_KEY (use ZEINA_API_KEY if set, otherwise use OPENAI_API_KEY)
    # This ensures both keys are available in EAS, even if they have the same value
    $zeinaKeyToSet = if ($zeinaKey -and $zeinaKey -ne "") { $zeinaKey } else { $openaiKey }
    
    if ($zeinaKeyToSet -and $zeinaKeyToSet -ne "") {
        Write-Host ""
        Write-Host "   Setting ZEINA_API_KEY in EAS..." -ForegroundColor Yellow
        $zeinaProcess = Start-Process -FilePath "eas" -ArgumentList "env:create","--name","ZEINA_API_KEY","--value",$zeinaKeyToSet,"--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "zeina_output.txt" -RedirectStandardError "zeina_error.txt"
        
        if ($zeinaProcess.ExitCode -eq 0) {
            Write-Host "   Success: ZEINA_API_KEY set in EAS" -ForegroundColor Green
        } else {
            $zeinaError = Get-Content "zeina_error.txt" -ErrorAction SilentlyContinue | Out-String
            $zeinaOutput = Get-Content "zeina_output.txt" -ErrorAction SilentlyContinue | Out-String
            
            if ($zeinaError -match "already exists" -or $zeinaOutput -match "already exists" -or $zeinaError -match "duplicate" -or $zeinaOutput -match "duplicate") {
                Write-Host "   Info: ZEINA_API_KEY already exists in EAS (updating...)" -ForegroundColor Yellow
                $zeinaUpdateProcess = Start-Process -FilePath "eas" -ArgumentList "env:update","--name","ZEINA_API_KEY","--value",$zeinaKeyToSet,"--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru
                
                if ($zeinaUpdateProcess.ExitCode -eq 0) {
                    Write-Host "   Success: ZEINA_API_KEY updated in EAS" -ForegroundColor Green
                } else {
                    Write-Host "   Warning: Could not update ZEINA_API_KEY in EAS (may need manual update)" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   Warning: Failed to set ZEINA_API_KEY in EAS" -ForegroundColor Yellow
                if ($zeinaError) {
                    Write-Host "      Error: $zeinaError" -ForegroundColor Red
                }
            }
        }
        
        Remove-Item "zeina_output.txt" -ErrorAction SilentlyContinue
        Remove-Item "zeina_error.txt" -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# ============================================
# 2. Set up Firebase Functions Secrets
# ============================================
Write-Host "2. Setting up Firebase Functions Secrets..." -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "   Warning: Firebase CLI not found. Install with: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "   Skipping Firebase Functions secrets setup..." -ForegroundColor Yellow
    $firebaseConfigured = $false
} else {
    Write-Host "   Setting OPENAI_API_KEY in Firebase Functions..." -ForegroundColor Yellow
    Write-Host "   (The secret will be piped to Firebase CLI)" -ForegroundColor Gray
    Write-Host ""
    
    $firebaseConfigured = $true
    
    # Create a temp file with the key
    $tempFile = [System.IO.Path]::GetTempFileName()
    $openaiKey | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline
    
    try {
        # Firebase secrets:set reads from stdin
        Get-Content $tempFile | firebase functions:secrets:set OPENAI_API_KEY
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "   Success: OPENAI_API_KEY set in Firebase Functions" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "   Warning: Failed to set OPENAI_API_KEY in Firebase Functions" -ForegroundColor Yellow
            Write-Host "      Make sure you're logged in: firebase login" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "   Warning: Error setting Firebase secret: $_" -ForegroundColor Yellow
    } finally {
        # Clean up temp file
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  • Local (.env): Configured" -ForegroundColor Green
if ($easConfigured) {
    Write-Host "  • EAS Secrets: Configured" -ForegroundColor Green
} else {
    Write-Host "  • EAS Secrets: Skipped (EAS CLI not installed)" -ForegroundColor Yellow
}
if ($firebaseConfigured) {
    Write-Host "  • Firebase Functions: Configured" -ForegroundColor Green
} else {
    Write-Host "  • Firebase Functions: Skipped (Firebase CLI not installed)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  • Verify EAS secrets: eas env:list" -ForegroundColor Gray
Write-Host "  • Verify Firebase secrets: firebase functions:secrets:access OPENAI_API_KEY" -ForegroundColor Gray
Write-Host "  • Rebuild your app for changes to take effect" -ForegroundColor Gray
Write-Host ""
