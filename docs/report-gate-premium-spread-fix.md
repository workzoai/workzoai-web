# Report gate premium spread fix

Fixes:

```txt
Type error: Type '"premium"' is not assignable to type '"free"'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-premium-spread.ps1
npm run build
```
