import OpenAI from "openai";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeLanguage(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw.includes("german") || raw.startsWith("de")) return "de";
  if (raw.includes("english") || raw.startsWith("en")) return "en";
  return undefined;
}

export async function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(request: Request) {
  // ── Auth + plan gate ────────────────────────────────────────────────────────
  // Transcription is the STT counterpart to /api/tts. Free users use the
  // browser's built-in voice and never call this route, so it is gated the
  // same way as TTS — preventing anonymous/free use from burning the Whisper
  // transcription budget.
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
      return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return Response.json({ error: "Missing audio file" }, { status: 400 });
    }

    if (audio.size < 1000) {
      return Response.json({ error: "Audio too short" }, { status: 400 });
    }

    const language = normalizeLanguage(formData.get("language"));

    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      ...(language ? { language } : {}),
      prompt:
        "This is a job interview answer. Preserve the candidate's meaning. Return only the spoken answer as plain text.",
    });

    const text = (transcription.text || "").replace(/\s+/g, " ").trim();

    return Response.json({ text });
  } catch (error) {
    console.error("WorkZo transcription route failed", error);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }
}
