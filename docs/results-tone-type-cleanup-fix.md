# Results tone type cleanup fix

Fixes invalid syntax:

```ts
tone: "positive" as const | "negative"
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-results-tone-type-cleanup.ps1
npm run build
```
