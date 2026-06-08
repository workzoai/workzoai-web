-- WorkZo AI Stripe subscription table
-- Run this in Supabase SQL editor before testing Stripe checkout/webhooks.

create table if not exists public.workzo_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free',
  status text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workzo_subscriptions_plan_check check (plan in ('free', 'premium')),
  constraint workzo_subscriptions_status_check check (status in ('free', 'premium', 'cancelled', 'past_due', 'expired'))
);

alter table public.workzo_subscriptions enable row level security;

create policy "Users can read own WorkZo subscription"
  on public.workzo_subscriptions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own WorkZo subscription placeholder"
  on public.workzo_subscriptions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own WorkZo subscription placeholder"
  on public.workzo_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists workzo_subscriptions_user_id_idx on public.workzo_subscriptions(user_id);
create index if not exists workzo_subscriptions_customer_idx on public.workzo_subscriptions(stripe_customer_id);
create index if not exists workzo_subscriptions_subscription_idx on public.workzo_subscriptions(stripe_subscription_id);
