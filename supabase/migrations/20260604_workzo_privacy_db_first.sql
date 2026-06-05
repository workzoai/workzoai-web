-- WorkZo production DB foundation.
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  mode text not null default 'standard',
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
  message text not null,
  message_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.interview_sessions(id) on delete cascade,
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

create index if not exists interview_sessions_user_updated_idx on public.interview_sessions(user_id, updated_at desc);
create index if not exists interview_messages_session_idx on public.interview_messages(session_id, message_index asc, created_at asc);
create index if not exists interview_results_user_created_idx on public.interview_results(user_id, created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);

alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.interview_results enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "interview_sessions_own" on public.interview_sessions;
create policy "interview_sessions_own" on public.interview_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interview_messages_own" on public.interview_messages;
create policy "interview_messages_own" on public.interview_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "interview_results_own" on public.interview_results;
create policy "interview_results_own" on public.interview_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "usage_events_own" on public.usage_events;
create policy "usage_events_own" on public.usage_events for all using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id or user_id is null);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_interview_sessions_updated_at on public.interview_sessions;
create trigger touch_interview_sessions_updated_at before update on public.interview_sessions for each row execute function public.touch_updated_at();

drop trigger if exists touch_interview_results_updated_at on public.interview_results;
create trigger touch_interview_results_updated_at before update on public.interview_results for each row execute function public.touch_updated_at();
