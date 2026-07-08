-- Server-persisted career memory for the Premium Pro coach.
--
-- Previously the coach's "brain" lived only in browser localStorage, so it was
-- lost on a new device or a storage clear. This table makes it durable and
-- cross-device, keyed one row per user.
--
-- Access is service-role only: the /api/career-memory route uses the service
-- client and scopes every read/write to the authenticated user_id. RLS is
-- enabled with no permissive policy, so anon/authenticated clients can't read
-- another user's memory directly.

create table if not exists career_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table career_memory enable row level security;
