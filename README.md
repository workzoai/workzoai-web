# WorkZo AI — Real Interview AI Final Stack

Copy these files into your Next.js project:

- app/interview/page.tsx
- app/results/page.tsx
- app/api/interview/route.ts
- lib/recruiterPsychologyEngine.ts
- lib/wowMomentEngine.ts
- lib/realtimeInterviewEngine.ts
- lib/recruiterVoiceConfig.ts

Then run:

npm run build

## Required .env.local

OPENAI_API_KEY=your_openai_key
OPENAI_INTERVIEW_MODEL=gpt-4o-mini

NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID=
NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID=

## What this stack adds

- recruiter psychology engine
- memory callbacks
- wow moment detection
- contradiction detection
- trust gain/loss
- pressure escalation
- interview arc phases
- realtime signal hooks
- emotional UI state payload
- psychological results report
- trust timeline
- recruiter voice profile mapping

## Important

True live mid-speech interruption requires Vapi streaming transcript events and assistant interruption settings. This stack includes the realtime signal API hook and frontend signal display; the actual voice cut-in depends on your Vapi assistant configuration.
