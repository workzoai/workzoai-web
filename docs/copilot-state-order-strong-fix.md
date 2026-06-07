# Strong Live Copilot state order fix

Fixes:

```txt
Cannot access 'transcript' before initialization
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-copilot-state-order-strong.ps1
npm run build
```

The output should show `liveCopilotInsight` after the transcript state line.
