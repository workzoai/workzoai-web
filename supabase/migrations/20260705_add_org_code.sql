-- WorkZo AI — optional organization grouping for the partner admin dashboard.
-- Run this once (Supabase SQL editor or `supabase db push`) to enable reliable
-- cohort grouping by org code (in addition to email-domain scoping).
--
-- Safe to run before or after deploying the app: the /api/interview-sessions
-- route already tolerates this column being absent, so nothing breaks either way.

alter table if exists public.interview_sessions
  add column if not exists org_code text;

create index if not exists interview_sessions_org_code_idx
  on public.interview_sessions (org_code);

comment on column public.interview_sessions.org_code is
  'Partner/organization code captured from a coded signup link (?org=CODE). Used by /api/admin/cohort to group a partner''s learners.';
