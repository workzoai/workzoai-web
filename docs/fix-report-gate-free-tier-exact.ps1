# WorkZo AI - fix workzoReportGate free/premium tier types
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "lib\workzoReportGate.ts",
  "app\lib\workzoReportGate.ts"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host ("Skipped missing file: " + $path) -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw
  $original = $content

  # IMPORTANT:
  # WorkZoFreeReport requires exactly "free", not "free" | "premium".
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')

  # Premium can be exact premium.
  $content = $content.Replace('tier: "premium" as "free" | "premium",', 'tier: "premium" as const,')
  $content = $content.Replace('tier: "premium",', 'tier: "premium" as const,')

  # Avoid duplicate "as const" if run twice.
  $content = $content.Replace('tier: "premium" as const as const,', 'tier: "premium" as const,')

  # If premium was typed as typeof free, remove that narrowing.
  $content = $content.Replace('const premium: typeof free = {', 'const premium = {')
  $content = $content.Replace('let premium: typeof free = {', 'let premium = {')

  # If a function return type was accidentally narrowed to only free, widen common names.
  $content = $content.Replace('): WorkZoFreeReport {', '): WorkZoFreeReport | WorkZoPremiumReport {')
  $content = $content.Replace('): FreeReport {', '): FreeReport | PremiumReport {')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking tier lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern 'tier: "free"|tier: "premium"|typeof free' | Select-Object -First 40
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
