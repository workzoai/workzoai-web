# WorkZo AI - fix results trustDeductions tone literal type
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$path = "app\results\page.tsx"

if (!(Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw
$original = $content

# Best fix: type the array explicitly if it exists as `const trustDeductions = [`
$content = $content.Replace(
  "const trustDeductions = [",
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }> = ['
)

# Avoid duplicating type if script runs twice.
$content = $content.Replace(
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }>: Array<{ label: string; value: number; tone: "positive" | "negative" }> = [',
  'const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }> = ['
)

# If values use plain strings, narrow them explicitly. Safe even if already typed.
$content = $content.Replace('tone: "positive"', 'tone: "positive" as const')
$content = $content.Replace('tone: "negative"', 'tone: "negative" as const')

# Avoid duplicate `as const as const`.
$content = $content.Replace('as const as const', 'as const')

Set-Content -Path $path -Value $content -NoNewline

Write-Host "Patched: $path" -ForegroundColor Green
Select-String -Path $path -Pattern "trustDeductions|tone:" | Select-Object -First 20 | ForEach-Object {
  Write-Host "$($_.LineNumber): $($_.Line.Trim())"
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
