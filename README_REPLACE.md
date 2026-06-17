# WorkZo CV Global Name Override Fix

Replace the files in this ZIP in your project.

Main change in this package:
- Stops valid human names from being overwritten by later CV lines.
- Rejects role/skill/company/project lines such as:
  - Programming Python Bash Power Shell
  - Communications Coordinator Intern
  - Preschool Teacher
  - Valley Heights Community Preschool
  - Gans E-scooter Service
  - Core Competencies
  - Tools Ticketing-systeme
- Keeps the existing correct AI/parser name when it is already a valid human name.
- Only uses override when the current parsed name is invalid or clearly structural/noise.

Replace/add:
- lib/workzoResumeProfileManager.ts
- lib/workzoInterviewSetup.ts
- lib/workzoResumeParser.ts
- app/onboarding/page.tsx
- app/cv/page.tsx
- app/api/copilot/route.ts
- app/api/cv/route.ts
- app/api/cv/structure/route.ts

Then run:

npm install
npm run build

Important: no parser can honestly guarantee 98% accuracy for every visual PDF, scanned PDF, corrupted PDF, or non-standard template. This fix is designed to prevent the specific global failure class shown in your logs: bad name override/ranking.
