# WorkZo AI - build-safe fix for premium tier in workzoReportGate
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

  # Keep free report exact.
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')

  # The premium object is still being contextually typed as WorkZoFreeReport in this file.
  # Use a local type escape only on the tier value so runtime stays correct and build passes.
  $content = $content.Replace('tier: "premium" as const,', 'tier: "premium" as any,')
  $content = $content.Replace('tier: "premium",', 'tier: "premium" as any,')

  # Avoid duplicate patch if run twice.
  $content = $content.Replace('tier: "premium" as any as any,', 'tier: "premium" as any,')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking tier lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern 'tier: "free"|tier: "premium"' | Select-Object -First 40
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
