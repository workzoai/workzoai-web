$path = "lib/workzoCvGlobalFinalizer.ts"

if (!(Test-Path $path)) {
  Write-Error "File not found: $path. Run this script from the project root: C:\Projects\workzo-web"
  exit 1
}

$content = Get-Content $path -Raw

$content = $content -replace 'selectedName:\s*finalProfile\.name\s*,', 'selectedName: finalProfile.basics?.name ?? finalProfile.identity?.name ?? "",'

Set-Content -Path $path -Value $content -NoNewline
Write-Host "Patched $path successfully."
