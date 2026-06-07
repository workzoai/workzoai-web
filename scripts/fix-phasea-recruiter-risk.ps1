# WorkZo AI - fix PhaseA recruiterQuestions risk literal type
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

  # Best fix: explicitly type recruiterQuestions if declared as const recruiterQuestions = [
  $content = $content.Replace(
    "const recruiterQuestions = [",
    "const recruiterQuestions: PhaseAQuestion[] = ["
  )

  # Avoid duplicate annotation if rerun.
  $content = $content.Replace(
    "const recruiterQuestions: PhaseAQuestion[]: PhaseAQuestion[] = [",
    "const recruiterQuestions: PhaseAQuestion[] = ["
  )

  # If objects still infer risk as string through mapping, cast known risk values.
  $content = $content.Replace('risk: "low"', 'risk: "low" as const')
  $content = $content.Replace('risk: "medium"', 'risk: "medium" as const')
  $content = $content.Replace('risk: "high"', 'risk: "high" as const')

  # Clean duplicate casts and type-pollution in type definitions.
  $content = $content.Replace('as const as const', 'as const')
  $content = $content.Replace('risk: "low" as const | "medium" | "high"', 'risk: "low" | "medium" | "high"')
  $content = $content.Replace('risk: "low" | "medium" as const | "high"', 'risk: "low" | "medium" | "high"')
  $content = $content.Replace('risk: "low" | "medium" | "high" as const', 'risk: "low" | "medium" | "high"')

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host "Patched: $path" -ForegroundColor Green
  } else {
    Write-Host "No changes needed: $path" -ForegroundColor Cyan
  }

  Select-String -Path $path -Pattern "type PhaseAQuestion|recruiterQuestions|risk:" | Select-Object -First 30 | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
