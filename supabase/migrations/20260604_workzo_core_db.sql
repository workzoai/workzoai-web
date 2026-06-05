-- WorkZo AI database foundation
-- Run this in Supabase SQL editor or through Supabase migrations.
-- This moves interview setup/session/result/usage state away from localStorage.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'premium', 'founder')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_name text,
  target_role text,
  target_company text,
  target_market text,
  interview_language text not null default 'English',
  recruiter_id text,
  recruiter_name text,
  recruiter_title text,
  recruiter_image text,
  cv_text text,
  job_description text,
  resume_profile jsonb,
  recruiter_memory_profile jsonb,
  job_memory_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup_id uuid references public.interview_setups(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'abandoned', 'failed')),
  mode text not null default 'standard' check (mode in ('standard', 'premium_voice', 'tavus', 'retry')),
  question_index integer not null default 0,
  elapsed_seconds integer not null default 0,
  trust_score integer not null default 70,
  interest_score integer not null default 70,
  recruiter_memory jsonb not null default '{}'::jsonb,
  recovery_snapshot jsonb not null default '{}'::jsonb,
  failure_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('recruiter', 'candidate', 'system')),
  speaker text,
  text text not null,
  message_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  overall_score integer,
  trust_score integer,
  evidence_quality integer,
  contradiction_risk integer,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  weak_answers jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  evidence_requests jsonb not null default '[]'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null,
  plan text not null default 'free',
  session_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium', 'founder')),
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_setups_user_id_updated_idx on public.interview_setups(user_id, updated_at desc);
create index if not exists interview_sessions_user_id_updated_idx on public.interview_sessions(user_id, updated_at desc);
create index if not exists interview_messages_session_id_idx on public.interview_messages(session_id, message_index asc, created_at asc);
create index if not exists interview_results_session_id_idx on public.interview_results(session_id);
create index if not exists usage_events_user_id_created_idx on public.usage_events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.interview_setups enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.interview_results enable row level security;
alter table public.usage_events enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "interview_setups_own" on public.interview_setups;
create policy "interview_setups_own" on public.interview_setups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interview_sessions_own" on public.interview_sessions;
create policy "interview_sessions_own" on public.interview_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interview_messages_own" on public.interview_messages;
create policy "interview_messages_own" on public.interview_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interview_results_own" on public.interview_results;
create policy "interview_results_own" on public.interview_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "usage_events_own" on public.usage_events;
create policy "usage_events_own" on public.usage_events for all using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id or user_id is null);

drop policy if exists "subscriptions_own" on public.subscriptions;
create policy "subscriptions_own" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

drop trigger if exists touch_interview_setups_updated_at on public.interview_setups;
create trigger touch_interview_setups_updated_at before update on public.interview_setups for each row execute function public.touch_updated_at();

drop trigger if exists touch_interview_sessions_updated_at on public.interview_sessions;
create trigger touch_interview_sessions_updated_at before update on public.interview_sessions for each row execute function public.touch_updated_at();

drop trigger if exists touch_interview_results_updated_at on public.interview_results;
create trigger touch_interview_results_updated_at before update on public.interview_results for each row execute function public.touch_updated_at();

drop trigger if exists touch_subscriptions_updated_at on public.subscriptions;
create trigger touch_subscriptions_updated_at before update on public.subscriptions for each row execute function public.touch_updated_at();
