# Live Copilot state order fix

Fixes:

```txt
Cannot access 'transcript' before initialization
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-copilot-state-order.ps1
npm run build
```
