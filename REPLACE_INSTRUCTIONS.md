# WorkZo Data Integrity Fix v6

Replace these files in your project:

1. `app/api/cv/route.ts`
2. `lib/workzoAiCvParser.ts`
3. `lib/workzoResumeProfileManager.ts`
4. `app/results/page.tsx`

Then run:

```bash
npm install
npm run build
```

## What this fixes

- Makes AI parser primary and Affinda fallback/comparison only.
- Selects the parser result using a structural quality score.
- Blocks corrupted candidate names like `Associate's Degree In Computer Science`.
- Strengthens cached-profile rejection with `nameCorrupted` checks.
- Improves project extraction from raw CV text when the AI misses project sections.
- Keeps previously good profile reuse, but rejects stale/corrupted cached profiles before saving.
- Increases results DB read timeout from 6 seconds to 12 seconds to reduce false local fallback warnings.

## Important

This package does not touch Vapi/audio files. It is focused on CV parser integrity and results timeout only.
