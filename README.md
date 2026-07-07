# WorkZo Experience Visibility Final Fix

Replace these files:

- app/cv/page.tsx
- app/api/copilot/route.ts
- app/api/cv/route.ts
- lib/workzoWorkspaceGenerators.ts

What changed:

1. The Improve CV page now keeps `sourceCvText`, the original uploaded CV text, separate from the clean rendered profile text.
2. The rewrite request sends the original uploaded CV text to `/api/copilot`, not the rendered profile text.
3. The server can compare the raw CV evidence against the stored profile and recover experience bullets when the browser profile is stale or incomplete.
4. The template/preview path still uses the rewritten structured profile after rewrite, but the rewrite source is always the original CV evidence.

Important after replacing:

- Run `npm run build`.
- Re-upload the original CV once. Existing browser/local storage may already contain a broken profile where experience bullets were dropped.
