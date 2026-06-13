create table if not exists public.workzo_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,
  visitor_id text not null,
  session_id text not null,
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
  client_timestamp text
);

create index if not exists workzo_analytics_events_created_at_idx
  on public.workzo_analytics_events (created_at desc);

create index if not exists workzo_analytics_events_visitor_id_idx
  on public.workzo_analytics_events (visitor_id);

create index if not exists workzo_analytics_events_event_idx
  on public.workzo_analytics_events (event);

alter table public.workzo_analytics_events enable row level security;

-- No public reads/writes. The Next.js route uses SUPABASE_SERVICE_ROLE_KEY.
drop policy if exists "No public analytics access" on public.workzo_analytics_events;
