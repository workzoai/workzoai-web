-- WorkZo AI interview history support
-- Run in Supabase SQL editor only if these columns do not already exist.

alter table public.interview_sessions
  add column if not exists transcript jsonb default '[]'::jsonb,
  add column if not exists duration_seconds integer default 0,
  add column if not exists report jsonb,
  add column if not exists candidate_name text,
  add column if not exists target_company text,
  add column if not exists recruiter_title text,
  add column if not exists overall_score integer,
  add column if not exists trust_score integer,
  add column if not exists verdict jsonb,
  add column if not exists summary jsonb,
  add column if not exists weakest_moment jsonb;

create unique index if not exists interview_sessions_user_local_id_unique
  on public.interview_sessions(user_id, local_id)
  where local_id is not null;
