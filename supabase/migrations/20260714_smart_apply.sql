-- Smart Apply: sessions, generated documents, and the application tracker.
--
-- Access model mirrors career_memory and the rest of WorkZo: RLS is ENABLED with
-- NO permissive policy, so anon/authenticated clients cannot read another user's
-- rows directly. All access goes through server routes that use the service client
-- and scope every query to the authenticated user_id. The service role bypasses
-- RLS, so the tables are reachable by the server and by nobody else.
--
-- Nothing here stores raw third-party job-board responses. We keep the normalized
-- WorkZoJob we already showed the user, and the match we already computed, so a
-- session survives a refresh (spec section 27) without re-hitting a provider.

/* ── Smart Apply sessions ──────────────────────────────────────────────────── */

create table if not exists public.smart_apply_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The normalized job and the computed match, snapshotted at session creation.
  -- Stored as jsonb rather than a foreign key to a jobs table: live jobs expire,
  -- and a user's saved preparation must outlive the posting it was made for.
  job jsonb not null,
  match_result jsonb not null,

  -- Which version of the canonical CV this session was built against, so we can
  -- tell the user "your CV changed since you prepared this" (spec section 27).
  canonical_profile_version text,

  status text not null default 'started',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists smart_apply_sessions_user_idx
  on public.smart_apply_sessions(user_id, updated_at desc);

alter table public.smart_apply_sessions enable row level security;

/* ── Smart Apply documents (tailored CVs, cover letters) ───────────────────── */

create table if not exists public.smart_apply_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.smart_apply_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  document_type text not null check (document_type in ('cv', 'cover_letter')),
  version integer not null default 1,

  payload jsonb not null,
  plain_text text,

  -- The claims the generator REFUSED to write because the CV did not support them.
  -- Persisted, not just shown once: it is the audit trail for the evidence-first
  -- guarantee, and support needs to be able to see it after the fact.
  evidence_warnings jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists smart_apply_documents_session_idx
  on public.smart_apply_documents(session_id, document_type, version desc);

alter table public.smart_apply_documents enable row level security;

/* ── Application tracker ───────────────────────────────────────────────────── */

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  smart_apply_session_id uuid references public.smart_apply_sessions(id) on delete set null,

  job_title text not null,
  company_name text not null,
  location text,
  source text,
  apply_url text,

  -- The stable job fingerprint, carried through from the search pipeline. This is
  -- what the duplicate-application guard keys on. It is nullable because a manually
  -- added application has no fingerprint.
  job_fingerprint text,

  status text not null default 'saved',
  applied_at timestamptz,
  interview_at timestamptz,
  follow_up_at timestamptz,

  match_score integer,
  tailored_cv_id uuid references public.smart_apply_documents(id) on delete set null,
  cover_letter_id uuid references public.smart_apply_documents(id) on delete set null,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One application per job per user. A partial unique index, so it only applies when
-- a fingerprint exists: two manual applications with no fingerprint do not collide,
-- but two applications to the same fingerprinted posting cannot both be inserted.
create unique index if not exists job_applications_user_fingerprint_uniq
  on public.job_applications(user_id, job_fingerprint)
  where job_fingerprint is not null;

create index if not exists job_applications_user_status_idx
  on public.job_applications(user_id, status, updated_at desc);

alter table public.job_applications enable row level security;

/* ── search cache and provider logs (spec section 18) ─────────────────────────
 * Cache stores the NORMALIZED provider result BEFORE CV ranking, so the same job
 * list can be re-ranked per user without re-hitting a provider (spec section 20).
 */

create table if not exists public.job_search_cache (
  cache_key text primary key,
  payload jsonb not null,
  provider_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists job_search_cache_expiry_idx
  on public.job_search_cache(expires_at);

-- Cache is not user-scoped (the same query yields the same jobs for everyone), so
-- it is service-role only with RLS on and no policy.
alter table public.job_search_cache enable row level security;

create table if not exists public.job_provider_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  ok boolean not null,
  error text,
  result_count integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists job_provider_logs_provider_idx
  on public.job_provider_logs(provider, created_at desc);

alter table public.job_provider_logs enable row level security;
