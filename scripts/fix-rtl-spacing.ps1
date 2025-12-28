# PowerShell script to replace LTR-specific spacing with RTL-aware spacing
# This script replaces marginLeft/Right, paddingLeft/Right, borderLeft/Right
# with marginStart/End, paddingStart/End, borderStart/End

$files = Get-ChildItem -Path "app" -Recurse -Include *.tsx,*.ts | Where-Object { $_.FullName -notmatch "node_modules" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Replace marginLeft with marginStart
    $content = $content -replace 'marginLeft:', 'marginStart:'
    
    # Replace marginRight with marginEnd
    $content = $content -replace 'marginRight:', 'marginEnd:'
    
    # Replace paddingLeft with paddingStart
    $content = $content -replace 'paddingLeft:', 'paddingStart:'
    
    # Replace paddingRight with paddingEnd
    $content = $content -replace 'paddingRight:', 'paddingEnd:'
    
    # Replace borderLeftWidth with borderStartWidth
    $content = $content -replace 'borderLeftWidth:', 'borderStartWidth:'
    
    # Replace borderRightWidth with borderEndWidth
    $content = $content -replace 'borderRightWidth:', 'borderEndWidth:'
    
    # Replace borderLeftColor with borderStartColor
    $content = $content -replace 'borderLeftColor:', 'borderStartColor:'
    
    # Replace borderRightColor with borderEndColor
    $content = $content -replace 'borderRightColor:', 'borderEndColor:'
    
    # Only write if content changed
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "RTL spacing update complete!"

