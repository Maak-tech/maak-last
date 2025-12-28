# PowerShell script to fix the syntax error caused by literal backtick-n
# Replace `n with actual newline

$files = Get-ChildItem -Path "app" -Recurse -Include *.tsx,*.ts | Where-Object { $_.FullName -notmatch "node_modules" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    
    $originalContent = $content
    
    # Replace the literal backtick-n with proper newline
    $content = $content -replace 'rtlText:\s*\{`n\s*textAlign:', "rtlText: {`n    textAlign:"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host "Syntax error fix complete!"

