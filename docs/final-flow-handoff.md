# WorkZo final flow integrated patch

Implements:
- Landing Start Interview -> Pricing
- Pricing Free -> Onboarding
- Pricing Premium -> Login with next=/onboarding and plan=premium
- Interview back links -> Dashboard
- End Interview -> stops voice/status ended -> Results
- Results page gets Retry Interview + Go To Dashboard CTA
- Dashboard no longer fully blocked for free users
- Dashboard includes upgrade banner and premium tool links point to pricing

Stripe note:
- Replace `/login?next=/onboarding&plan=premium` with the real checkout route after Stripe is connected.
