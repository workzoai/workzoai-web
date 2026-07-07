-- WorkZo Talent Marketplace persistence layer
-- Safe to run after the WIRI/cohort upgrade. These tables do not change the B2C interview flow.

create table if not exists public.talent_visibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id text not null,
  visibility text not null default 'private' check (visibility in ('private', 'organization', 'verified_employers')),
  passport_enabled boolean not null default false,
  open_to_relocation boolean not null default false,
  open_to_internships boolean not null default false,
  open_to_graduate_programs boolean not null default false,
  availability text,
  visa_status text,
  salary_expectation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

create table if not exists public.hiring_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  employer_name text not null default 'Hiring Partner',
  title text not null,
  job_description text not null,
  role text,
  location text,
  languages text[] not null default '{}',
  experience_level text,
  skills text[] not null default '{}',
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_shortlists (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  campaign_id uuid references public.hiring_campaigns(id) on delete set null,
  candidate_user_id uuid not null,
  status text not null default 'shortlisted' check (status in ('shortlisted', 'invited', 'reviewing', 'rejected', 'hired')),
  match_score integer,
  reasons text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, campaign_id, candidate_user_id)
);

create table if not exists public.recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  candidate_user_id uuid not null,
  campaign_id uuid references public.hiring_campaigns(id) on delete set null,
  note text not null,
  visibility text not null default 'private' check (visibility in ('private', 'team')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  campaign_id uuid references public.hiring_campaigns(id) on delete set null,
  candidate_user_id uuid not null,
  invite_type text not null default 'interview' check (invite_type in ('interview', 'cv_request', 'follow_up')),
  message text,
  status text not null default 'sent' check (status in ('draft', 'sent', 'accepted', 'declined')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists talent_visibility_org_idx on public.talent_visibility(organization_id);
create index if not exists hiring_campaigns_org_idx on public.hiring_campaigns(organization_id, created_at desc);
create index if not exists marketplace_shortlists_org_idx on public.marketplace_shortlists(organization_id, created_at desc);
create index if not exists recruiter_notes_org_candidate_idx on public.recruiter_notes(organization_id, candidate_user_id);
create index if not exists candidate_invites_org_idx on public.candidate_invites(organization_id, created_at desc);
