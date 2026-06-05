# Guest + pricing funnel fix

## Correct flow

Landing
→ Start Free Interview
→ /pricing?intent=interview
→ Continue free or Premium

Free
→ /interview

Premium
→ Stripe checkout later
→ /interview

Login is optional and no longer blocks the funnel.

## Files changed

- app/login/page.tsx
- app/pricing/page.tsx
- app/page.tsx if present
- components/funnel/StartFreeInterviewLink.tsx

## Next Stripe step

Replace `continuePremium()` in app/pricing/page.tsx with your Stripe checkout API call.
