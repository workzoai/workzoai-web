# WorkZo AI - fix workzoReportGate tier type
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "lib\workzoReportGate.ts",
  "app\lib\workzoReportGate.ts"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host "Skipped missing file: $path" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw
  $original = $content

  # Prevent TypeScript from locking report objects to only the "free" tier.
  $content = $content.Replace('tier: "premium",', 'tier: "premium" as const,')
  $content = $content.Replace('tier: "free",', 'tier: "free" as const,')

  # If an explicit return type is too narrow, widen it.
  $content = $content.Replace('): FreeReport {', '): FreeReport | PremiumReport {')
  $content = $content.Replace('): WorkZoFreeReport {', '): WorkZoFreeReport | WorkZoPremiumReport {')

  # If premium is explicitly typed as typeof free, remove that trap.
  $content = $content.Replace('const premium: typeof free = {', 'const premium = {')
  $content = $content.Replace('let premium: typeof free = {', 'let premium = {')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No change made: $path" -ForegroundColor Cyan
  }

  Write-Host "Relevant lines in $path:" -ForegroundColor Cyan
  Select-String -Path $path -Pattern 'tier: "premium"|tier: "free"|typeof free' | Select-Object -First 20
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
