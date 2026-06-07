# Live Copilot + Transcript visibility fix

Replace:
- app/interview/page.tsx
- app/app/interview/page.tsx if your repo uses nested path

Fixes:
- Live Copilot now reacts to current answer quality:
  too short, missing ownership, missing metric, missing outcome, vague wording, strong answer forming.
- Transcript panel gets higher z-index and clearer body styling so it is not hidden behind the recruiter card.
