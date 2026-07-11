# WorkZo tools auth + CV memory upgrade

Replace the included files at the same paths in your project.

## Included
- `components/marketing/FreeToolRunner.tsx`
- `app/tools/[slug]/page.tsx`
- `app/tools/page.tsx`
- `app/jobs/page.tsx`
- `lib/free-tools.ts`

## What changed
- Requires sign-in before any career tool runs.
- Reuses the canonical uploaded CV across CV review, resume tailoring, cover letter, ATS, headline, and related tools.
- Adds a compact CV uploader/replacer directly inside the tool runner.
- Adds CV memory and replacement controls to Job Search Hub.
- Removes visible "free / no signup" messaging from the tools UI.
- Keeps tool results connected to the signed-in WorkZo workspace.

## Build
```powershell
Remove-Item -Recurse -Force .next
npm run build
```
