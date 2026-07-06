-- Voice minute top-up purchases (pay-as-you-go packs).
-- Written ONLY by the Stripe webhook (service role). Consumption is computed
-- from interview_sessions overage, never mutated here — see
-- lib/workzoServerVoiceMinutes.ts for the accounting model.

create table if not exists public.voice_topup_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  minutes integer not null check (minutes > 0),
  pack_id text,
  stripe_session_id text not null unique,
  amount_total integer,
  currency text,
  created_at timestamptz not null default now()
);

create index if not exists voice_topup_purchases_user_idx
  on public.voice_topup_purchases (user_id, created_at);

alter table public.voice_topup_purchases enable row level security;

-- Users may read their own purchases (for a "your boosts" balance display).
create policy "voice_topup_read_own"
  on public.voice_topup_purchases for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: only the service role (webhook) writes.
