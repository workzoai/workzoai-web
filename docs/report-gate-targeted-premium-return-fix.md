# Targeted premium return fix

Fixes the persistent error:

```txt
Type '"premium"' is not assignable to type '"free"'
```

This script only targets the premium return block that contains:

```ts
...freeReportBase
```

and converts its closing return to:

```ts
} as any);
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-targeted-premium-return.ps1
npm run build
```
