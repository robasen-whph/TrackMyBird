param([switch]$WhatIf)

$ErrorActionPreference = 'Stop'
$root   = (Get-Location).Path
$appDir = Join-Path $root 'app'
if (-not (Test-Path $appDir)) { Write-Host "No ./app directory. Exiting." -f Yellow; exit 0 }

# Lines we want (idempotent)
$header = "export const runtime = 'nodejs';`r`nexport const dynamic = 'force-dynamic';`r`n"

# Helper: normalize content (remove dup/old lines)
function Normalize-Content([string]$t) {
  # remove existing runtime/dynamic (nodejs/edge/others) so we can add once
  $t = $t -replace "^\s*export\s+const\s+runtime\s*=\s*['""][^'""]+['""]\s*;\s*\r?\n", '', 'im'
  $t = $t -replace "^\s*export\s+const\s+dynamic\s*=\s*['""][^'""]+['""]\s*;\s*\r?\n", '', 'im'
  return $t
}

# Enumerate target files quickly and safely
$targets = [System.IO.Directory]::EnumerateFiles($appDir, 'route.ts', 'AllDirectories') `
| Where-Object {
    $_ -like '*\app\api\*' -and
    $_ -notmatch '\\(\.git|\.next|node_modules|dist|build|out)\\'
  }

$patched = 0; $skipped = 0

foreach ($file in $targets) {
  $content = Get-Content -LiteralPath $file -Raw

  $alreadyHas = ($content -match "export\s+const\s+runtime\s*=\s*'nodejs'") `
              -and ($content -match "export\s+const\s+dynamic\s*=\s*'force-dynamic'")
  if ($alreadyHas) { $skipped++; continue }

  $new = Normalize-Content $content

  if ($new -match '^\s*["'']use server["'']\s*;') {
    # insert after "use server";
    $new = $new -replace '(^\s*["'']use server["'']\s*;\s*\r?\n?)', "`$1$header"
  } else {
    $new = $header + $new
  }

  if ($WhatIf) {
    Write-Host "[DRY-RUN] would patch: $file"
  } else {
    Set-Content -LiteralPath $file -Value $new -NoNewline
    $patched++
  }
}

if ($WhatIf) {
  Write-Host "Dry run complete. No files written." -f Yellow
} else {
  Write-Host "Patched: $patched | Already OK: $skipped" -f Green
}
