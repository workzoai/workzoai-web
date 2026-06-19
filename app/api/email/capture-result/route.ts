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

function buildEmailHtml(roleLabel: string, overallScore: number): string {
  const threshold = 78;
  const gap = Math.max(0, threshold - overallScore);
  const roleShort = roleLabel || "your target role";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com";

  const days = [
    {
      day: "Day 1",
      title: "Own every answer",
      tip: 'Replace every "we" with "I" in your three strongest stories. If you cannot say "I led", "I built", or "I resolved", the recruiter cannot credit you with the outcome.',
    },
    {
      day: "Day 2",
      title: "Add one number",
      tip: `Pick your strongest story and add one measurable result: time saved, customers helped, tickets resolved, revenue impacted. Even rough numbers — "around 30%" — are better than none. This alone can move your score ${gap > 10 ? "8–12" : "4–8"} points.`,
    },
    {
      day: "Day 3",
      title: "Kill the filler words",
      tip: 'Record yourself answering "Tell me about yourself" and count every "um", "like", "basically", and "you know". Recruiters notice these and score confidence lower. Aim for zero in your opening answer.',
    },
    {
      day: "Day 4",
      title: "Prepare for the hardest follow-up",
      tip: `The follow-up you are least prepared for is the one that drops your trust score. After any story, assume the recruiter will ask: "What was the actual measurable outcome?" Have the answer ready before they ask.`,
    },
    {
      day: "Day 5",
      title: "Run a full session and compare",
      tip: `Do a full WorkZo interview tomorrow. Compare your trust score to today's ${overallScore}/100. If you applied the four days of work, you should see a 6–15 point improvement. The threshold for most ${roleShort} roles is ${threshold}.`,
    },
  ];

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

function buildEmailText(roleLabel: string, overallScore: number): string {
  const threshold = 78;
  const gap = Math.max(0, threshold - overallScore);
  const roleShort = roleLabel || "your target role";

  return `Your WorkZo AI Interview Report — ${roleShort}

Score: ${overallScore}/100 ${gap > 0 ? `(+${gap} pts to reach the threshold of ${threshold})` : "(above threshold — keep going)"}

YOUR 5-DAY IMPROVEMENT PLAN

Day 1 — Own every answer
Replace every "we" with "I" in your three strongest stories. If you cannot say "I led", "I built", or "I resolved", the recruiter cannot credit you with the outcome.

Day 2 — Add one number
Pick your strongest story and add one measurable result: time saved, customers helped, tickets resolved, revenue impacted. Even rough numbers are better than none.

Day 3 — Kill the filler words
Record yourself answering "Tell me about yourself" and count every "um", "like", "basically". Aim for zero in your opening answer.

Day 4 — Prepare for the hardest follow-up
After any story, assume the recruiter will ask: "What was the actual measurable outcome?" Have the answer ready before they ask.

Day 5 — Run a full session and compare
Do a full WorkZo interview. Compare your trust score to today's ${overallScore}/100. You should see a 6–15 point improvement.

---
Upgrade to Premium to unlock all recruiter signals and session memory:
https://workzoai.com/pricing?intent=email-plan&score=${overallScore}

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

  let body: { email?: string; roleLabel?: string; overallScore?: number; source?: string };
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

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
  }

  try {
    const result = await sendWorkZoTransactionalEmail({
      to: email,
      subject: `Your WorkZo report + 5-day plan${roleLabel ? ` — ${roleLabel}` : ""} (score: ${overallScore}/100)`,
      html: buildEmailHtml(roleLabel, overallScore),
      text: buildEmailText(roleLabel, overallScore),
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
