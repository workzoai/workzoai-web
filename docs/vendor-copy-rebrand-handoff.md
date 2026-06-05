# Vendor copy rebrand

This patch changes user-facing copy only.

Replaced vendor-facing words like Tavus/Vapi with:
- AI video recruiter
- AI voice interview
- face-to-face AI recruiter interview

Internal function names and implementation files are intentionally unchanged to avoid breaking the build.

Patched files:
- app/api/tavus/conversation/route.ts
- app/components/cvi/hooks/cvi-events-hooks.tsx
- app/components/cvi/lib/tavus-client.ts
- app/demo/page.tsx
- app/interview/page.tsx
- app/pricing/page.tsx
- app/vapi-test/page.tsx
- components/interview/TavusRecruiterPanel.tsx
- components/premium/UpgradeModal.tsx
- lib/interviewMode.ts
- lib/liveRecruiterIntelligenceEngine.ts
- lib/recruiterVoiceConfig.ts
- lib/tavusEmotionMapper.ts
- lib/tavusSyncEngine.ts
- lib/testRecruiterRuntime.ts
- lib/workzoPlanLimits.ts
- lib/workzoUsageTracker.ts
- lib/workzoVapiVoice.ts
- lib/workzoVoiceReliability.ts

If any vendor names still appear, they should be inside internal implementation identifiers only.
