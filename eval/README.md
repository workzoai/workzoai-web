# WorkZo CV pipeline eval harness

Turns "I believe it's global" into a **measured pass rate**. Every fixture runs
through the REAL pipeline — `extractResumeProfile` → `determineCanonicalIdentity`
→ `buildCanonicalProfile` → `repairParsedResume` → `buildResumeJson` — and is
checked against generic invariants that must hold for ANY CV.

## Run

```bash
npx tsx eval/run_eval.ts
```

Exits non-zero if any check fails, so it drops straight into CI.

## Add your own CVs (this is the point)

Put files in `eval/cvs/`:

- `something.txt` — raw CV text → exercises the **text-parser fallback** path.
- `something.json` — a structured `ResumeProfile` → exercises the **primary
  path** (what production renders from the AI-structured profile).

Optionally tighten the checks with `something.expect.json` next to it:

```json
{ "name": "Jane Doe", "role": "IT Specialist",
  "minExperience": 2, "everyJobHasBullets": true,
  "minEducation": 1, "skills": ["TensorFlow", "LangChain"] }
```

Drop 20–50 real, varied CVs in here and the pass rate becomes real coverage.

## What it checks (generic invariants, not sample values)

- `identity_name` / `identity_not_rejected` — the correct name is selected and
  not flagged for confirmation; a name is never replaced by a skill/section/address.
- `canonical_usable` — a CV with real evidence is never discarded.
- `name_clean` — the name is not the address, a section word, or empty.
- `experience_count` / `experience_bullets` — jobs aren't dropped and no job
  silently loses its bullets.
- `experience_company_clean` — the company field isn't empty or a title fragment.
- `education_no_dup` — no duplicate degree at the same institution.
- `education_dates_clean` — dates are a year or a year range, never a split fragment.
- `skills_not_dropped` / `skills_no_mangle` — skills survive and CamelCase tech
  names (TensorFlow, LangChain, …) are never split.

## Reading the two modes

- **profile-mode** = the primary production path (AI-structured profile → guard →
  render). This is what users see on the improve-CV page and in a rewrite.
- **text-mode** = the raw-text parser fallback (used when there is no structured
  profile, and on re-parse-of-edited-text).

A failure in text-mode does not necessarily affect the primary path.

## Baseline at time of writing

```
profile-mode (primary path): 100%
text-mode   (fallback parser): 88.9%
```

Known text-mode gaps surfaced by the harness (good next targets):
- pipe-delimited one-line headers (`Title | Company | Dates`) drop bullets;
- some "title-above-company" variants drop the first job's bullets / company;
- German-section experience (`BERUFSERFAHRUNG`) not always parsed;
- single-word (mononym) names can be replaced by a header skill.
