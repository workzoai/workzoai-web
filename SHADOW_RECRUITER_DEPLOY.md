# WorkZo Shadow Recruiter Deployment

Deployment packaging only. No new feature work. This README is corrected to
match the actual bundle: file paths, the org table name, and the full
copy list are exactly what ships here.

## 1. Backup branch

```
git checkout -b backup-before-shadow-recruiter
git add .
git commit -m "backup before shadow recruiter"
git checkout -b feature/shadow-recruiter-calibration
```

## 2. Apply migration first

Run before deploying app code:

```
supabase/migrations/20260707_shadow_recruiter_calibration.sql
```

Creates:

- scoring_organizations   (this feature's own org registry, uuid PK)
- organization_scoring_profiles
- scoring_profile_versions
- organization_interview_templates
- interview_scoring_snapshots
- recruiter_calibration_reviews

Important:
- This migration does NOT create or alter your existing `organizations`
  table. It uses its own `scoring_organizations` table because your
  existing `organizations.id` is text and cannot be referenced by a uuid
  foreign key. That mismatch is what failed the first migration attempt.
- Do NOT add `org_readiness_score` to `interview_results`.
  `interview_scoring_snapshots` remains the single source of truth.

## 3. Copy files

New files (create):

```
lib/scoring/customRubric.ts
lib/scoring/orgScoringAuth.ts
lib/interview/companyTemplates.ts

app/api/admin/scoring-profiles/route.ts          # GET list, POST create, PATCH new version
app/api/admin/scoring-profiles/activate/route.ts # POST activate (profileId in body)
app/api/admin/company-templates/route.ts
app/api/scoring/custom-rubric/route.ts
app/api/interview/scoring-context/route.ts       # candidate-side org resolver (required)

app/admin/scoring/page.tsx
app/admin/scoring/ScoringAdminClient.tsx         # page.tsx imports this; build fails without it
```

Note: there is NO `scoring-profiles/[id]` dynamic route. PATCH (edit /
new version) and activate both take `profileId` in the request body.

Existing files (overwrite):

```
lib/interviewEngineV3.ts                                   # NOT lib/interview/... ; adds organizationRubricPrompt
app/api/interview/reply/route.ts                           # text path: appends rubric to recruiterBrainContext
app/api/interview/vapi-llm/chat/completions/route.ts       # voice path: reads rubric from Vapi metadata
app/api/db/interview-result/route.ts                       # writes interview_scoring_snapshots on save
app/interview/page.tsx                                      # pins snapshot once, passes it through
```

PowerShell copy (paths preserved from the bundle root):

```powershell
$src = ".\_incoming"   # unzip location of this bundle
$dst = "."             # repo root

$all = @(
  "lib\scoring\customRubric.ts",
  "lib\scoring\orgScoringAuth.ts",
  "lib\interview\companyTemplates.ts",
  "lib\interviewEngineV3.ts",
  "app\api\admin\scoring-profiles\route.ts",
  "app\api\admin\scoring-profiles\activate\route.ts",
  "app\api\admin\company-templates\route.ts",
  "app\api\scoring\custom-rubric\route.ts",
  "app\api\interview\scoring-context\route.ts",
  "app\api\interview\reply\route.ts",
  "app\api\interview\vapi-llm\chat\completions\route.ts",
  "app\api\db\interview-result\route.ts",
  "app\interview\page.tsx",
  "app\admin\scoring\page.tsx",
  "app\admin\scoring\ScoringAdminClient.tsx",
  "supabase\migrations\20260707_shadow_recruiter_calibration.sql"
)

foreach ($f in $all) {
  $target = Join-Path $dst $f
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  Copy-Item -Path (Join-Path $src $f) -Destination $target -Force
}
```

## 4. Environment variables

Reuses your existing secret. No new variables.

```
FOUNDER_ANALYTICS_SECRET=your_existing_secret
```

Do not introduce FOUNDER_MASTER_SECRET.
Do not change NEXT_PUBLIC_SUPABASE_URL. Do not point Supabase to Cloudflare
for this feature.

## 5. Required invariants (all satisfied by this bundle)

- WIRI is not recomputed in Shadow Recruiter. It is imported from
  lib/workzoWiri and used as existing truth.
- Organization readiness score is calculated separately, in
  lib/scoring/customRubric.
- Rubric snapshots are stored in interview_scoring_snapshots.
- Org access is resolved server-side, from the signed-in user's email
  domain. Client-passed orgCode is never trusted.
- PATCH scoring profile appends a new scoring_profile_versions row.
- Old scoring versions are never overwritten.

## 6. Smoke test checklist

Migration:
- [ ] Runs without FK errors.
- [ ] scoring_organizations.id is uuid.
- [ ] Existing `organizations` table is untouched (no new FK into it).
- [ ] Indexes created, RLS enabled on all six tables.

Admin scoring UI:
- [ ] Open /admin/scoring (demo mode with no key shows samples).
- [ ] With ?org=&key=, create a profile; weights must equal 100 to save.
- [ ] Activate a profile; exactly one active per org.
- [ ] Edit weights; confirm a NEW version row is created and the old row
      remains (scoring_profile_versions count increments).

Company templates load (each default weight set totals 100):
- [ ] SAP, Bosch, BMW, Siemens, Amazon, Google, Microsoft, Accenture,
      Deloitte, EY, PwC.

Interview engine, B2C (must be unchanged):
- [ ] Start a normal CV + JD interview with no org. scoring-context returns
      hasProfile:false. Text and voice work exactly as before.

Interview engine, org-linked:
- [ ] Sign in as a user whose email domain matches an org with an active
      profile. scoring-context returns hasProfile:true.
- [ ] Active rubric prompt is injected; text interview works.
- [ ] Voice interview works.
- [ ] No rubric, weights, or scoring language leaks to the candidate.

Save path (after an org-linked interview):
- [ ] interview_results row created.
- [ ] interview_scoring_snapshots row created with: global_wiri,
      organization_readiness_score, weighted_breakdown,
      scoring_profile_version_id.
- [ ] Changing the rubric mid-interview does not change this session's
      snapshot (pinned at start).

Security:
- [ ] Founder secret can access all orgs.
- [ ] Org HMAC key accesses only its own org.
- [ ] Org A cannot read Org B profiles.
- [ ] A student/candidate cannot edit a rubric.
- [ ] A client cannot spoof an organization.

## 7. Build commands

```
npm install
npm run lint
npm run build
```

Vercel:

```
vercel build
vercel deploy
```

## 8. Manual production test

1. Log in as founder.
2. Open /admin/scoring, create an SAP-style rubric, activate it.
3. Run an interview as an org-linked user, complete it.
4. Confirm an interview_scoring_snapshots row exists.
5. Open the cohort dashboard; confirm WIRI and org readiness remain
   separate values.

## 9. Rollback plan

If anything fails:
- Revert the feature commit and redeploy the previous version.
- Do not drop the migration immediately (snapshots are additive and safe
  to leave in place).
- If only the admin surface is a problem, you can remove
  app/admin/scoring and the app/api/admin/scoring-* routes; the interview
  paths degrade gracefully (scoring-context returns hasProfile:false).

Optional kill switch (NOT wired in this bundle; ~4 lines each if you want it):
A SHADOW_RECRUITER_ENABLED=false flag could short-circuit three points:
the scoring-context route (return hasProfile:false early), the snapshot
insert in interview-result, and the /admin/scoring page (render a disabled
notice). Say the word and I will add it as a clean, single-flag guard.

## Final deployment rule

Ship only when this remains true: B2C users can upload a CV, paste a JD, and
take a realistic interview with zero awareness of Shadow Recruiter.
