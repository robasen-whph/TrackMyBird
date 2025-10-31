# Run from repo root. This ONLY walks app/api/**/route.ts for speed.
$ErrorActionPreference = 'Stop'

$apiDir = Join-Path (Get-Location) 'app\api'
if (-not (Test-Path $apiDir)) {
  Write-Host "No app\api directory found. Exiting." -f Yellow
  exit 0
}

$header = "export const runtime = 'nodejs';`r`nexport const dynamic = 'force-dynamic';`r`n"

# Very fast enumerator, no pipeline until we have the array
$files = [System.IO.Directory]::EnumerateFiles($apiDir, 'route.ts', 'AllDirectories') `
  | Where-Object { $_ -notmatch '\\(\.git|\.next|node_modules|dist|build|out)\\' } `
  | ForEach-Object { $_ }  # materialize

if (-not $files.Count) {
  Write-Host "No route.ts files under app\
