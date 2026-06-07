# Report gate cleanup safe fix

Fixes the bad broad cast that caused:

```txt
} as WorkZoPremiumReport);
';' expected
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-cleanup-safe.ps1
npm run build
```
