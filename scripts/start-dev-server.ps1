# Start Development Server Script (PowerShell)
# Starts Expo dev server in dev-client mode for development builds

Write-Host "🚀 Starting Expo Development Server" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Get local IP address
Write-Host "Finding your local IP address..." -ForegroundColor Cyan

$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "✅ Your local IP: $ipAddress" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 On your iPhone, connect to:" -ForegroundColor Yellow
    Write-Host "exp://$ipAddress:8081" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "⚠️  Could not automatically detect IP" -ForegroundColor Yellow
    Write-Host "Please find your IP manually:"
    Write-Host "  Run: ipconfig"
    Write-Host ""
}

Write-Host "Starting Expo dev server..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop"
Write-Host ""

# Start Expo dev server with dev-client mode
$env:EXPO_NO_TELEMETRY = "1"
expo start --dev-client

