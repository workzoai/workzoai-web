import OpenAI from "openai";

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
    const body = (await request.json()) as { text?: string; voice?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
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

    const speech = await client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || "tts-1",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text.slice(0, 1200),
      response_format: "mp3",
    });

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
