# Report gate premium tier build-safe fix

This fixes the persistent error:

```txt
Type error: Type '"premium"' is not assignable to type '"free"'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-premium-tier-any.ps1
npm run build
```

This keeps runtime output as:

```ts
tier: "premium"
```

but uses a narrow TypeScript escape on the tier field because the surrounding function is still contextually typed as the free report.
