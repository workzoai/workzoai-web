WorkZo first-turn interview stuck fix

Replace:
1. app/interview/page.tsx
2. app/api/interview/reply/route.ts

What this fixes:
- Browser speech recognition sometimes keeps short answers like "I'm good, how are you?" as interim text, not final text.
- The old code submitted only final text, so the interview stayed active but never moved forward.
- This version falls back to stable interim text and treats first-turn small talk as a valid answer.
- The reply API also has an opening guard so the first answer always moves into the real intro question.

After replacing:
Ctrl + C
Remove-Item -Recurse -Force .next
npm run dev -- -p 3007
