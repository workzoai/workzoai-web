# WorkZo demo/pricing/free-premium gates

## Funnel

- `/demo`: no login, no CV, no JD, browser TTS voice demo only.
- `/pricing?intent=interview`: choose Free or Premium.
- Free: sets free plan and sends user to `/interview`.
- Premium: currently sets premium preview and sends user to interview; connect Stripe here next.

## Limits

- Free: 2 full Vapi/voice interviews.
- Premium: €14.99/month, 25 interviews/month, Tavus credits, full results/history, career tools.

## Gates

- Results and dashboard show preview for free users.
- Login/Upgrade CTA appears over hidden lower content.
- Reusable `PremiumFeatureGate` can wrap Improve CV, Cover Letter, Jobs, History pages.
