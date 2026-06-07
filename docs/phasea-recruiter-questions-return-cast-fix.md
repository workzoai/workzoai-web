# PhaseA recruiterQuestions return cast fix

Fixes:

```txt
Type '{ question: string; why: string; risk: string; }[]' is not assignable to type 'PhaseAQuestion[]'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-phasea-recruiter-questions-return-cast.ps1
npm run build
```
