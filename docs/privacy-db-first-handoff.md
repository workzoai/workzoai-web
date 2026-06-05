# WorkZo privacy + DB-first migration

## What this package fixes

1. Dashboard no longer hardcodes founder name/profile.
2. Resume parser no longer contains founder-specific name normalization.
3. Interview persistence is DB-first.
4. localStorage remains only as emergency recovery/cache.
5. Results page loads DB result first and only falls back to local emergency cache.
6. Dirty legacy localStorage keys containing founder data are automatically removed.
7. Service-role Supabase file is server-only.

## Before running

Install if missing:

```bash
npm install @supabase/supabase-js @supabase/ssr server-only
```

## Supabase

Run:

```txt
supabase/migrations/20260604_workzo_privacy_db_first.sql
```

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Production check

Run:

```bash
npx tsx scripts/check-founder-details.ts
```

Expected result:

```txt
No founder personal details found.
```

## Important

Do not store production source-of-truth in localStorage anymore. Use it only for:
- emergency recovery
- offline fallback
- temporary UI cache
