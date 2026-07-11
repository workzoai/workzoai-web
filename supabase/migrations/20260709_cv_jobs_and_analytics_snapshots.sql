create table if not exists cv_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_hash text not null,
  file_name text,
  status text not null default 'processing' check (status in ('queued','processing','completed','failed','duplicate')),
  canonical_profile_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, file_hash)
);

create index if not exists cv_processing_jobs_user_status_idx on cv_processing_jobs(user_id, status, created_at desc);

create table if not exists analytics_snapshots (
  id bigserial primary key,
  snapshot_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);
