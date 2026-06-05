# WorkZo DB + privacy migration handoff

## Add environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.

## Run migration

Open Supabase SQL editor and run:

```txt
supabase/migrations/20260604_workzo_core_db.sql
```

## Install package if missing

```bash
npm install @supabase/supabase-js
```

## Add cleanup component

In `app/layout.tsx`, add:

```tsx
import LegacyStoragePrivacyCleanup from "@/components/privacy/LegacyStoragePrivacyCleanup";
```

Inside `<body>`:

```tsx
<LegacyStoragePrivacyCleanup />
{children}
```

## Production rule

Do not use localStorage as the source of truth for:

- CV text
- resumeProfile
- interview setup
- transcript
- results
- usage limits
- subscription plan

LocalStorage may only be used as temporary emergency recovery/cache.
