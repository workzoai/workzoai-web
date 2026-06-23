import OpenAI from "openai";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeLanguage(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (raw.includes("german") || raw.includes("deutsch") || raw === "de" || raw === "de-de") return "de";
  if (raw.includes("dutch") || raw.includes("nederlands") || raw === "nl" || raw === "nl-nl") return "nl";
  if (raw.includes("french") || raw.includes("français") || raw.includes("francais") || raw === "fr" || raw === "fr-fr") return "fr";
  if (raw.includes("spanish") || raw.includes("español") || raw.includes("espanol") || raw === "es" || raw === "es-es") return "es";
  if (raw.includes("italian") || raw.includes("italiano") || raw === "it" || raw === "it-it") return "it";
  if (raw.includes("portuguese") || raw.includes("portugu") || raw === "pt" || raw === "pt-pt" || raw === "pt-br") return "pt";
  if (raw.includes("hindi") || raw === "hi" || raw === "hi-in") return "hi";
  if (raw.includes("tamil") || raw === "ta" || raw === "ta-in") return "ta";
  if (raw.includes("english") || raw.startsWith("en")) return "en";
  return undefined;
}

function transcriptionPrompt(language?: string) {
  const languageName = language === "de" ? "German" : language === "nl" ? "Dutch" : language === "fr" ? "French" : language === "es" ? "Spanish" : language === "it" ? "Italian" : language === "pt" ? "Portuguese" : language === "hi" ? "Hindi" : language === "ta" ? "Tamil" : "the selected interview language";
  return `This is a candidate answer in a job interview. The selected interview language is ${languageName}. Transcribe exactly what the candidate said in ${languageName}. Do not translate to English. Do not guess missing words. If a word is unclear, omit it instead of inventing it. Preserve code-switching and proper nouns. Return only the spoken answer as plain text.`;
}

export async function OPTIONS() { return new Response(null, { status: 204 }); }

export async function POST(request: Request) {
  // ── Auth gate ─────────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return Response.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ─────────────────────────────────────────────────────────────────────────

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
      prompt: transcriptionPrompt(language),
    });

    const text = (transcription.text || "").replace(/\s+/g, " ").trim();
    const tooShortOrNoise = text.length < 2 || /^(um+|uh+|hmm+|noise|silence|inaudible)$/i.test(text);
    return Response.json({ text: tooShortOrNoise ? "" : text });
  } catch (error) {
    console.error("WorkZo transcription route failed", error);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }
}
