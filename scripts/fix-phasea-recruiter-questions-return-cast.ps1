# WorkZo AI - fix PhaseA recruiterQuestions return type
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "lib\workzoCareerSuitePhaseA.ts",
  "app\lib\workzoCareerSuitePhaseA.ts"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host "Skipped missing file: $path" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw
  $original = $content

  # Fix the failing return property:
  # recruiterQuestions,
  # -> recruiterQuestions: recruiterQuestions as PhaseAQuestion[],
  $content = $content -replace '(\n\s*)recruiterQuestions,', '$1recruiterQuestions: recruiterQuestions as PhaseAQuestion[],'

  # Avoid duplicate casts if rerun.
  $content = $content -replace 'recruiterQuestions:\s*recruiterQuestions\s+as\s+PhaseAQuestion\[\]\s+as\s+PhaseAQuestion\[\],', 'recruiterQuestions: recruiterQuestions as PhaseAQuestion[],'

  # Also clean invalid "as const" inside type definitions if previous scripts touched this file.
  $content = $content.Replace('risk: "low" as const | "medium" | "high"', 'risk: "low" | "medium" | "high"')
  $content = $content.Replace('risk: "low" | "medium" as const | "high"', 'risk: "low" | "medium" | "high"')
  $content = $content.Replace('risk: "low" | "medium" | "high" as const', 'risk: "low" | "medium" | "high"')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No matching return shorthand found: $path" -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "recruiterQuestions|PhaseAQuestion|risk:" | Select-Object -First 40 | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
