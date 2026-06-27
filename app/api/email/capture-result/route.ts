/**
 * app/api/email/capture-result/route.ts
 *
 * Called by the EmailCapture component on the free results page.
 * Sends the user a personalised 5-day improvement plan by email.
 *
 * No auth required — this is a lead capture endpoint for free users
 * who may not be logged in. Rate limited by IP to 3 requests/hour.
 *
 * Env vars needed (already used by other email routes):
 *   RESEND_API_KEY
 *   WORKZO_EMAIL_FROM
 */

import { NextResponse } from "next/server";
import { sendWorkZoTransactionalEmail } from "@/lib/workzoEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-memory rate limit — resets on function cold start.
// For production, replace with Redis or Upstash.
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 3;

  const hits = (recentRequests.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  recentRequests.set(ip, hits);

  return hits.length > maxRequests;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── Session data passed from the results page ─────────────────────────────
type SessionSignals = {
  fillerWordCount: number;       // total filler words detected
  ownershipGap: boolean;         // true if candidate missed ownership on 2+ answers
  metricGap: boolean;            // true if candidate missed metrics on 2+ answers
  structureGap: boolean;         // true if average structure score < 60
  biggestBlocker: string;        // e.g. "Lack of measurable impact evidence"
  worstQuestionIndex: number;    // 1-based index of lowest trust-impact answer
  shortAnswerCount: number;      // answers under 25 words
  answersCount: number;          // total answers captured
};

function buildSessionAwareDays(
  role: string,
  score: number,
  gap: number,
  signals: SessionSignals,
): Array<{ day: string; title: string; tip: string }> {
  const days: Array<{ day: string; title: string; tip: string }> = [];

  // Day 1 — always the most impactful gap first
  if (signals.ownershipGap) {
    days.push({
      day: "Day 1",
      title: "Own every answer",
      tip: `The recruiter couldn't tell what you personally did on ${signals.worstQuestionIndex > 0 ? `Question ${signals.worstQuestionIndex} and others` : "several answers"}. Replace every "we" with "I". If you cannot say "I led", "I built", or "I resolved", the recruiter cannot credit you with the outcome. This is the single fastest trust fix.`,
    });
  } else if (signals.metricGap) {
    days.push({
      day: "Day 1",
      title: "Add one number to every story",
      tip: `You gave strong examples but none included a measurable result. Pick your three best stories and add one number each: time saved, customers helped, tickets resolved, revenue impact, or quality improvement. Even rough numbers — "around 30 customers a week" — close the gap fast.`,
    });
  } else {
    days.push({
      day: "Day 1",
      title: "Sharpen your strongest answer",
      tip: `Your top answer already shows good instincts. Make it even stronger: add a number, name exactly what you personally decided or built, and end with the business result. A rehearsed version of your best answer is the fastest way to raise your score.`,
    });
  }

  // Day 2 — second biggest gap
  if (signals.metricGap && signals.ownershipGap) {
    days.push({
      day: "Day 2",
      title: "Add one number",
      tip: `Pick your strongest story and attach one measurable result: time saved, customers helped, tickets resolved, revenue impacted. Even rough numbers — "around 30%" — are better than none. This alone can move your score ${gap > 10 ? "8–12" : "4–8"} points.`,
    });
  } else if (signals.structureGap) {
    days.push({
      day: "Day 2",
      title: "Use the STAR structure",
      tip: `Several answers wandered before getting to the point. For every story: open with the Situation (one sentence), your Task (what you were responsible for), your Action (what you personally did), and the Result (what changed). Aim for 60–90 seconds per answer.`,
    });
  } else if (signals.shortAnswerCount >= 2) {
    days.push({
      day: "Day 2",
      title: "Expand your shortest answers",
      tip: `${signals.shortAnswerCount} of your answers ended in under 25 words — the recruiter needed more evidence before moving on. For each short answer, add one concrete detail: a customer, a process, a number, or a decision you made. Aim for at least 60–90 seconds per answer.`,
    });
  } else {
    days.push({
      day: "Day 2",
      title: "Add one number",
      tip: `Pick your strongest story and add one measurable result: time saved, customers helped, tickets resolved, revenue impacted. Even rough numbers are better than none. This alone can move your score ${gap > 10 ? "8–12" : "4–8"} points.`,
    });
  }

  // Day 3 — filler words if relevant, otherwise consistency
  if (signals.fillerWordCount >= 5) {
    days.push({
      day: "Day 3",
      title: `Cut the ${signals.fillerWordCount} filler words`,
      tip: `${signals.fillerWordCount} filler words were detected in this session. Record yourself answering "Tell me about yourself" and count every "um", "like", "basically", and "you know". Recruiters score confidence lower when they hear these. Aim for zero in your opening answer — pauses are better than fillers.`,
    });
  } else if (signals.fillerWordCount > 0) {
    days.push({
      day: "Day 3",
      title: "Clean up your delivery",
      tip: `A few filler words were detected (${signals.fillerWordCount} total). They didn't dominate, but removing them signals more confidence. Record your opening answer once and listen back. Replace every "um" and "like" with a short pause — silence reads as composure, not uncertainty.`,
    });
  } else {
    days.push({
      day: "Day 3",
      title: "Prepare for the hardest follow-up",
      tip: `Your delivery was clean. Now prepare for the challenge that drops most candidates: after any story, assume the recruiter will ask "What was the actual measurable outcome?" and "What exactly did you personally own?" Have both answers ready before they ask.`,
    });
  }

  // Day 4 — always the follow-up pressure drill
  days.push({
    day: "Day 4",
    title: "Prepare for the pressure follow-up",
    tip: `The follow-up the recruiter for ${role} would most likely push on: "${signals.biggestBlocker.toLowerCase().includes("metric") ? "Let's be specific — what exactly changed, by how much, and how do you know your work caused it?" : signals.biggestBlocker.toLowerCase().includes("ownership") ? "What exactly did you personally own — not the team, just you?" : "What was the actual measurable outcome of your work there?"}". Practice answering this cold, with a number and a clear personal contribution, in under 90 seconds.`,
  });

  // Day 5 — always compare
  days.push({
    day: "Day 5",
    title: "Run a full session and compare",
    tip: `Do a full WorkZo interview. Compare your trust score to today's ${score}/100. If you applied the four days of work, you should see a 6–15 point improvement. The threshold for most ${role} roles is 78. This time, lead every answer with "I" and end every story with a number.`,
  });

  return days;
}

function buildEmailHtml(roleLabel: string, overallScore: number, signals?: Partial<SessionSignals>): string {
  const threshold = 78;
  const gap = Math.max(0, threshold - overallScore);
  const roleShort = roleLabel || "your target role";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com";

  // Build session-aware signals with safe defaults so the email always sends
  // even if the results page sent no session data (e.g. older code path).
  const resolvedSignals: SessionSignals = {
    fillerWordCount: signals?.fillerWordCount ?? 0,
    ownershipGap: signals?.ownershipGap ?? true,
    metricGap: signals?.metricGap ?? true,
    structureGap: signals?.structureGap ?? false,
    biggestBlocker: signals?.biggestBlocker || "Lack of measurable impact evidence",
    worstQuestionIndex: signals?.worstQuestionIndex ?? 0,
    shortAnswerCount: signals?.shortAnswerCount ?? 0,
    answersCount: signals?.answersCount ?? 0,
  };

  const days = buildSessionAwareDays(roleShort, overallScore, gap, resolvedSignals);

  const dayCards = days
    .map(
      (d) => `
    <div style="margin-bottom:16px;padding:20px;background:#0d1526;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${d.day}</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:900;color:#ffffff;">${d.title}</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#94a3b8;">${d.tip}</p>
    </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your WorkZo 5-Day Improvement Plan</title>
</head>
<body style="margin:0;padding:0;background:#050a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="margin:0;font-size:24px;font-weight:900;color:#ffffff;">WorkZo <span style="color:#60a5fa;">AI</span></p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Your interview improvement plan</p>
    </div>

    <!-- Score card -->
    <div style="background:#0d1a2e;border:1px solid rgba(59,130,246,0.3);border-radius:20px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#93c5fd;">Your session score</p>
      <p style="margin:0;font-size:56px;font-weight:900;color:#ffffff;line-height:1;">${overallScore}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">/100 · ${roleShort}</p>
      ${gap > 0 ? `<p style="margin:12px 0 0;font-size:13px;color:#fbbf24;">You need +${gap} pts to reach the typical interview threshold (${threshold}).</p>` : `<p style="margin:12px 0 0;font-size:13px;color:#34d399;">You are above the typical threshold — keep practising to widen the gap.</p>`}
    </div>

    <!-- Plan -->
    <p style="margin:0 0 16px;font-size:18px;font-weight:900;color:#ffffff;">Your 5-day plan</p>
    ${dayCards}

    <!-- CTA -->
    <div style="text-align:center;margin-top:32px;padding:28px;background:#0d1a2e;border:1px solid rgba(59,130,246,0.25);border-radius:20px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:900;color:#ffffff;">Ready to close the gap faster?</p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#94a3b8;">
        Premium keeps your full session history and coaches you on the exact weakness this session identified.
        The recruiter remembers what you said and adapts — not a generic script.
      </p>
      <a href="${appUrl}/pricing?intent=email-plan&score=${overallScore}"
        style="display:inline-block;background:#3b82f6;color:#ffffff;font-weight:900;font-size:14px;padding:14px 28px;border-radius:14px;text-decoration:none;">
        Unlock Premium — from €19 / month →
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:#4b5563;">Cancel anytime · No hidden fees · Stripe</p>
    </div>

    <!-- Footer -->
    <p style="margin:32px 0 0;text-align:center;font-size:11px;color:#374151;">
      WorkZo AI · You received this because you requested your improvement plan.<br/>
      <a href="${appUrl}/unsubscribe" style="color:#4b5563;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

function buildEmailText(roleLabel: string, overallScore: number, signals?: Partial<SessionSignals>): string {
  const threshold = 78;
  const gap = Math.max(0, threshold - overallScore);
  const roleShort = roleLabel || "your target role";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com";

  const resolvedSignals: SessionSignals = {
    fillerWordCount: signals?.fillerWordCount ?? 0,
    ownershipGap: signals?.ownershipGap ?? true,
    metricGap: signals?.metricGap ?? true,
    structureGap: signals?.structureGap ?? false,
    biggestBlocker: signals?.biggestBlocker || "Lack of measurable impact evidence",
    worstQuestionIndex: signals?.worstQuestionIndex ?? 0,
    shortAnswerCount: signals?.shortAnswerCount ?? 0,
    answersCount: signals?.answersCount ?? 0,
  };

  const days = buildSessionAwareDays(roleShort, overallScore, gap, resolvedSignals);

  const dayText = days.map(d => `${d.day} - ${d.title}\n${d.tip}`).join("\n\n");

  return `Your WorkZo AI Interview Report — ${roleShort}

Score: ${overallScore}/100 ${gap > 0 ? `(+${gap} pts to reach the threshold of ${threshold})` : "(above threshold — keep going)"}

YOUR 5-DAY IMPROVEMENT PLAN

${dayText}

---
Upgrade to Premium to unlock all recruiter signals and session memory:
${appUrl}/pricing?intent=email-plan&score=${overallScore}

WorkZo AI — Cancel anytime
`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    roleLabel?: string;
    overallScore?: number;
    source?: string;
    // Session signals for personalised 5-day plan
    fillerWordCount?: number;
    ownershipGap?: boolean;
    metricGap?: boolean;
    structureGap?: boolean;
    biggestBlocker?: string;
    worstQuestionIndex?: number;
    shortAnswerCount?: number;
    answersCount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const roleLabel = typeof body.roleLabel === "string" ? body.roleLabel.slice(0, 120) : "";
  const overallScore =
    typeof body.overallScore === "number" && Number.isFinite(body.overallScore)
      ? Math.round(Math.max(0, Math.min(100, body.overallScore)))
      : 0;

  // Session signals — optional, fall back to safe defaults in buildEmailHtml/Text
  const signals: Partial<SessionSignals> = {
    fillerWordCount: typeof body.fillerWordCount === "number" ? body.fillerWordCount : undefined,
    ownershipGap: typeof body.ownershipGap === "boolean" ? body.ownershipGap : undefined,
    metricGap: typeof body.metricGap === "boolean" ? body.metricGap : undefined,
    structureGap: typeof body.structureGap === "boolean" ? body.structureGap : undefined,
    biggestBlocker: typeof body.biggestBlocker === "string" ? body.biggestBlocker.slice(0, 200) : undefined,
    worstQuestionIndex: typeof body.worstQuestionIndex === "number" ? body.worstQuestionIndex : undefined,
    shortAnswerCount: typeof body.shortAnswerCount === "number" ? body.shortAnswerCount : undefined,
    answersCount: typeof body.answersCount === "number" ? body.answersCount : undefined,
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
  }

  try {
    const result = await sendWorkZoTransactionalEmail({
      to: email,
      subject: `Your WorkZo report + 5-day plan${roleLabel ? ` — ${roleLabel}` : ""} (score: ${overallScore}/100)`,
      html: buildEmailHtml(roleLabel, overallScore, signals),
      text: buildEmailText(roleLabel, overallScore, signals),
    });

    if (!result.ok && result.skipped) {
      // Email service not configured — don't error the user, just log
      console.warn("[email/capture-result] Email service not configured — skipping send");
      return NextResponse.json({ ok: true, skipped: true });
    }

    return NextResponse.json({ ok: true, id: result.ok ? (result as any).id : null });
  } catch (error) {
    console.error("[email/capture-result] Send failed:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send email. Please try again." },
      { status: 500 },
    );
  }
}
