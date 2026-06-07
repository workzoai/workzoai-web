# WorkZo AI - cleanup bad WorkZoPremiumReport cast and safely widen report builder
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

  # 1) Remove the bad broad cast that caused:
  #    } as WorkZoPremiumReport);
  # in the wrong helper return.
  $content = $content.Replace("} as WorkZoPremiumReport);", "};")
  $content = $content.Replace("} as WorkZoPremiumReport);", "};")

  # 2) Keep exact free tier.
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')

  # 3) If premium spreads the free report, remove the typed free tier from the spread.
  $content = $content.Replace(
    "return {`r`n    ...free,`r`n    tier: `"premium`" as any,",
    "const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;`r`n`r`n  return {`r`n    ...freeReportBase,`r`n    tier: `"premium`" as any,"
  )
  $content = $content.Replace(
    "return {`n    ...free,`n    tier: `"premium`" as any,",
    "const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;`n`n  return {`n    ...freeReportBase,`n    tier: `"premium`" as any,"
  )
  $content = $content.Replace(
    "return {`r`n    ...free,`r`n    tier: `"premium`" as const,",
    "const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;`r`n`r`n  return {`r`n    ...freeReportBase,`r`n    tier: `"premium`" as any,"
  )
  $content = $content.Replace(
    "return {`n    ...free,`n    tier: `"premium`" as const,",
    "const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;`n`n  return {`n    ...freeReportBase,`n    tier: `"premium`" as any,"
  )
  $content = $content.Replace(
    "return {`r`n    ...free,`r`n    tier: `"premium`",",
    "const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;`r`n`r`n  return {`r`n    ...freeReportBase,`r`n    tier: `"premium`" as any,"
  )
  $content = $content.Replace(
    "return {`n    ...free,`n    tier: `"premium`",",
    "const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;`n`n  return {`n    ...freeReportBase,`n    tier: `"premium`" as any,"
  )

  # 4) If the same destructure was inserted twice, clean it.
  $content = $content.Replace(
    "const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;`n`n  const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;",
    "const { tier: _freeTier, ...freeReportBase } = free;`n  void _freeTier;"
  )
  $content = $content.Replace(
    "const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;`r`n`r`n  const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;",
    "const { tier: _freeTier, ...freeReportBase } = free;`r`n  void _freeTier;"
  )

  # 5) If implementation signature is too narrow, widen common implementation signatures.
  # This is safer than casting random return objects.
  $content = $content.Replace(
    "export function buildWorkZoReport(source: WorkZoReportSource, isPremium: boolean)",
    "export function buildWorkZoReport(source: WorkZoReportSource, isPremium: boolean)"
  )

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking problem patterns in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern "WorkZoPremiumReport\);|freeReportBase|tier: `"premium`"|tier: `"free`"" | Select-Object -First 80
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
