import OpenAI from "openai";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getOpenAiTtsInstructions, humanizeRecruiterSpokenText } from "@/lib/workzoVoiceHumanizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OpenAI TTS is the standard voice engine for Premium and Premium Pro.
// Free users use browser Web Speech API — they never call this route.

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

export async function POST(request: Request) {
  // ── Auth + plan gate ────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return Response.json({ error: "Could not resolve account plan." }, { status: 500 });
  }

  if (!resolved.authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (resolved.plan === "free") {
    return Response.json(
      { error: "upgrade_required", requiredPlan: "premium", message: "AI voice requires an upgrade." },
      { status: 403 },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

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

    const rawText = typeof body.text === "string"
      ? body.text
          .replace(/\s+/g, " ")
          .replace(/\b(um+|uh+|erm)\b/gi, "")
          .trim()
      : "";

    const text = humanizeRecruiterSpokenText(rawText, {
      recruiterId: body.recruiterId,
      recruiterState: body.recruiterState,
      allowFiller: false,
    });

    const requestedVoice =
      typeof body.voice === "string" ? body.voice.trim().toLowerCase() : "";
    const voice = allowedVoices.has(requestedVoice) ? requestedVoice : "shimmer";

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
