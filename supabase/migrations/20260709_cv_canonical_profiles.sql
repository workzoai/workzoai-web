-- WorkZo CV Engine V3 canonical profile table
-- Optional production migration. Client-side replacement files work without it,
-- but this table is the recommended durable source of truth for millions of users.

create table if not exists public.cv_canonical_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid unique not null default gen_random_uuid(),
  full_name text not null,
  target_headline text,
  profile_summary text,
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  layout_style text,
  field_confidence jsonb not null default '{}'::jsonb,
  engine_version text not null default 'cv-engine-v3',
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cv_canonical_profiles_user_id_idx on public.cv_canonical_profiles(user_id);
create index if not exists cv_canonical_profiles_created_at_idx on public.cv_canonical_profiles(created_at desc);

create or replace function public.freeze_canonical_profile_content()
returns trigger as $$
begin
  if old.is_locked = true then
    new.full_name := old.full_name;
    new.target_headline := old.target_headline;
    new.profile_summary := old.profile_summary;
    new.experience := old.experience;
    new.education := old.education;
    new.projects := old.projects;
    new.skills := old.skills;
    new.languages := old.languages;
    new.certifications := old.certifications;
    new.field_confidence := old.field_confidence;
    new.engine_version := old.engine_version;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists lock_cv_profile_immutability on public.cv_canonical_profiles;
create trigger lock_cv_profile_immutability
before update on public.cv_canonical_profiles
for each row execute function public.freeze_canonical_profile_content();
