-- WorkZo Talent Marketplace complete internal implementation
-- Safe to run after earlier marketplace migrations. Uses IF NOT EXISTS where possible.

create extension if not exists pgcrypto;

create table if not exists organizations (
  id text primary key,
  name text not null,
  type text not null default 'university',
  country text,
  logo_url text,
  subscription_plan text default 'b2b_trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  program text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cohort_members (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  cohort_id uuid references cohorts(id) on delete cascade,
  user_id text not null,
  role text not null default 'student',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(organization_id, cohort_id, user_id)
);

create table if not exists talent_visibility (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  user_id text not null,
  visibility text not null default 'private' check (visibility in ('private', 'organization', 'verified_employers')),
  passport_enabled boolean not null default false,
  passport_slug text,
  open_to_relocation boolean not null default false,
  open_to_internships boolean not null default false,
  open_to_graduate_programs boolean not null default true,
  preferred_work_mode text default 'flexible',
  salary_expectation text,
  consent_version text default '2026-07-07',
  consented_at timestamptz default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, organization_id),
  unique(passport_slug)
);

create index if not exists idx_talent_visibility_org_visibility on talent_visibility(organization_id, visibility);
create index if not exists idx_talent_visibility_user on talent_visibility(user_id);

create table if not exists hiring_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  employer_name text not null default 'Hiring Partner',
  title text not null,
  job_description text not null,
  role text,
  industry text,
  location text,
  country text,
  city text,
  remote boolean not null default true,
  languages text[] not null default '{}',
  experience_level text,
  skills text[] not null default '{}',
  target_hires integer not null default 1,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'closed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hiring_campaigns_org_status on hiring_campaigns(organization_id, status);

create table if not exists marketplace_shortlists (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  campaign_id uuid references hiring_campaigns(id) on delete cascade,
  candidate_user_id text not null,
  status text not null default 'shortlisted' check (status in ('shortlisted', 'reviewing', 'invited', 'interviewing', 'offer', 'hired', 'rejected', 'archived')),
  match_score integer,
  reasons text[] not null default '{}',
  cautions text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, campaign_id, candidate_user_id)
);

create index if not exists idx_shortlists_org_campaign on marketplace_shortlists(organization_id, campaign_id);
create index if not exists idx_shortlists_candidate on marketplace_shortlists(candidate_user_id);

create table if not exists recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  candidate_user_id text not null,
  campaign_id uuid references hiring_campaigns(id) on delete set null,
  note text not null,
  visibility text not null default 'private',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recruiter_notes_org_candidate on recruiter_notes(organization_id, candidate_user_id);

create table if not exists marketplace_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  actor_type text not null default 'system',
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_activity_org_created on marketplace_activity_log(organization_id, created_at desc);

create table if not exists marketplace_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  provider text not null,
  status text not null default 'not_connected',
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, provider)
);

create table if not exists company_interview_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id text,
  company_name text not null,
  role_family text,
  recruiter_persona text,
  interview_sequence jsonb not null default '[]'::jsonb,
  question_bank jsonb not null default '[]'::jsonb,
  scoring_rubric jsonb not null default '{}'::jsonb,
  difficulty text default 'standard',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into company_interview_templates(company_name, role_family, recruiter_persona, interview_sequence, scoring_rubric, difficulty)
values
('SAP', 'Customer Success / Technical Consulting', 'Structured enterprise hiring manager', '["Intro", "Role motivation", "Customer scenario", "Technical/functional depth", "Behavioral STAR", "Candidate questions"]', '{"communication":20,"technical":25,"customer_thinking":25,"star":15,"job_fit":15}', 'medium'),
('Bosch', 'Engineering / Data / Business', 'Practical engineering manager', '["Intro", "Project walkthrough", "Problem solving", "Technical depth", "Teamwork", "Closing"]', '{"technical":30,"problem_solving":25,"communication":20,"ownership":15,"job_fit":10}', 'medium'),
('Deloitte', 'Consulting / Analytics', 'Case-oriented consulting interviewer', '["Intro", "Case question", "Stakeholder scenario", "Evidence/impact", "Leadership", "Closing"]', '{"business_thinking":30,"communication":25,"evidence":20,"leadership":15,"job_fit":10}', 'medium')
on conflict do nothing;

alter table talent_visibility enable row level security;
alter table hiring_campaigns enable row level security;
alter table marketplace_shortlists enable row level security;
alter table recruiter_notes enable row level security;
alter table marketplace_activity_log enable row level security;
alter table marketplace_integrations enable row level security;
alter table company_interview_templates enable row level security;

-- Service-role API bypasses RLS. Add app-specific authenticated policies later when user/org auth is finalized.
