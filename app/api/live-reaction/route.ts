import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { askOpenRouter } from "@/lib/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LLM-graded live recruiter reaction.
//
// The client applies the local heuristic reaction instantly (zero latency),
// then calls this route to UPGRADE the reaction with a real read of the
// answer: a note that quotes the candidate's actual words, and a reaction
// line that references specifics instead of keyword patterns.
//
// Paid plans only, free tier keeps the heuristic path so this adds no LLM
// cost for unpaid traffic. Failures always return { upgraded: false } with
// HTTP 200 so the client silently keeps the heuristic reaction.

const VISUAL_STATES = new Set([
  "listening",
  "thinking",
  "skeptical",
  "interested",
  "interrupting",
  "typing_notes",
  "waiting",
]);

const INTENSITIES = new Set(["soft", "medium", "strong"]);

function clampDelta(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-3, Math.min(3, Math.round(num)));
}

function trimTo(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const account = await resolveWorkZoServerPlan();
    if (account.plan !== "premium" && account.plan !== "premium_pro") {
      return NextResponse.json({ upgraded: false, reason: "plan" });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const answer = trimTo((body as { answer?: unknown }).answer, 4000);
    const targetRole = trimTo((body as { targetRole?: unknown }).targetRole, 120);

    // Too short to grade meaningfully, heuristic reaction is already right.
    if (answer.split(" ").filter(Boolean).length < 6) {
      return NextResponse.json({ upgraded: false, reason: "too_short" });
    }

    const model = process.env.OPENROUTER_LIVE_REACTION_MODEL || "google/gemini-2.5-flash";

    const system = [
      "You are a senior recruiter LISTENING LIVE to a candidate's interview answer. React the way a real attentive recruiter would in the moment.",
      "Return ONLY a JSON object with exactly these keys:",
      '{ "text": string, "visualState": string, "trustDelta": number, "intensity": string, "noteText": string }',
      'visualState must be one of: "listening", "thinking", "skeptical", "interested", "interrupting", "typing_notes", "waiting".',
      "trustDelta is an integer from -3 to 3.",
      'intensity is one of: "soft", "medium", "strong".',
      "RULES:",
      "- text is the recruiter's live reaction, max 18 words, and must reference something SPECIFIC in the answer (a claim, a number, a gap), never generic praise.",
      '- If the answer contains a strong specific claim or metric, use visualState "typing_notes" and set noteText to a short note that QUOTES a verbatim fragment (max 8 words) from the answer in single quotes, e.g. Noting: \'reduced churn by 14%\', verify scope.',
      '- If the answer is vague, ownership is unclear, or a claim sounds unverifiable, use "skeptical" and set noteText to a short note naming exactly what is missing, quoting the vague phrase verbatim where possible.',
      '- Otherwise use "interested" or "thinking" and leave noteText as an empty string.',
      "- Never invent facts the candidate did not say. Quotes must appear verbatim in the answer.",
      "- Judge the SUBSTANCE: a number alone is not strong; a number with clear personal ownership and outcome is.",
    ].join("\n");

    const user = [
      targetRole ? `Target role: ${targetRole}` : "",
      "Candidate's answer:",
      answer,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await askOpenRouter(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model, jsonMode: true, temperature: 0.2, maxTokens: 260 },
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ upgraded: false, reason: "parse" });
    }

    const visualState = VISUAL_STATES.has(String(parsed.visualState)) ? String(parsed.visualState) : "thinking";
    const intensity = INTENSITIES.has(String(parsed.intensity)) ? String(parsed.intensity) : "medium";
    const text = trimTo(parsed.text, 160);
    const noteText = trimTo(parsed.noteText, 180);

    if (!text) {
      return NextResponse.json({ upgraded: false, reason: "empty" });
    }

    return NextResponse.json({
      upgraded: true,
      reaction: {
        text,
        visualState,
        trustDelta: clampDelta(parsed.trustDelta),
        intensity,
        ...(noteText ? { noteText } : {}),
      },
    });
  } catch (error) {
    console.warn("[live-reaction] failed:", error);
    return NextResponse.json({ upgraded: false, reason: "error" });
  }
}
