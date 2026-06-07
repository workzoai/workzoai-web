# WorkZo AI - fix severity literal union type
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

  # Add a reusable literal type if missing.
  if ($content -notmatch "type WorkZoChallengeSeverity") {
    $content = $content.Replace(
      "export type",
      "type WorkZoChallengeSeverity = 1 | 2 | 3 | 4 | 5;`n`nexport type",
      1
    )
  }

  # Common fixes for severity variable declarations.
  $content = $content.Replace(
    "let severity =",
    "let severity: WorkZoChallengeSeverity ="
  )

  $content = $content.Replace(
    "const severity =",
    "const severity: WorkZoChallengeSeverity ="
  )

  # Avoid duplicate annotations if script runs twice.
  $content = $content.Replace(
    "let severity: WorkZoChallengeSeverity: WorkZoChallengeSeverity =",
    "let severity: WorkZoChallengeSeverity ="
  )
  $content = $content.Replace(
    "const severity: WorkZoChallengeSeverity: WorkZoChallengeSeverity =",
    "const severity: WorkZoChallengeSeverity ="
  )

  # If severity is computed by clamp/Math, cast at return sites.
  $content = $content.Replace(
    "return { shouldChallenge: true, severity,",
    "return { shouldChallenge: true, severity: severity as ChallengeDecision[`"severity`"],"
  )

  $content = $content.Replace(
    "return { shouldChallenge: false, severity,",
    "return { shouldChallenge: false, severity: severity as ChallengeDecision[`"severity`"],"
  )

  # Cleanup if duplicated.
  $content = $content.Replace(
    "severity: severity as ChallengeDecision[`"severity`"] as ChallengeDecision[`"severity`"],",
    "severity: severity as ChallengeDecision[`"severity`"],"
  )

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No change needed: $path" -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "WorkZoChallengeSeverity|severity" | Select-Object -First 20 | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
