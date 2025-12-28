# PowerShell script to ensure all rtlText styles have textAlign: "right"
# This ensures all text aligns right when Arabic is selected

$files = Get-ChildItem -Path "app" -Recurse -Include *.tsx,*.ts | Where-Object { $_.FullName -notmatch "node_modules" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    
    $originalContent = $content
    
    # Check if file has rtlText style definition
    if ($content -match 'rtlText:\s*\{') {
        # Check if textAlign is already set
        if ($content -notmatch 'rtlText:\s*\{[^}]*textAlign') {
            # Add textAlign: "right" to rtlText style
            $content = $content -replace '(rtlText:\s*\{)', '$1`n    textAlign: "right",'
            Write-Host "Updated rtlText in: $($file.FullName)"
        }
    }
    
    # Also ensure inline styles with isRTL use textAlign right
    # This is a more complex pattern, so we'll handle it case by case if needed
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
    }
}

Write-Host "RTL text alignment update complete!"

