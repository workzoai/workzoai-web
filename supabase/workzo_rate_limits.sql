-- workzo_rate_limits
--
-- The rate limiter in lib/workzoRateLimit.ts queries this table on every
-- protected request. The table did not exist, so every call logged
-- "Could not find the table 'public.workzo_rate_limits' in the schema cache"
-- and FAILED OPEN, meaning rate limiting was silently disabled everywhere.
--
-- Schema matches exactly what the code reads and writes:
--   .select("count").eq("rate_key", key).eq("window_start", windowStart)
--   .update({ count })  /  .insert({ rate_key, window_start, count: 1 })
-- The primary key gives the 23505 duplicate-key error the code already handles
-- when two concurrent requests race to create the same window.

create table if not exists public.workzo_rate_limits (
  rate_key     text        not null,
  window_start timestamptz not null,
  count        integer     not null default 1,
  primary key (rate_key, window_start)
);

create index if not exists workzo_rate_limits_key_idx
  on public.workzo_rate_limits (rate_key, window_start desc);

-- Only the service role touches this table (the limiter runs server-side).
-- RLS on with no permissive policy means anon/authenticated clients cannot
-- read or forge rate-limit rows; the service-role key bypasses RLS.
alter table public.workzo_rate_limits enable row level security;

revoke all on public.workzo_rate_limits from anon, authenticated;

-- Housekeeping: old windows are never read again, so they can be pruned.
-- Run periodically (pg_cron) or ignore; rows are tiny.
--   delete from public.workzo_rate_limits where window_start < now() - interval '1 day';
