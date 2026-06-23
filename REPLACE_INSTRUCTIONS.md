# WorkZo Founder Analytics Fix

Replace these files in your project:

- `app/api/analytics/route.ts`
- `app/founder/analytics/FounderAnalyticsClient.tsx`
- `app/founder/analytics/page.tsx`
- `app/founder/page.tsx`
- `app/founder-dashboard/page.tsx`
- `app/layout.tsx`
- `components/WorkZoFounderAnalyticsTracker.tsx`
- `lib/workzoAnalytics.ts`
- `lib/workzoLaunchAnalytics.ts`

Then run the SQL in:

- `supabase/workzo_analytics_tables.sql`

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FOUNDER_ANALYTICS_SECRET=your-private-secret
```

Founder dashboard access:

```txt
/founder/analytics?secret=your-private-secret
```

What this fixes:

- Adds global page-view tracking from the root layout.
- Sends analytics from production and Vercel preview deployments, not only custom domains.
- Adds stable visitor IDs to launch/onboarding events.
- Reads both anonymous analytics events and signed-in usage events.
- Adds dashboard metrics for Visitors, Active 7d, Signed-in users, and Signed-in 30d.
- Allows secure founder dashboard access using `?secret=`.
- Keeps analytics non-blocking, so user flows never fail because analytics fails.

After deployment, test:

1. Open the site in an incognito window.
2. Visit landing page, onboarding, upload CV, start interview.
3. Open `/founder/analytics?secret=your-private-secret`.
4. Confirm Visitors, Sessions, CV uploads, and Interviews increase.
