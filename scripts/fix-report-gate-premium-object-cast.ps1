# WorkZo AI - fix workzoReportGate premium object typing
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

  # Ensure exact free tier.
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')

  # Current problem:
  # return { ...freeReportBase, tier: "premium", transcriptTimeline, ... }
  # is still contextually typed as WorkZoFreeReport.
  #
  # Fix:
  # return ({ ... } as WorkZoPremiumReport);
  $content = $content.Replace(
    "return {`r`n    ...freeReportBase,`r`n    tier: `"premium`" as any,",
    "return ({`r`n    ...freeReportBase,`r`n    tier: `"premium`","
  )

  $content = $content.Replace(
    "return {`n    ...freeReportBase,`n    tier: `"premium`" as any,",
    "return ({`n    ...freeReportBase,`n    tier: `"premium`","
  )

  $content = $content.Replace(
    "return {`r`n    ...freeReportBase,`r`n    tier: `"premium`",",
    "return ({`r`n    ...freeReportBase,`r`n    tier: `"premium`","
  )

  $content = $content.Replace(
    "return {`n    ...freeReportBase,`n    tier: `"premium`",",
    "return ({`n    ...freeReportBase,`n    tier: `"premium`","
  )

  # Add closing cast to the premium return object.
  # The premium return object ends with common premium field names before function closes.
  $content = $content.Replace(
    "`r`n  };`r`n}`r`n`r`nexport",
    "`r`n  } as WorkZoPremiumReport);`r`n}`r`n`r`nexport"
  )

  $content = $content.Replace(
    "`n  };`n}`n`nexport",
    "`n  } as WorkZoPremiumReport);`n}`n`nexport"
  )

  # Avoid double cast if script is run twice.
  $content = $content.Replace("} as WorkZoPremiumReport) as WorkZoPremiumReport);", "} as WorkZoPremiumReport);")

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking relevant lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern "freeReportBase|WorkZoPremiumReport|transcriptTimeline|tier:" | Select-Object -First 80
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
