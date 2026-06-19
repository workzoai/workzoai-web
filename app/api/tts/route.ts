/**
 * app/api/tts/route.ts
 *
 * WHAT CHANGED vs original:
 * - Added `addRecruiterHesitationMarkers()` — inserts natural pauses/filler
 *   BEFORE synthesis so the recruiter sounds human, not robotic.
 *   Applied selectively based on recruiterState:
 *   · Before a challenge/skepticism: "Hmm… " prefix
 *   · Before a recovery/warmth moment: no filler (let warmth come through clean)
 *   · Occasionally mid-sentence: "…" after "Hold on" / "Let me" phrases
 *   This is the single biggest perceptual difference between "AI voice" and
 *   "human interviewer" — controlled imperfection costs nothing and changes
 *   everything about how the audio feels.
 *
 * - humanizeRecruiterSpokenText is still called (existing behaviour preserved).
 * - All other logic (auth, plan gate, voice routing, TTS model fallback) unchanged.
 */

import OpenAI from "openai";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getOpenAiTtsInstructions, humanizeRecruiterSpokenText } from "@/lib/workzoVoiceHumanizer";
import { resolveRecruiterVoiceKey, RECRUITER_VOICE_TABLE } from "@/lib/recruiterVoiceConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const allowedVoices = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);

/**
 * Adds subtle, human-sounding hesitation markers to recruiter speech
 * BEFORE TTS synthesis. The goal is one light imperfection per reply
 * at most — not artificial filler on every sentence.
 *
 * Rules:
 * - skeptical / pressuring state → "Hmm… " prefix (pause, then challenge)
 * - "Hold on" / "Let me pause" → append "…" after the phrase
 * - losing_confidence state → nothing (terse silence is more powerful)
 * - all other states → no markers (clean speech is fine)
 *
 * These markers work with OpenAI's gpt-4o-mini-tts model which interprets
 * "…" as a natural pause beat.
 */
function addRecruiterHesitationMarkers(
  text: string,
  recruiterState?: string,
): string {
  if (!text) return text;

  const state = (recruiterState || "").toLowerCase();

  // Already has a filler or hesitation marker — don't double up
  if (/^(hmm|okay…|hold on|wait,)/i.test(text.trim())) return text;

  // Skeptical / pressuring → brief "Hmm…" pause before the challenge
  if (state === "skeptical" || state === "pressuring") {
    // Only add on shorter replies (the ones that feel abrupt without a beat)
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words <= 30) {
      return `Hmm… ${text}`;
    }
  }

  // "Hold on" or "Let me pause you" → naturally trail off slightly
  const holdOnMatch = text.match(/^(Hold on|Let me pause you there|Let me pause you|Let me stop you there)[.,—]?\s*/i);
  if (holdOnMatch) {
    const rest = text.slice(holdOnMatch[0].length);
    return `${holdOnMatch[1]}… ${rest}`;
  }

  return text;
}

export async function POST(request: Request) {
  // ── Auth + plan gate ──────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return Response.json({ error: "Could not resolve account plan." }, { status: 500 });
  }

  if (!resolved.authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Free users get voice — 2 sessions to feel the full product.
  // Restore gate when ready: uncomment the block below.
  // if (resolved.plan === "free") {
  //   return Response.json({ error: "upgrade_required", requiredPlan: "premium", message: "AI voice requires an upgrade." }, { status: 403 });
  // }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      voice?: string;
      mode?: string;
      recruiterId?: string;
      recruiterState?: string;
    };

    // Strip candidate-side filler (um, uh, erm) from the TEXT before synthesis —
    // this applies to any text being read by the recruiter voice.
    const rawText = typeof body.text === "string"
      ? body.text
          .replace(/\s+/g, " ")
          .replace(/\b(um+|uh+|erm)\b/gi, "")
          .trim()
      : "";

    // Humanise (existing pipeline), then add selective recruiter hesitation markers.
    const humanised = humanizeRecruiterSpokenText(rawText, {
      recruiterId: body.recruiterId,
      recruiterState: body.recruiterState,
      allowFiller: false,
    });

    const text = addRecruiterHesitationMarkers(humanised, body.recruiterState);

    const requestedVoice =
      typeof body.voice === "string" ? body.voice.trim().toLowerCase() : "";
    const defaultVoice = RECRUITER_VOICE_TABLE[resolveRecruiterVoiceKey(body.recruiterId)].openAiVoice;
    const voice = allowedVoices.has(requestedVoice) ? requestedVoice : defaultVoice;

    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const speechPayload: {
      model: string;
      voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
      input: string;
      response_format: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
      instructions?: string;
    } = {
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text.slice(0, 900),
      response_format: "mp3",
    };

    // Newer OpenAI TTS models support instructions. If the configured model
    // does not support it, the catch block retries without instructions.
    speechPayload.instructions = getOpenAiTtsInstructions({
      recruiterId: body.recruiterId,
      recruiterState: body.recruiterState,
      mode: body.mode,
    });

    let speech;
    try {
      speech = await client.audio.speech.create(speechPayload);
    } catch {
      const { instructions: _dropped, ...fallbackPayload } = speechPayload;
      const retryPayload = {
        ...fallbackPayload,
        model: process.env.OPENAI_TTS_FALLBACK_MODEL || "tts-1-hd",
      };
      speech = await client.audio.speech.create(retryPayload);
    }

    const buffer = Buffer.from(await speech.arrayBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("WorkZo TTS route failed", error);
    return Response.json({ error: "TTS failed" }, { status: 500 });
  }
}
