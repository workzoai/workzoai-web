# WorkZo AI - targeted premium return fix for workzoReportGate
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "lib\workzoReportGate.ts",
  "app\lib\workzoReportGate.ts"
)

function Patch-PremiumReturn($path) {
  if (!(Test-Path $path)) {
    Write-Host ("Skipped missing file: " + $path) -ForegroundColor Yellow
    return
  }

  $content = Get-Content $path -Raw
  $original = $content

  # Clean older bad edits first.
  $content = $content.Replace("} as WorkZoPremiumReport);", "};")
  $content = $content.Replace('tier: "free" as "free" | "premium",', 'tier: "free",')
  $content = $content.Replace('tier: "free" as const,', 'tier: "free",')
  $content = $content.Replace('tier: "premium" as any,', 'tier: "premium",')
  $content = $content.Replace('tier: "premium" as const,', 'tier: "premium",')

  # Find ONLY the premium return object that spreads freeReportBase.
  $marker = "return ({"
  $spread = "...freeReportBase,"
  $markerIndex = $content.IndexOf($marker)
  $targetIndex = -1

  while ($markerIndex -ge 0) {
    $windowEnd = [Math]::Min($content.Length, $markerIndex + 300)
    $window = $content.Substring($markerIndex, $windowEnd - $markerIndex)

    if ($window.Contains($spread)) {
      $targetIndex = $markerIndex
      break
    }

    $markerIndex = $content.IndexOf($marker, $markerIndex + 1)
  }

  if ($targetIndex -lt 0) {
    # Try without parenthesis.
    $marker = "return {"
    $markerIndex = $content.IndexOf($marker)

    while ($markerIndex -ge 0) {
      $windowEnd = [Math]::Min($content.Length, $markerIndex + 300)
      $window = $content.Substring($markerIndex, $windowEnd - $markerIndex)

      if ($window.Contains($spread)) {
        $targetIndex = $markerIndex
        break
      }

      $markerIndex = $content.IndexOf($marker, $markerIndex + 1)
    }
  }

  if ($targetIndex -lt 0) {
    Write-Host ("Could not find premium return block in " + $path) -ForegroundColor Yellow
    return
  }

  # Ensure it starts as return ({ for a castable expression.
  if ($content.Substring($targetIndex, 8) -eq "return {") {
    $content = $content.Remove($targetIndex, 8).Insert($targetIndex, "return ({")
  }

  # Find the first closing "  };" after the premium block start.
  $closingIndex = $content.IndexOf("`n  };", $targetIndex)
  $closingLength = 5

  if ($closingIndex -lt 0) {
    $closingIndex = $content.IndexOf("`r`n  };", $targetIndex)
    $closingLength = 6
  }

  if ($closingIndex -lt 0) {
    Write-Host ("Could not find premium return closing brace in " + $path) -ForegroundColor Yellow
    return
  }

  $closingText = $content.Substring($closingIndex, $closingLength)

  if ($closingText -like "*`r`n*") {
    $replacement = "`r`n  } as any);"
  } else {
    $replacement = "`n  } as any);"
  }

  $content = $content.Remove($closingIndex, $closingLength).Insert($closingIndex, $replacement)

  # If there was already return (( from previous run, clean it.
  $content = $content.Replace("return (({", "return ({")
  $content = $content.Replace("} as any) as any);", "} as any);")

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Write-Host ("Checking relevant lines in " + $path) -ForegroundColor Cyan
  Select-String -Path $path -Pattern "freeReportBase|tier: `"premium`"|as any|transcriptTimeline" | Select-Object -First 80
}

foreach ($path in $paths) {
  Patch-PremiumReturn $path
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
