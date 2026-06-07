# Report gate tier type fix

Vercel error:

```txt
./lib/workzoReportGate.ts:349:5
Type error: Type '"premium"' is not assignable to type '"free"'.
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-tier-type.ps1
npm run build
```
