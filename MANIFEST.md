# WorkZo — CV source fix + LinkedIn Career Optimizer (v2)

Unzip at your **repo root**, then `npx tsc --noEmit`.

---

## Implementation status: 3 of your 12 items

**Built:**

| # | Item | Where |
|---|---|---|
| 2 | CV ↔ LinkedIn consistency | `lib/workzoLinkedInEngine.ts` → `checkCvLinkedInConsistency` |
| 3 | LinkedIn ↔ JD match | `lib/workzoLinkedInEngine.ts` → `matchLinkedInToJd` |
| 5 | AI rewrite (headline + About) | `app/api/linkedin/rewrite/route.ts` + guard |

**Parsed but not surfaced** — `parseLinkedInProfile` already returns `meta` with
`hasCustomUrl`, `connections`, `hasFeatured`, `recommendationCount`. That is most
of item 12 (Health Check) sitting there unused. It needs a UI, not an engine.

**Not built:** 1 (multi-dimension profile score), 4 (recruiter search visibility),
6 (headline generator as a standalone), 7 (banner), 8 (featured advisor),
9 (activity planner), 10 (recruiter simulation), 11 (unified readiness),
12 (health check UI). Career Brand Score does not exist.

The marketing copy in this patch claims **only what is built**. Do not widen it
until the engines exist.

---

## NEW files (7)

```
lib/workzoCvSource.ts                  resolveCvSource() / persistCvSource()
lib/workzoLinkedInParser.ts            deterministic LinkedIn paste parser
lib/workzoLinkedInEngine.ts            engines 2 + 3
lib/workzoLinkedInRewriteGuard.ts      deterministic guard over the AI rewrite
app/linkedin/page.tsx                  the optimizer page
app/api/linkedin/analyze/route.ts      Analyze tier (free, auth required, 20/min)
app/api/linkedin/rewrite/route.ts      Improve tier (Premium+, 8/min)
app/api/linkedin/import-pdf/route.ts   LinkedIn "Save to PDF" import via vision extractor
```

## Why no LinkedIn URL field

There is no official LinkedIn API returning a member's experience, skills, or About
without partner approval; the self-serve Consumer API gives name, headline and photo.
Scraping the public page is not a CFAA violation (hiQ v. LinkedIn) but does breach
LinkedIn's User Agreement, enforced civilly — Proxycurl was sued into shutting down.

So the inputs are **paste** (complete) or **LinkedIn's own PDF export** (faster).
The PDF is read by `extractCvWithVision`, the same vision path that fixed CV parsing:
the export is two-column with a Top Skills sidebar, and flattening it to text
interleaves the sidebar into the experience section.

The export truncates to top skills, so `skillsComplete: false` propagates and the
consistency engine **suppresses** `skills_missing_on_linkedin` rather than reporting a
fabricated omission. The UI says so instead of silently dropping the check.

## MODIFIED files (9) — these OVERWRITE yours. Diff before committing.

| Path | Change |
|---|---|
| `app/cv/page.tsx` | ~300-line resolution effect replaced by one `resolveCvSource()` read. Adds the "Not right? Upload the CV again" bar. |
| `components/CvSourcePanel.tsx` | Calls `persistCvSource()` so canonical + setup stores cannot drift. |
| `lib/workzoResumeProfileManager.ts` | Education pipeline reordered to `normalize → filter → dedupe`. One block. |
| `lib/workzoPlanLimits.ts` | Adds `linkedin_analyze` (free), `linkedin_rewrite` (premium), `linkedin_recruiter_sim` (premium_pro, reserved). |
| `app/page.tsx` | Adds `Linkedin` icon import; a 5th `quickFeatures` card; **grid changed `md:grid-cols-4` → `sm:grid-cols-2 lg:grid-cols-5`** to fit it; nav dropdown entry. |
| `app/features/[slug]/page.tsx` | New `linkedin-optimizer` entry. `generateStaticParams` picks it up automatically → `/features/linkedin-optimizer`. |
| `components/WorkZoFooter.tsx` | Product link to `/linkedin`. |
| `app/pricing/page.tsx` | Free-plan bullet, Premium bullet ("AI LinkedIn rewrite"), and 3 new `comparisonRows`: LinkedIn vs CV Consistency (free), LinkedIn vs Job Match (free), AI LinkedIn Rewrite (premium+). |
| `app/dashboard/page.tsx` | `Linkedin` icon import, an action card gated on `feature: "linkedin_analyze"`, and a sidebar `navItems` entry. |

**The grid change is the one visual regression risk.** Four cards at `md:grid-cols-4`
became five, which would have gone ragged. Check the section at the `md` breakpoint.

## Test harnesses (2)

At repo root, because they import via `./lib/...`.

```bash
npx tsx linkedin.test.ts   # date parsing, duplicate-line paste, both engines
npx tsx guard.test.ts      # 8 assertions against adversarial model output
npx tsx pdf-import.test.ts # 9 assertions: PDF dates, skills truncation, forgery guard
```

---

## Still on you

- **`app/cover-letter/page.tsx`** has the identical defect `app/cv/page.tsx` had:
  it reads the setup store directly. It should call `resolveCvSource()`.
- **`lib/workzoCanonicalProfile.ts`** unchanged and still correct. `workzoCvSource.ts`
  is now its only reader. Do not delete it.
- **`/linkedin` is not in `lib/free-tools.ts`** on purpose. It needs a parsed CV,
  therefore auth, therefore it cannot be a Google-indexable free tool. The nav and
  footer entries do not carry a "Free ·" prefix for that reason.
- **No dashboard sidebar entry.** One line, wherever that list now lives.
- **No upgrade CTA inside `app/tools/[slug]/page.tsx` results.** Still the highest-leverage
  unbuilt thing on your list.

## Icon note

`lucide-react` removed brand icons. There is **no `Linkedin` export** in your version —
`components/WorkZoFooter.tsx` already says so in a comment and hand-rolls an inline SVG.
All LinkedIn entries therefore use `UserRound` (dashboard card, sidebar, landing card),
which the codebase already imports. If you want the real glyph on the dashboard card,
lift `LinkedinIcon` out of `WorkZoFooter.tsx` into a shared component — but note the
dashboard types its icons as `LucideIcon`, so the inline SVG will not satisfy that type
without widening it.

## Env vars used (existing, none new)

`OPENROUTER_API_KEY`, `OPENROUTER_WRITING_PREMIUM_MODEL`, `OPENROUTER_WRITING_PRO_MODEL`.
