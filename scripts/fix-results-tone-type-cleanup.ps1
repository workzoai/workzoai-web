# WorkZo AI - clean invalid "as const" inside ResultsPage type definitions
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$path = "app\results\page.tsx"

if (!(Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw

# Fix invalid type definition created by previous script.
$content = $content.Replace(
  'tone: "positive" as const | "negative"',
  'tone: "positive" | "negative"'
)

$content = $content.Replace(
  'tone: "negative" as const | "positive"',
  'tone: "positive" | "negative"'
)

# Also clean any accidental literal type pollution.
$content = $content.Replace(
  'risk: "low" as const | "medium" | "high"',
  'risk: "low" | "medium" | "high"'
)

$content = $content.Replace(
  'risk: "low" | "medium" as const | "high"',
  'risk: "low" | "medium" | "high"'
)

$content = $content.Replace(
  'risk: "low" | "medium" | "high" as const',
  'risk: "low" | "medium" | "high"'
)

# Make trustDeductions values typed safely if the array declaration exists.
$content = $content.Replace(
  'const trustDeductions = [',
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }> = ['
)

# Avoid duplicated type annotation.
$content = $content.Replace(
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }>: Array<{ label: string; value: number; tone: "positive" | "negative" }> = [',
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }> = ['
)

Set-Content -Path $path -Value $content -NoNewline

Write-Host "Patched: $path" -ForegroundColor Green
Select-String -Path $path -Pattern "trustDeductions|tone:|as const" | Select-Object -First 30 | ForEach-Object {
  Write-Host "$($_.LineNumber): $($_.Line.Trim())"
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
