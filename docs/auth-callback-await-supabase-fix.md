# Auth callback await Supabase fix

Fixes:

```txt
Property 'auth' does not exist on type 'Promise<SupabaseClient...>'
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-auth-callback-await-supabase.ps1
npm run build
```
