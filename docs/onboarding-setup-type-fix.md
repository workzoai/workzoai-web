# Onboarding setup type fix

Fixes:

```txt
app/onboarding/page.tsx:365:42
Argument of type 'SetupState' is not assignable to parameter of type 'WorkZoInterviewSetup'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-onboarding-setup-type.ps1
npm run build
```
