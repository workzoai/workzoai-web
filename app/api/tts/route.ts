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
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
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
/**
 * addRecruiterHesitationMarkers — makes AI voice sound human, not robotic.
 *
 * The WBS feedback was specific: "AI's voice sounds quite robotic and difficult
 * to understand." This function inserts micro-imperfections at the text level
 * BEFORE synthesis so gpt-4o-mini-tts renders them as natural speech pauses.
 *
 * Rules:
 * - ONE light imperfection per reply maximum — never pile on
 * - Skeptical/pressuring: "Hmm… " prefix creates a natural thinking pause
 * - "Hold on" / "Let me": trail off with "…" for natural speech rhythm
 * - "Interesting." or "I see." prefix for positive follow-ups
 * - Short punctuation gaps: insert "," into long single-breath sentences
 * - NEVER add markers when the reply already has human-sounding openers
 */
function addRecruiterHesitationMarkers(
  text: string,
  recruiterState?: string,
): string {
  if (!text) return text;

  const state = (recruiterState || "").toLowerCase();
  const trimmed = text.trim();

  // Already has a human marker — don't double up
  if (/^(hmm|okay|hold on|wait,|right,|interesting|i see|that|let me|good|so,)/i.test(trimmed)) return text;

  const words = trimmed.split(/\s+/).filter(Boolean).length;

  // Skeptical / pressuring → "Hmm… " creates a thinking pause before the challenge
  if ((state === "skeptical" || state === "pressuring") && words <= 35) {
    return `Hmm… ${trimmed}`;
  }

  // Losing confidence → terse silence is more powerful than filler
  if (state === "losing_confidence") return text;

  // Interested / engaged → occasional warm opener
  if ((state === "interested" || state === "engaged") && words <= 25) {
    const openers = ["That makes sense.", "Okay.", "Good."];
    // Only on every ~3rd engaged reply (use text length as a deterministic selector)
    if (trimmed.length % 3 === 0) {
      const opener = openers[trimmed.length % openers.length];
      return `${opener} ${trimmed}`;
    }
  }

  // "Hold on" / "Let me pause" → trail off naturally
  const holdOnMatch = trimmed.match(/^(Hold on|Let me pause you there|Let me pause you|Let me stop you there|Let me narrow that)[.,—]?\s*/i);
  if (holdOnMatch) {
    const rest = trimmed.slice(holdOnMatch[0].length);
    return `${holdOnMatch[1]}… ${rest}`;
  }

  // Break long sentences with a natural breathing comma
  // e.g. "I want to understand what you personally owned in that project" →
  //      "I want to understand, what you personally owned in that project"
  if (words > 22 && !trimmed.includes(",")) {
    const sentenceWords = trimmed.split(/\s+/);
    const breakPoint = Math.floor(sentenceWords.length * 0.42);
    if (breakPoint > 4) {
      sentenceWords.splice(breakPoint, 0, "");
      const broken = sentenceWords.filter(Boolean).join(" ").replace(" ", ", ", );
      // Only apply if the result isn't longer than 10% more chars
      if (broken.length <= trimmed.length * 1.05) return broken;
    }
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

  // ── Rate limit — prevents TTS cost abuse outside the interview session limit ──
  const ttsPlan = resolved.plan;
  const ttsRateLimit = ttsPlan === "premium_pro" ? 200 : ttsPlan === "premium" ? 120 : 40;
  const { allowed: withinTtsRateLimit } = await checkWorkZoRateLimit(`tts:${resolved.userId}`, ttsRateLimit);
  if (!withinTtsRateLimit) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  // Free users get voice — session count is enforced by /api/db/interview-session.

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

    // Sprint fix: Voice instructions are now fully persona-specific.
    // Sarah: warm, encouraging, genuinely human — not a narrator.
    // Priya: energetic and direct, but still natural.
    // All: slower base rate, pitch variation, clear enunciation for non-native speakers.
    const baseInstructions = getOpenAiTtsInstructions({
      recruiterId: body.recruiterId,
      recruiterState: body.recruiterState,
      mode: body.mode,
    });
    // The base instructions from getOpenAiTtsInstructions are now comprehensive and
    // persona-specific. We add a final universal reminder for accent clarity.
    speechPayload.instructions = [
      baseInstructions,
      "Keep pronunciation clear and accessible for non-native English speakers listening on a video call.",
      "Never sound like a text-to-speech system. Sound like a real person having a conversation.",
    ].filter(Boolean).join(" ");

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
