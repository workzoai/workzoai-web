-- B2B enquiry leads from the enterprise / education contact forms.
-- Written by /api/leads via service role; read from the Supabase dashboard.
create table if not exists public.b2b_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  organization text not null,
  org_type text,
  cohort_size text,
  message text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists b2b_leads_created_idx on public.b2b_leads (created_at desc);

alter table public.b2b_leads enable row level security;
-- No policies: only the service role (API route) reads/writes.
