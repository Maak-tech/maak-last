# PowerShell script to set up Firebase secrets in EAS
# Run this from your project root directory: C:\Users\nours\Documents\GitHub\maak-last

Write-Host "🔥 Setting up Firebase secrets in EAS..." -ForegroundColor Cyan
Write-Host ""

# Firebase Configuration Secrets
Write-Host "1. Setting Firebase API Key..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ" --type string --visibility secret --environment all --non-interactive

Write-Host "2. Setting Firebase Auth Domain..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "maak-5caad.firebaseapp.com" --type string --visibility secret --environment all --non-interactive

Write-Host "3. Setting Firebase Project ID..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "maak-5caad" --type string --visibility secret --environment all --non-interactive

Write-Host "4. Setting Firebase Storage Bucket..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "maak-5caad.firebasestorage.app" --type string --visibility secret --environment all --non-interactive

Write-Host "5. Setting Firebase Messaging Sender ID..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "827176918437" --type string --visibility secret --environment all --non-interactive

Write-Host "6. Setting Firebase App ID..." -ForegroundColor Yellow
eas env:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "1:827176918437:web:356fe7e2b4ecb3b99b1c4c" --type string --visibility secret --environment all --non-interactive

Write-Host ""
Write-Host "7. Setting Google Services JSON (Android)..." -ForegroundColor Yellow
if (Test-Path "google-services.json") {
    $jsonContent = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("google-services.json"))
    eas env:create --scope project --name GOOGLE_SERVICES_JSON --type string --value $jsonContent --visibility secret --environment all --non-interactive
    Write-Host "   ✅ google-services.json encoded and uploaded" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Warning: google-services.json not found!" -ForegroundColor Red
    Write-Host "   Please ensure the file exists in the project root" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "8. Setting Google Service Info Plist (iOS)..." -ForegroundColor Yellow
if (Test-Path "GoogleService-Info.plist") {
    $plistContent = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("GoogleService-Info.plist"))
    eas env:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type string --value $plistContent --visibility secret --environment all --non-interactive
    Write-Host "   ✅ GoogleService-Info.plist encoded and uploaded" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Warning: GoogleService-Info.plist not found!" -ForegroundColor Red
    Write-Host "   Please ensure the file exists in the project root" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Firebase secrets setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Verify secrets with: eas env:list" -ForegroundColor Cyan

