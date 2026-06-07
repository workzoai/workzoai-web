# PremiumUsageBadge label prop fix

The build fails because `app/results/page.tsx` uses:

```tsx
<PremiumUsageBadge label={...} />
```

but the component only accepts:

```ts
compact?: boolean
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-premium-usage-badge-label-prop.ps1
npm run build
```
