# Interview intelligence severity fix

Fixes:

```txt
Type 'number' is not assignable to type '2 | 1 | 3 | 4 | 5'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-interview-intelligence-severity.ps1
npm run build
```
