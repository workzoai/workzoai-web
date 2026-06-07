# WorkZo AI - fix premium report spread carrying free tier
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

  # Restore exact free tier.
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')

  # Remove the free tier before spreading into premium.
  $content = $content.Replace(
    'return {' + "`r`n" + '    ...free,' + "`r`n" + '    tier: "premium" as const,',
    'const { tier: _freeTier, ...freeReportBase } = free;' + "`r`n" + '  void _freeTier;' + "`r`n`r`n" + '  return {' + "`r`n" + '    ...freeReportBase,' + "`r`n" + '    tier: "premium",'
  )

  $content = $content.Replace(
    'return {' + "`n" + '    ...free,' + "`n" + '    tier: "premium" as const,',
    'const { tier: _freeTier, ...freeReportBase } = free;' + "`n" + '  void _freeTier;' + "`n`n" + '  return {' + "`n" + '    ...freeReportBase,' + "`n" + '    tier: "premium",'
  )

  $content = $content.Replace(
    'return {' + "`r`n" + '    ...free,' + "`r`n" + '    tier: "premium",',
    'const { tier: _freeTier, ...freeReportBase } = free;' + "`r`n" + '  void _freeTier;' + "`r`n`r`n" + '  return {' + "`r`n" + '    ...freeReportBase,' + "`r`n" + '    tier: "premium",'
  )

  $content = $content.Replace(
    'return {' + "`n" + '    ...free,' + "`n" + '    tier: "premium",',
    'const { tier: _freeTier, ...freeReportBase } = free;' + "`n" + '  void _freeTier;' + "`n`n" + '  return {' + "`n" + '    ...freeReportBase,' + "`n" + '    tier: "premium",'
  )

  # Avoid duplicate insertion if the script is run twice.
  $content = $content.Replace(
    'const { tier: _freeTier, ...freeReportBase } = free;' + "`n" + '  void _freeTier;' + "`n`n" + '  const { tier: _freeTier, ...freeReportBase } = free;',
    'const { tier: _freeTier, ...freeReportBase } = free;'
  )

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking relevant lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern 'freeReportBase|tier: "premium"|tier: "free"|\.\.\.free' | Select-Object -First 60
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
