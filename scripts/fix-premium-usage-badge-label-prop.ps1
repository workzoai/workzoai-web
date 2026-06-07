# WorkZo AI - fix PremiumUsageBadge label prop
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$path = "components\premium\PremiumUsageBadge.tsx"

if (!(Test-Path $path)) {
  throw "Missing $path"
}

$content = Get-Content $path -Raw
$original = $content

# Expand props type to support label used by results page.
$content = $content.Replace(
  'export default function PremiumUsageBadge({ compact = false }: { compact?: boolean }) {',
  'export default function PremiumUsageBadge({ compact = false, label }: { compact?: boolean; label?: string }) {'
)

# Avoid double patch.
$content = $content.Replace(
  'export default function PremiumUsageBadge({ compact = false, label }: { compact?: boolean; label?: string; label?: string }) {',
  'export default function PremiumUsageBadge({ compact = false, label }: { compact?: boolean; label?: string }) {'
)

# Rename inner label variable if it conflicts with prop.
$content = $content.Replace(
  'const label = isFounderMode ? "Founder Test Mode" : summary.limits.label;',
  'const displayLabel = label || (isFounderMode ? "Founder Test Mode" : summary.limits.label);'
)

$content = $content.Replace(
  '<span>{label}</span>',
  '<span>{displayLabel}</span>'
)

if ($content -ne $original) {
  Set-Content -Path $path -Value $content -NoNewline
  Write-Host "Patched: $path" -ForegroundColor Green
} else {
  Write-Host "No change made. File may already be patched or has different formatting." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checking PremiumUsageBadge signature:" -ForegroundColor Cyan
Select-String -Path $path -Pattern "function PremiumUsageBadge|displayLabel|label"

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
