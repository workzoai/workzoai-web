# Safe interview intelligence severity fix

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-interview-intelligence-severity-safe.ps1
npm run build
```

Fixes:

```txt
Type 'number' is not assignable to type '2 | 1 | 3 | 4 | 5'
```
