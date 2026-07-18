/*
 * app/api/extension/scrape-session/route.ts
 *
 * POST  build a Smart Apply session from a job description the extension scraped off
 *       an external page (a company careers site, LinkedIn, anywhere).
 *
 * This is the server half of Tier 2. The extension sends the scraped JD and the user's
 * profile; the server runs the SAME match engine and evidence gate the in-app flow
 * uses, creates a real session, and returns it. From here on the external job is
 * indistinguishable from a WorkZo-sourced one: the tailored CV, cover letter, and fill
 * data all flow through the identical, gated pipeline.
 *
 * The honesty guarantee is preserved precisely because the extension does NOT decide
 * anything. It scrapes text and hands it over. The server, running trusted code,
 * decides what the CV can support. A half-scraped JD produces a weaker match, and the
 * response carries that confidence back so the caller can fall back to identity-only
 * fill rather than generate tailored answers off a shaky JD.
 *
 * Authenticated by the scoped fill token, same as the fill-data route.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyFillToken } from "@/lib/extension/fillToken";
import { rankJob } from "@/lib/jobs/ranking";
import { createJobFingerprint } from "@/lib/jobs/dedupe";
import { createSession } from "@/lib/smart-apply/persistence";
import type { CandidateContext, WorkZoJob } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

type ScrapedJob = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  applyUrl?: string;
  confidence?: "high" | "medium" | "low";
  source?: string;
};

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const verified = verifyFillToken(token);
  if (!verified) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  let body: { scraped?: ScrapedJob; profile?: ResumeProfile };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: corsHeaders() });
  }

  const scraped = body.scraped;
  const profile = body.profile;
  if (!scraped) {
    return NextResponse.json({ ok: false, error: "missing scraped job" }, { status: 400, headers: corsHeaders() });
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: "missing profile" }, { status: 422, headers: corsHeaders() });
  }

  const title = (scraped.title || "").trim();
  const description = (scraped.description || "").trim();

  /*
   * Refuse to build a tailored session off a JD we could not really read. Under ~200
   * chars is a scrape failure, not a job. We tell the caller so it can fall back to
   * identity-only fill (which needs no JD) rather than generate evidence-gated answers
   * from noise. This is the graceful-honesty-degradation the whole tier depends on.
   */
  if (!title || description.length < 200) {
    return NextResponse.json(
      { ok: false, error: "jd_unreadable", message: "Could not read a job description on this page. Identity fields can still be filled." },
      { status: 422, headers: corsHeaders() },
    );
  }

  // Synthesize a WorkZoJob from the scrape. Provider "external" marks its origin.
  const job: WorkZoJob = {
    id: `ext_${Date.now().toString(36)}`,
    provider: "external",
    title,
    company: (scraped.company || "").trim() || "This employer",
    location: (scraped.location || "").trim(),
    description,
    applyUrl: (scraped.applyUrl || "").trim(),
    remoteType: "unknown",
    skills: [],
    fetchedAt: new Date().toISOString(),
    sourceReference: `external:${scraped.source || "unknown"}`,
  };
  job.fingerprint = createJobFingerprint(job) || undefined;

  const candidate: CandidateContext = {
    role: profile.basics?.headline || "",
    skills: profile.skills || [],
    cvText: profile.rawText || "",
    languages: profile.languages || [],
    location: profile.basics?.location || "",
    education: (profile.education || []).map((e) => [e.degree, e.institution].filter(Boolean).join(", ")).filter(Boolean),
  };

  // Same engine, same gate, server-side. The extension never scores anything.
  const match = rankJob(job, candidate, profile);

  const session = await createSession({
    userId: verified.userId,
    job,
    match,
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "could not start session" }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json(
    {
      ok: true,
      sessionId: session.id,
      job: { title: job.title, company: job.company },
      match: { score: match.score, recommendation: match.recommendation, confidence: match.confidence },
      // Echo the scrape confidence so the extension can decide how much to trust the
      // tailored answers, or warn the user.
      scrapeConfidence: scraped.confidence || "low",
    },
    { headers: corsHeaders() },
  );
}
