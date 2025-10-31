# === Force Node runtime on all Next.js API routes ===
# Run from the project root in PowerShell 7

$ErrorActionPreference = 'Stop'

Write-Host "Scanning for route.ts files..." -ForegroundColor Cyan

Get-ChildItem -Path .\app -Filter route.ts -Recurse | ForEach-Object {
    $p = $_.FullName
    $content = Get-Content $p -Raw

    # skip if already has export const runtime
    if ($content -match "export\s+const\s+runtime\s*=\s*'nodejs'") {
        Write-Host "Skipping $p (already patched)" -ForegroundColor DarkGray
        return
    }

    $header = "export const runtime = 'nodejs';`r`nexport const dynamic = 'force-dynamic';`r`n"

    # if file starts with "use server"; keep it first
    if ($content -match '^\s*["'']use server["'']\s*;') {
        $newContent = $content -replace '(^\s*["'']use server["'']\s*;\s*\r?\n?)', "`$1$header"
    }
    else {
        $newContent = $header + $content
    }

    Set-Content -Path $p -Value $newContent -NoNewline
    Write-Host "Updated $p" -ForegroundColor Green
}

Write-Host "Patch complete." -ForegroundColor Cyan
