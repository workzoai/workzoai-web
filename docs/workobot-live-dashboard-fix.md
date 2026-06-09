# Work-O-Bot Live Dashboard Fix

Replace/add:
- app/dashboard/page.tsx
- components/WorkOBotFloating.tsx
- app/api/copilot/route.ts
- lib/openrouter.ts
- lib/workobotEngine.ts

Required env:
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
NEXT_PUBLIC_SITE_URL=https://workzoai.com

Run:
npm run build
npm run dev
