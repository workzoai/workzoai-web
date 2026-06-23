-- WorkZo Founder Analytics tables
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.workzo_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text,
  visitor_id text,
  session_id text,
  path text,
  source text,
  referrer text,
  host text,
  origin text,
  is_local boolean default false,
  device_type text,
  user_agent text,
  role text,
  market text,
  recruiter text,
  mode text,
  score numeric,
  trust numeric,
  pressure numeric,
  metadata jsonb default '{}'::jsonb,
  client_timestamp text,
  created_at timestamptz not null default now()
);

create index if not exists workzo_analytics_events_created_at_idx
  on public.workzo_analytics_events (created_at desc);

create index if not exists workzo_analytics_events_event_idx
  on public.workzo_analytics_events (event, created_at desc);

create index if not exists workzo_analytics_events_visitor_idx
  on public.workzo_analytics_events (visitor_id, created_at desc);

create index if not exists workzo_analytics_events_session_idx
  on public.workzo_analytics_events (session_id, created_at desc);

alter table public.workzo_analytics_events enable row level security;

-- No public read/write policies are needed. Server routes use SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.workzo_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null,
  plan text not null default 'free',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workzo_usage_events_user_id_idx
  on public.workzo_usage_events (user_id, created_at desc);

create index if not exists workzo_usage_events_event_name_idx
  on public.workzo_usage_events (event_name, created_at desc);

create index if not exists workzo_usage_events_created_at_idx
  on public.workzo_usage_events (created_at desc);

alter table public.workzo_usage_events enable row level security;
