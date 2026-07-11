create table if not exists public.cv_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  file_name text,
  file_hash text,
  status text not null default 'processing',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, file_hash)
);

create index if not exists cv_processing_jobs_user_status_idx on public.cv_processing_jobs(user_id, status);
create index if not exists cv_processing_jobs_hash_idx on public.cv_processing_jobs(file_hash);

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists subscription_status text;
alter table public.profiles add column if not exists plan_tier text default 'free';
