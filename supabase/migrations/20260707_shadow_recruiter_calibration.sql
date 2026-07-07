/*
  Shadow Recruiter Calibration + Custom Rubrics
  Run in the Supabase SQL editor.

  Adds a B2B scoring layer on top of the existing interview engine:
  a self-contained org registry, versioned scoring profiles, per-interview
  scoring snapshots, interview templates, and recruiter calibration reviews.

  IMPORTANT: this feature uses its OWN org registry table,
  `scoring_organizations`, and does NOT touch or depend on any pre-existing
  `organizations` table. That avoids a foreign-key type clash (an existing
  organizations.id may be text, while this feature keys on uuid) and leaves
  your current schema completely untouched. Orgs here are resolved by slug
  (the email domain), which is how candidates are already matched to a cohort.

  Safe to re-run: everything is guarded with "if not exists".
  All access goes through service-role API routes, so RLS is enabled with no
  public policies. Client code never touches these tables directly.
*/

create extension if not exists pgcrypto;

/* Self-contained organization registry for the scoring layer.
   Slug matches the org identifier already used by the cohort dashboard
   (email domain or org code). Kept separate from any existing
   organizations table so this migration cannot conflict with it. */
create table if not exists scoring_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* 1. Scoring profiles. One org can hold many, one active default. */
create table if not exists organization_scoring_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scoring_organizations(id) on delete cascade,

  name text not null,
  description text,

  profile_type text not null default 'custom',
  /* custom | company_template | role_template | default */

  target_role text,
  company_template text,
  industry text,

  is_active boolean not null default false,
  is_default boolean not null default false,

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scoring_profiles_org
  on organization_scoring_profiles(organization_id);

/* 2. Profile versions. Edits never overwrite scoring logic silently:
   every change appends a new version row. */
create table if not exists scoring_profile_versions (
  id uuid primary key default gen_random_uuid(),
  scoring_profile_id uuid not null references organization_scoring_profiles(id) on delete cascade,

  version_number integer not null,

  weights jsonb not null,
  thresholds jsonb not null,
  competency_labels jsonb not null,
  prompt_guidance jsonb,
  evaluation_guidance jsonb,

  is_active boolean not null default true,

  created_by uuid,
  created_at timestamptz not null default now(),

  unique(scoring_profile_id, version_number)
);

create index if not exists idx_profile_versions_profile
  on scoring_profile_versions(scoring_profile_id);

/* 3. Scoring snapshots. Freezes the exact model used at interview time
   so historical results stay fair when rubrics change later. */
create table if not exists interview_scoring_snapshots (
  id uuid primary key default gen_random_uuid(),

  interview_result_id uuid not null references interview_results(id) on delete cascade,
  organization_id uuid references scoring_organizations(id) on delete set null,

  scoring_profile_id uuid references organization_scoring_profiles(id) on delete set null,
  scoring_profile_version_id uuid references scoring_profile_versions(id) on delete set null,

  global_wiri integer,
  organization_readiness_score integer,

  competency_scores jsonb not null,
  weighted_breakdown jsonb not null,
  evidence jsonb,
  risk_flags jsonb,
  recommendation text,

  created_at timestamptz not null default now()
);

create index if not exists idx_scoring_snapshots_result
  on interview_scoring_snapshots(interview_result_id);
create index if not exists idx_scoring_snapshots_org
  on interview_scoring_snapshots(organization_id);

/* 4. Interview templates (company or role flavored). */
create table if not exists organization_interview_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references scoring_organizations(id) on delete cascade,

  name text not null,
  company_name text,
  role_family text,
  industry text,

  interview_flow jsonb not null,
  recruiter_persona jsonb not null,
  question_strategy jsonb not null,
  scoring_profile_id uuid references organization_scoring_profiles(id),

  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interview_templates_org
  on organization_interview_templates(organization_id);

/* 5. Recruiter calibration reviews. Human score vs AI score, used to
   surface systematic gaps and suggest rubric adjustments. */
create table if not exists recruiter_calibration_reviews (
  id uuid primary key default gen_random_uuid(),

  interview_result_id uuid not null references interview_results(id) on delete cascade,
  organization_id uuid not null references scoring_organizations(id) on delete cascade,
  reviewer_id uuid,

  ai_score integer,
  recruiter_score integer,

  competency_overrides jsonb,
  recruiter_notes text,

  calibration_gap integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_calibration_reviews_org
  on recruiter_calibration_reviews(organization_id);

/* Lock everything down. Service role bypasses RLS; no anon policies. */
alter table scoring_organizations enable row level security;
alter table organization_scoring_profiles enable row level security;
alter table scoring_profile_versions enable row level security;
alter table interview_scoring_snapshots enable row level security;
alter table organization_interview_templates enable row level security;
alter table recruiter_calibration_reviews enable row level security;
