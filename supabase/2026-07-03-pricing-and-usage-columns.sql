-- WorkZo AI pricing/usage columns for minute-based plans and Enterprise cohorts.
-- Safe to run multiple times in Supabase/Postgres.

alter table if exists public.workzo_subscriptions
  add column if not exists plan text default 'free',
  add column if not exists plan_tier text,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists stripe_subscription_id text,
  add column if not exists voice_minutes_used integer not null default 0,
  add column if not exists video_minutes_used integer not null default 0,
  add column if not exists tavus_minutes_used integer not null default 0,
  add column if not exists billing_cycle_start timestamptz default now(),
  add column if not exists enterprise_org_id uuid;

create index if not exists idx_workzo_subscriptions_user_id
  on public.workzo_subscriptions(user_id);

create index if not exists idx_workzo_subscriptions_stripe_subscription_id
  on public.workzo_subscriptions(stripe_subscription_id);

create index if not exists idx_workzo_subscriptions_enterprise_org_id
  on public.workzo_subscriptions(enterprise_org_id);

create table if not exists public.workzo_enterprise_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  plan text not null default 'enterprise',
  contract_status text not null default 'lead',
  voice_minutes_pool integer not null default 0,
  video_minutes_pool integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
