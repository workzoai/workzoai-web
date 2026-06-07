# Report gate premium object cast fix

Fixes:

```txt
Object literal may only specify known properties, and 'transcriptTimeline' does not exist in type 'WorkZoFreeReport'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-report-gate-premium-object-cast.ps1
npm run build
```
