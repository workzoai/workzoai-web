# WorkZo AI - Fix workzoReportGate tier type properly
# Run from project root:
#   C:\Projects\workzo-web

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

  # Fix the usual root cause:
  # premium object was typed as typeof free, so tier is locked to "free".
  $content = $content.Replace('const premium: typeof free = {', 'const premium = {')
  $content = $content.Replace('let premium: typeof free = {', 'let premium = {')

  # Widen literal tier values where needed.
  $content = $content.Replace('tier: "free",', 'tier: "free" as "free" | "premium",')
  $content = $content.Replace('tier: "premium",', 'tier: "premium" as "free" | "premium",')

  # Avoid duplicate widening if the script is run twice.
  $content = $content.Replace('tier: "free" as "free" | "premium" as "free" | "premium",', 'tier: "free" as "free" | "premium",')
  $content = $content.Replace('tier: "premium" as "free" | "premium" as "free" | "premium",', 'tier: "premium" as "free" | "premium",')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking tier lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern 'tier: "premium"|tier: "free"|typeof free' | Select-Object -First 30
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
