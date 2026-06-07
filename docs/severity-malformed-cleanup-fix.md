# Severity malformed cleanup fix

Fixes the bad generated code:

```ts
severity: top.severity: severity as 1 | 2 | 3 | 4 | 5
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-severity-malformed-cleanup.ps1
npm run build
```
