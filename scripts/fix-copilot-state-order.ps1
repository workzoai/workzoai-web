# WorkZo AI - fix Live Copilot state order
# Run from project root: C:\Projects\workzo-web

$ErrorActionPreference = "Stop"

$paths = @(
  "app\interview\page.tsx",
  "app\app\interview\page.tsx"
)

foreach ($path in $paths) {
  if (!(Test-Path $path)) {
    Write-Host "Skipped missing file: $path" -ForegroundColor Yellow
    continue
  }

  $content = Get-Content $path -Raw

  # Remove any existing Live Copilot useMemo block.
  $pattern = '(?s)\n\s*const liveCopilotInsight = useMemo\(.*?\n\s*\);\s*\n'
  $content = [regex]::Replace($content, $pattern, "`n", 1)

  # Insert after transcript state, which appears after questionIndex + interimText.
  $anchor = '  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);'

  if ($content.Contains($anchor) -and !$content.Contains('const liveCopilotInsight = useMemo(')) {
    $insert = @'
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);

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

    $content = $content.Replace($anchor, $insert)
  }

  Set-Content -Path $path -Value $content -NoNewline

  Write-Host "Patched: $path" -ForegroundColor Green
  Select-String -Path $path -Pattern "const \[questionIndex|const \[interimText|const \[transcript|const liveCopilotInsight" | ForEach-Object {
    Write-Host "$($_.LineNumber): $($_.Line.Trim())"
  }
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build"
