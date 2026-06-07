# Results trustDeductions tone fix

Fixes:

```txt
Type '{ label: string; value: number; tone: string; }[]' is not assignable to type ...
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-results-trust-deductions-tone.ps1
npm run build
```
