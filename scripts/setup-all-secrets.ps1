# PowerShell script to set up ALL secrets from .env file in EAS and Firebase Functions
# Run this from your project root directory: C:\Users\nours\Documents\GitHub\maak-last

Write-Host "Setting up all secrets from .env file..." -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "   Please ensure you're running this from the project root directory" -ForegroundColor Yellow
    exit 1
}

# Read and parse .env file
Write-Host "Reading .env file..." -ForegroundColor Yellow
$envLines = Get-Content ".env"
$secrets = @{}

foreach ($line in $envLines) {
    # Skip comments and empty lines
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
        continue
    }
    
    # Parse KEY=value or KEY="value"
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$') {
        $key = $matches[1]
        $value = $matches[2].Trim()
        
        # Remove quotes if present
        if ($value -match '^"(.*)"$') {
            $value = $matches[1]
        }
        
        # Skip empty values (but keep the key for tracking)
        if ($value -ne "" -and $value -notmatch '^your_.*_here$' -and $value -notmatch '^firebase deploy') {
            $secrets[$key] = $value
        }
    }
}

Write-Host "   Found $($secrets.Count) secrets in .env file" -ForegroundColor Green
Write-Host ""

# Define which secrets go where
# Firebase Functions secrets - ALL secrets from .env EXCEPT public config
# We'll add all secrets except EXPO_PUBLIC_* (those are public config, not secrets)
$firebaseSecrets = @()
foreach ($key in $secrets.Keys) {
    # Skip EXPO_PUBLIC_* keys (these are public config, not secrets)
    if ($key -notmatch '^EXPO_PUBLIC_') {
        $firebaseSecrets += $key
    }
}

# EAS secrets (for Expo builds - all API keys and config)
$easSecrets = @(
    # OpenAI
    "OPENAI_API_KEY",
    "ZEINA_API_KEY",
    # Health integrations
    "FITBIT_CLIENT_ID",
    "FITBIT_CLIENT_SECRET",
    "WITHINGS_CLIENT_ID",
    "WITHINGS_CLIENT_SECRET",
    "OURA_CLIENT_ID",
    "OURA_CLIENT_SECRET",
    "GARMIN_CLIENT_ID",
    "GARMIN_CLIENT_SECRET",
    "SAMSUNG_HEALTH_CLIENT_ID",
    "SAMSUNG_HEALTH_CLIENT_SECRET",
    "DEXCOM_CLIENT_ID",
    "DEXCOM_CLIENT_SECRET",
    "DEXCOM_REDIRECT_URI",
    # RevenueCat
    "REVENUECAT_PROJECT_ID",
    "PUBLIC_REVENUECAT_IOS_API_KEY",
    "PUBLIC_REVENUECAT_ANDROID_API_KEY",
    "PUBLIC_REVENUECAT_API_KEY",
    # Firebase public config (if not already set by setup-eas-firebase-secrets.ps1)
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID"
)

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
    $easConfigured = $true
    $easSuccessCount = 0
    $easSkippedCount = 0
    $easErrorCount = 0
    
    foreach ($secretName in $easSecrets) {
        if ($secrets.ContainsKey($secretName)) {
            $secretValue = $secrets[$secretName]
            Write-Host "   Setting $secretName..." -ForegroundColor Yellow -NoNewline
            
            # Try to create the secret
            $outputFile = "eas_output_$secretName.txt"
            $errorFile = "eas_error_$secretName.txt"
            
            $process = Start-Process -FilePath "eas" -ArgumentList "env:create","--scope","project","--name",$secretName,"--value",$secretValue,"--type","string","--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile
            
            if ($process.ExitCode -eq 0) {
                Write-Host " Success" -ForegroundColor Green
                $easSuccessCount++
            } else {
                $errorContent = Get-Content $errorFile -ErrorAction SilentlyContinue | Out-String
                $outputContent = Get-Content $outputFile -ErrorAction SilentlyContinue | Out-String
                
                # Check if secret already exists
                if ($errorContent -match "already exists" -or $outputContent -match "already exists" -or $errorContent -match "duplicate" -or $outputContent -match "duplicate") {
                    # Try to update instead
                    $updateProcess = Start-Process -FilePath "eas" -ArgumentList "env:update","--scope","project","--name",$secretName,"--value",$secretValue,"--type","string","--visibility","secret","--environment","all","--non-interactive" -NoNewWindow -Wait -PassThru
                    
                    if ($updateProcess.ExitCode -eq 0) {
                        Write-Host " Updated" -ForegroundColor Green
                        $easSuccessCount++
                    } else {
                        Write-Host " Update failed" -ForegroundColor Yellow
                        $easErrorCount++
                    }
                } else {
                    Write-Host " Failed" -ForegroundColor Yellow
                    $easErrorCount++
                }
            }
            
            # Clean up temp files
            Remove-Item $outputFile -ErrorAction SilentlyContinue
            Remove-Item $errorFile -ErrorAction SilentlyContinue
        } else {
            Write-Host "   Skipping $secretName (not in .env or empty)" -ForegroundColor Gray
            $easSkippedCount++
        }
    }
    
    Write-Host ""
    Write-Host "   EAS Summary: $easSuccessCount set/updated, $easSkippedCount skipped, $easErrorCount errors" -ForegroundColor Cyan
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
    $firebaseConfigured = $true
    $firebaseSuccessCount = 0
    $firebaseSkippedCount = 0
    $firebaseErrorCount = 0
    
    foreach ($secretName in $firebaseSecrets) {
        if ($secrets.ContainsKey($secretName)) {
            $secretValue = $secrets[$secretName]
            Write-Host "   Setting $secretName..." -ForegroundColor Yellow -NoNewline
            
            # Create a temp file with the secret value
            $tempFile = [System.IO.Path]::GetTempFileName()
            $secretValue | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline
            
            try {
                # Firebase secrets:set reads from stdin
                Get-Content $tempFile | firebase functions:secrets:set $secretName 2>&1 | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host " Success" -ForegroundColor Green
                    $firebaseSuccessCount++
                } else {
                    Write-Host " Failed" -ForegroundColor Yellow
                    $firebaseErrorCount++
                }
            } catch {
                Write-Host " Error" -ForegroundColor Red
                $firebaseErrorCount++
            } finally {
                # Clean up temp file
                Remove-Item $tempFile -ErrorAction SilentlyContinue
            }
        } else {
            Write-Host "   Skipping $secretName (not in .env or empty)" -ForegroundColor Gray
            $firebaseSkippedCount++
        }
    }
    
    Write-Host ""
    Write-Host "   Firebase Summary: $firebaseSuccessCount set, $firebaseSkippedCount skipped, $firebaseErrorCount errors" -ForegroundColor Cyan
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  • Local (.env): $($secrets.Count) secrets found" -ForegroundColor Green
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
Write-Host "  • Verify Firebase secrets: firebase functions:secrets:access SECRET_NAME" -ForegroundColor Gray
Write-Host "  • Deploy Firebase Functions: firebase deploy --only functions" -ForegroundColor Gray
Write-Host "  • Rebuild your app for EAS changes to take effect" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: All non-public secrets from .env have been added to Firebase Functions" -ForegroundColor Cyan
Write-Host "      (EXPO_PUBLIC_* keys are excluded as they are public configuration)" -ForegroundColor Cyan
Write-Host ""
