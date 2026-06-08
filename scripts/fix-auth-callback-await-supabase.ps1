# WorkZo AI - fix Supabase auth callback await issue
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$path = "app\auth\callback\route.ts"

if (!(Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw
$original = $content

$content = $content.Replace(
  "const supabase = createSupabaseServerClient();",
  "const supabase = await createSupabaseServerClient();"
)

# Safety cleanup if script is run more than once.
$content = $content.Replace(
  "const supabase = await await createSupabaseServerClient();",
  "const supabase = await createSupabaseServerClient();"
)

if ($content -eq $original) {
  Write-Host "No change made. The callback route may already be fixed or has different formatting." -ForegroundColor Yellow
} else {
  Set-Content -Path $path -Value $content -NoNewline
  Write-Host "Patched: $path" -ForegroundColor Green
}

Write-Host ""
Write-Host "Check line:" -ForegroundColor Cyan
Select-String -Path $path -Pattern "createSupabaseServerClient" | ForEach-Object {
  Write-Host "$($_.LineNumber): $($_.Line.Trim())"
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
