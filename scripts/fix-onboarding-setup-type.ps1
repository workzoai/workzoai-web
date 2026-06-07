# WorkZo AI - fix onboarding SetupState -> WorkZoInterviewSetup type mismatch
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "app\onboarding\page.tsx",
  "app\app\onboarding\page.tsx"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host ("Skipped missing file: " + $path) -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw
  $original = $content

  # Fix exact failing call:
  # saveLatestInterviewSetup(setup)
  # SetupState has recruiterMemoryProfile: unknown, while WorkZoInterviewSetup expects a narrower type.
  # We keep runtime unchanged and make the boundary explicit.
  $content = $content.Replace(
    "const saved = saveLatestInterviewSetup(setup);",
    "const saved = saveLatestInterviewSetup(setup as Parameters<typeof saveLatestInterviewSetup>[0]);"
  )

  # Avoid double patch.
  $content = $content.Replace(
    "saveLatestInterviewSetup(setup as Parameters<typeof saveLatestInterviewSetup>[0] as Parameters<typeof saveLatestInterviewSetup>[0])",
    "saveLatestInterviewSetup(setup as Parameters<typeof saveLatestInterviewSetup>[0])"
  )

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host ("Patched: " + $path) -ForegroundColor Green
  } else {
    Write-Host ("No change made: " + $path) -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "saveLatestInterviewSetup"
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
