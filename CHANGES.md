# WorkZo CV Pipeline — corruption fix

Drop these six files into your repo at the same paths (`app/…`, `lib/…`, `tests/…`).
Everything here is deterministic and was validated by transpiling the finalizer with `tsc`
and running the layout cases in Node — no build was possible in this environment (no network),
so run `next build` + the test suite locally before deploying.

## What was wrong

Both `/api/cv` and `/api/cv/structure` ended `buildResponse()` with:

```
lockResumeProfileIdentity()  →  mergeCvProfile()  →  api.cv.name_override
```

The first parser usually produced a correct name; this trailing stage then re-derived
identity from raw multi-column text and overwrote it with layout markers, section headers,
or school/company names. That is the `finalName: Page Left Column End / WBS Programmierschule`
pattern in your logs.

## What changed

**Phase 1 — `app/api/cv/route.ts` and `app/api/cv/structure/route.ts`**
- `buildResponse()` now calls `finalizeCanonicalCvProfile()` once and returns that result.
- Removed the `mergeCvProfile()` call, the `lockResumeProfileIdentity()` pre-step, and the
  `api.cv.name_override` log from this path. Replaced with `api.cv.finalizer.identity_decision`
  logging `selectedName`, `selectedNameSource`, and `rejectedCandidates`.
- The finalized profile is `Object.freeze()`d — nothing downstream can mutate identity.
- Swapped the `mergeCvProfile` import for `finalizeCanonicalCvProfile`. `enforceCanonicalCandidateName`
  / `lockResumeProfileIdentity` are still imported because earlier repair/Affinda paths use them;
  the finalizer runs last and is authoritative.

**Phase 3 + Phase 10 — `lib/workzoCvGlobalFinalizer.ts` (the important one)**
- Added `STRUCTURAL_GARBAGE_RE` + `isStructuralGarbage()` and wired it into name validation,
  headline validation, skills/languages/certifications, and experience/education detection.
  Previously `Page Start`, `Page Left Column End`, `Column Start`, etc. matched *none* of the
  section/role/degree/company regexes and passed as valid names. They're now rejected everywhere.
- Finalizer now records `confidence.nameSource` and `confidence.rejectedNameCandidates` for the
  identity-decision log. (`confidence` type widened from `Record<string, number>` to
  `Record<string, unknown>` — this type is local to the finalizer, no other consumer reads it.)
- **Bug found while testing:** `isEducationLike`, `isExperienceLike`, and `normalizeEducation`
  all built their match string with `[...].map(text)`. `Array.map` passes the element *index*
  as the second argument, and `text(value, max)` treats it as `max`, so every field was
  truncated to its index length (`"WBS Programmierschule"` → `"W"`). Education-in-experience
  detection was effectively dead. Fixed to `.map((v) => text(v))`. This is what made the German
  Ausbildung/bootcamp case start moving to education correctly in testing.

**Phase 2 — `lib/cvProfileMerge.ts`**
- Raw-text name recovery is now gated behind `WORKZO_ALLOW_RAW_NAME_RECOVERY` (default off) and
  moved to the end of the name precedence list. `mergeCvProfile` is no longer on the CV route
  path, but it's still exported, so this keeps it safe wherever else it's used.
  Keep `WORKZO_ALLOW_RAW_NAME_RECOVERY=false` in production.

**Phase 4/5 — `lib/workzoSpatialPdfExtractor.ts`**
- Phase 4 was already satisfied (no `[PAGE_…]` markers are injected into parser text).
- Added header-band-first serialization for multi-column pages: when the top ~16% of the page
  contains text on *both* sides of the column split (a genuine full-width header), it's
  serialized first so the parser sees `Name` / `Headline` as the opening lines instead of
  losing them behind the sidebar. Deliberately kept the existing left→right order for the
  remaining body — see "Deferred" below.

**Phase 9 — `tests/cv-parser-regression.test.ts`**
- Table-driven regression suite over the finalizer covering ATS, Canva two-column, sidebar-first,
  German Lebenslauf, placeholder, and filename-acronym layouts, plus the exact `invalidNames`
  guard list from the spec. Runs under Vitest or Jest (globals). All cases pass.

## Verified in this environment

```
PASS ATS         name="Haritha Kollipara"  hl="Senior Backend Engineer"   exp#1 edu#1
PASS Canva       name="Jane Doe"           hl="IT Support Specialist"     exp#1 edu#0
PASS sidebar     name="Marta Novak"        hl="Marketing Manager"         exp#1 edu#1
PASS German      name="Lukas Bauer"        hl="Professional"              exp#1 edu#1
PASS placeholder name="Candidate"          hl="Professional"              exp#0 edu#0
PASS acronym     name="Priya Sharma"       hl="Customer Success Manager"  exp#1 edu#0
```

Finalizer type-checks clean under `tsc --strict`.

## Deferred (not in this drop)

- **Phase 5 column flip (body-before-sidebar):** the spec recommends serializing the main/body
  column before the sidebar. I left left→right in place because your own README notes the spatial
  patch previously *worsened* single-column and top-header CVs, and I couldn't run the 50-CV suite
  here to prove a flip is safe. The header extraction (the actual cause of split names) is done;
  enable the flip once real fixtures back it. Marked with a `NOTE:` comment at the call site.
- **Phase 6 (OpenRouter strict `json_schema` + confidence fields):** touches the 1,392-line
  `workzoAiCvParser.ts` and needs a live model round-trip to validate; not attempted blind.
- **Phase 9 real fixtures:** the suite tests the finalizer directly. Add a second block that runs
  actual PDFs through `/api/cv` and reuses `assertGlobalInvariants` once you have the fixture set.

## Suggested rollout

Apply Phase 1 (both routes) + the finalizer first — that alone stops the corruption. Build,
run the regression suite, test ~10 known CVs, then staging → production while watching
`api.cv.finalizer.identity_decision` for `selectedNameSource` and any `rejectedCandidates`.
