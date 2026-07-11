Replace these files in your project:

1) app/api/linkedin/analyze/route.ts
2) app/api/linkedin/rewrite/route.ts
3) app/linkedin/page.tsx
4) lib/workzoLinkedInEngine.ts

What changed:
- LinkedIn Optimizer now accepts 1 to 5 target JDs.
- Single JD still works like before.
- Multi-JD corpus mode filters keywords with >=60% support across active target postings.
- Rewrite route uses the corpus but still forbids unsupported CV claims.
- UI has an Add another JD flow and explains single-JD vs multi-JD mode.

After replacing:
- Run npm run build.
- Test with 1 JD and with 3-5 similar JDs.
