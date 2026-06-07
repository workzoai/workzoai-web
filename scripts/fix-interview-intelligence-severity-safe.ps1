# WorkZo AI - safe severity return fix
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

  # Replace only object shorthand returns:
  #   severity,
  # with a typed field:
  #   severity: severity as 1 | 2 | 3 | 4 | 5,
  $content = $content -replace '\bseverity,\s*reason:', 'severity: severity as 1 | 2 | 3 | 4 | 5, reason:'

  # Avoid double-casting if script runs twice.
  $content = $content -replace 'severity: severity as 1 \| 2 \| 3 \| 4 \| 5 as 1 \| 2 \| 3 \| 4 \| 5,', 'severity: severity as 1 | 2 | 3 | 4 | 5,'

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No matching severity shorthand found in: $path" -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "severity:" | Select-Object -First 20 | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
