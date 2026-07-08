/*
  Partner trials: one-click redeemable trials for coding-school / partner
  accounts. A founder creates an OFFER (a redeem code) scoped to a single
  email or a whole email domain. The partner clicks the redeem link, and
  each user gets their own GRANT: 7 interviews / 14 days / Premium Pro.

  Fully additive. Does not touch workzo_subscriptions or Stripe billing.
  Entitlement is granted at plan-resolution time by reading these tables;
  it only ever UPGRADES a free user, never downgrades a paying one.

  Safe to re-run.
*/

create extension if not exists pgcrypto;

/* The offer / redeem code created by the founder. */
create table if not exists workzo_partner_trials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,

  scope text not null default 'email',         -- 'email' | 'domain'
  target text not null,                         -- lowercased email or bare domain (e.g. school.com)

  plan text not null default 'premium_pro',
  interviews_limit integer not null default 7,
  duration_days integer not null default 14,

  label text,                                   -- e.g. "WBS Coding School"
  created_by text,
  is_active boolean not null default true,

  redeemed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_trials_target on workzo_partner_trials(scope, target);

/* Per-user activation of an offer. One row per user; carries that user's
   own expiry and interview counter so a whole domain of students each get
   their own 7 interviews / 14 days. */
create table if not exists workzo_partner_trial_grants (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references workzo_partner_trials(id) on delete cascade,

  user_id uuid not null,
  email text,

  plan text not null default 'premium_pro',
  interviews_limit integer not null default 7,
  interviews_used integer not null default 0,

  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  unique (trial_id, user_id)
);

create index if not exists idx_partner_trial_grants_user on workzo_partner_trial_grants(user_id);
create index if not exists idx_partner_trial_grants_email on workzo_partner_trial_grants(email);

/* Service-role only; no anon policies. */
alter table workzo_partner_trials enable row level security;
alter table workzo_partner_trial_grants enable row level security;
