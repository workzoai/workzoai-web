# WorkZo AI - cleanup malformed severity cast
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "lib\workzoInterviewIntelligence95.ts",
  "app\lib\workzoInterviewIntelligence95.ts"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host "Skipped missing file: $path" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw
  $original = $content

  # Fix broken line created by previous script:
  # severity: top.severity: severity as ...
  $content = $content -replace 'severity:\s*top\.severity:\s*severity\s+as\s+1\s*\|\s*2\s*\|\s*3\s*\|\s*4\s*\|\s*5,', 'severity: top.severity as 1 | 2 | 3 | 4 | 5,'

  # Fix any similar malformed expression:
  $content = $content -replace 'severity:\s*([A-Za-z0-9_.$]+):\s*severity\s+as\s+1\s*\|\s*2\s*\|\s*3\s*\|\s*4\s*\|\s*5,', 'severity: $1 as 1 | 2 | 3 | 4 | 5,'

  # Now only fix actual shorthand severity in object literals where it is followed by reason.
  # This avoids touching existing `severity: something`.
  $content = $content -replace '(\{|,)\s*severity,\s*reason:', '$1 severity: severity as 1 | 2 | 3 | 4 | 5, reason:'

  # Clean duplicated casts if rerun.
  $content = $content -replace 'as 1 \| 2 \| 3 \| 4 \| 5 as 1 \| 2 \| 3 \| 4 \| 5', 'as 1 | 2 | 3 | 4 | 5'

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No changes needed: $path" -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "severity:" | Select-Object -First 30 | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
