# Report gate tier type fix v2

This fixes:

```txt
./lib/workzoReportGate.ts:349:5
Type error: Type '"premium"' is not assignable to type '"free"'.
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-tier-type-v2.ps1
npm run build
```

It patches both possible paths:

```txt
lib/workzoReportGate.ts
app/lib/workzoReportGate.ts
```
