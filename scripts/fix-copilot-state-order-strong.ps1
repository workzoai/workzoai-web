# WorkZo AI - strong Live Copilot state order fix
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "app\interview\page.tsx",
  "app\app\interview\page.tsx"
)

$insertBlock = @'
  const liveCopilotInsight = useMemo(
    () =>
      getWorkZoLiveCopilotInsight({
        status,
        transcriptCount: transcript.length,
        questionIndex,
        currentQuestion: recruiterQuestions[Math.min(questionIndex, recruiterQuestions.length - 1)] || "",
        interimText,
        recruiterConcern: recruiterSignal.concern,
        recruiterMood: recruiterSignal.mood,
        trust: recruiterSignal.trust,
        interest: recruiterSignal.interest,
      }),
    [status, transcript.length, questionIndex, interimText, recruiterSignal],
  );

'@

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host "Skipped missing file: $path" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw

  # Remove ANY existing liveCopilotInsight useMemo block, even if formatting changed.
  $content = [regex]::Replace(
    $content,
    '(?s)\s*const\s+liveCopilotInsight\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*getWorkZoLiveCopilotInsight\s*\(\{.*?\}\),\s*\[[^\]]*\],\s*\);\s*',
    "`r`n",
    1
  )

  # If there are still duplicate declarations, remove simpler fallback blocks.
  while (($content | Select-String -Pattern "const liveCopilotInsight = useMemo" -AllMatches).Matches.Count -gt 0) {
    $content = [regex]::Replace(
      $content,
      '(?s)\s*const\s+liveCopilotInsight\s*=\s*useMemo\s*\(.*?\n\s*\);\s*',
      "`r`n",
      1
    )
  }

  # Insert after transcript state declaration.
  $anchor = '  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);'
  if (!$content.Contains($anchor)) {
    throw "Could not find transcript state anchor in $path"
  }

  $content = $content.Replace($anchor, $anchor + "`r`n" + $insertBlock)

  Set-Content -Path $path -Value $content -NoNewline

  Write-Host "Patched: $path" -ForegroundColor Green
  Write-Host "Order check:" -ForegroundColor Cyan
  Select-String -Path $path -Pattern "const \[questionIndex|const \[elapsed|const \[interimText|const \[transcript|const liveCopilotInsight" | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
