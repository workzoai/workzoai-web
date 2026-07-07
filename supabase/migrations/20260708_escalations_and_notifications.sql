-- Human-in-the-loop escalations + outbound notification dispatch.
--
-- Scoped by TEXT organization_id (slug / email-domain / org_code) to match
-- marketplace_integrations and marketplace_activity_log, so an escalation and
-- its Slack / Teams / ATS webhook notification share one org identity.
--
-- Admin-only: RLS is enabled with NO permissive policy, so only the service
-- role (used by the /api/admin/* routes) can read or write these tables.

create table if not exists interview_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  candidate_user_id uuid,
  interview_result_id uuid references interview_results(id) on delete set null,
  session_id uuid references interview_sessions(id) on delete set null,
  candidate_name text,
  role text,
  reason text not null default 'flagged_for_review',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'exceptional')),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  wiri integer,
  note text,
  flagged_by text not null default 'system',
  assigned_to text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_escalations_org_status
  on interview_escalations(organization_id, status);
create index if not exists idx_escalations_org_created
  on interview_escalations(organization_id, created_at desc);

-- Audit log of every outbound notification attempt (sent / failed / skipped).
create table if not exists notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  event text not null,
  channel text not null,               -- slack | teams | webhook
  provider text,
  entity_type text,
  entity_id text,
  status text not null default 'sent', -- sent | failed | skipped
  response_code integer,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_dispatches_org_created
  on notification_dispatches(organization_id, created_at desc);

-- Keep updated_at fresh on escalation edits.
create or replace function workzo_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_escalations_updated on interview_escalations;
create trigger trg_escalations_updated
  before update on interview_escalations
  for each row execute function workzo_set_updated_at();

alter table interview_escalations enable row level security;
alter table notification_dispatches enable row level security;
