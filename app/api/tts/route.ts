import OpenAI from "openai";
import { getOpenAiTtsInstructions, humanizeRecruiterSpokenText } from "@/lib/workzoVoiceHumanizer";

export const runtime = "nodejs";

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
  try {
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
    const voice = allowedVoices.has(requestedVoice)
      ? requestedVoice
      : "shimmer";

    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 },
      );
    }

    const speechPayload: any = {
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text.slice(0, 900),
      response_format: "mp3",
    };

    // Newer OpenAI TTS models support instructions. If the configured model does
    // not support it, the catch block retries without instructions.
    speechPayload.instructions = getOpenAiTtsInstructions({
      recruiterId: body.recruiterId,
      recruiterState: body.recruiterState,
      mode: body.mode,
    });

    let speech;
    try {
      speech = await client.audio.speech.create(speechPayload);
    } catch (ttsError) {
      const fallbackPayload = { ...speechPayload };
      delete fallbackPayload.instructions;
      fallbackPayload.model = process.env.OPENAI_TTS_FALLBACK_MODEL || "tts-1-hd";
      speech = await client.audio.speech.create(fallbackPayload);
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
