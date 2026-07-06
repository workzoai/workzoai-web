import OpenAI from "openai";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeLanguage(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value.toLowerCase().trim() : "";
  // Always return a valid ISO 639-1 code, never return undefined (which causes Whisper auto-detect)
  if (raw.includes("german")     || raw.includes("deutsch")    || raw === "de" || raw === "de-de") return "de";
  if (raw.includes("dutch")      || raw.includes("nederlands") || raw === "nl" || raw === "nl-nl") return "nl";
  if (raw.includes("french")     || raw.includes("français")   || raw.includes("francais") || raw === "fr" || raw === "fr-fr") return "fr";
  if (raw.includes("spanish")    || raw.includes("español")    || raw.includes("espanol")  || raw === "es" || raw === "es-es") return "es";
  if (raw.includes("italian")    || raw.includes("italiano")   || raw === "it" || raw === "it-it") return "it";
  if (raw.includes("portuguese") || raw.includes("portugu")    || raw === "pt" || raw === "pt-pt" || raw === "pt-br") return "pt";
  if (raw.includes("hindi")      || raw === "hi" || raw === "hi-in") return "hi";
  if (raw.includes("tamil")      || raw === "ta" || raw === "ta-in") return "ta";
  if (raw.includes("chinese")    || raw.includes("mandarin")   || raw.includes("中文") || raw === "zh" || raw === "zh-cn" || raw === "zh-tw") return "zh";
  if (raw.includes("japanese")   || raw.includes("日本語")     || raw === "ja" || raw === "ja-jp") return "ja";
  if (raw.includes("korean")     || raw.includes("한국어")     || raw === "ko" || raw === "ko-kr") return "ko";
  if (raw.includes("arabic")     || raw.includes("عربية")      || raw === "ar" || raw === "ar-sa") return "ar";
  if (raw.includes("polish")     || raw.includes("polski")     || raw === "pl" || raw === "pl-pl") return "pl";
  if (raw.includes("russian")    || raw.includes("русский")    || raw === "ru" || raw === "ru-ru") return "ru";
  if (raw.includes("turkish")    || raw.includes("türkçe")     || raw === "tr" || raw === "tr-tr") return "tr";
  // Default to English, never leave undefined (which triggers Whisper auto-detect)
  return "en";
}

const ISO_TO_LANGUAGE_NAME: Record<string, string> = {
  de: "German", nl: "Dutch",   fr: "French",     es: "Spanish",    it: "Italian",
  pt: "Portuguese", hi: "Hindi", ta: "Tamil",    zh: "Chinese",    ja: "Japanese",
  ko: "Korean",  ar: "Arabic", pl: "Polish",     ru: "Russian",    tr: "Turkish",
  en: "English",
};

function transcriptionPrompt(language: string): string {
  const languageName = ISO_TO_LANGUAGE_NAME[language] || "the selected interview language";
  const rtlNote = language === "ar" ? " Write right-to-left as appropriate." : "";
  const scriptNote = language === "zh" ? " Use simplified Chinese characters (简体中文)."
    : language === "ja" ? " Use a natural mix of hiragana, katakana, and kanji as appropriate."
    : language === "ko" ? " Use Hangul script."
    : language === "ar" ? " Use Arabic script."
    : language === "ru" ? " Use Cyrillic script."
    : "";
  return (
    `This is a candidate answer in a job interview conducted in ${languageName}.` +
    ` Transcribe exactly what the candidate said in ${languageName}.` +
    ` Do not translate to English under any circumstances.` +
    ` Do not guess missing words, if a word is unclear, omit it.` +
    ` Do not hallucinate words that were not spoken.` +
    ` Preserve proper nouns, company names, and technical terms exactly as spoken.` +
    ` If the candidate code-switched briefly to another language, transcribe those words as-is.` +
    scriptNote + rtlNote +
    ` Return only the spoken answer as plain text, no labels, no timestamps, no explanations.`
  );
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

    // CRITICAL: always pass the declared interview language to Whisper.
    // Never auto-detect. Auto-detection is the primary cause of cross-language
    // STT corruption, Whisper picks the "most likely" language from the audio
    // which may be wrong if the candidate has an accent or speaks briefly.
    // If no language is provided, default to English (not auto).
    const finalLanguage = language || "en";

    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      language: finalLanguage, // Always locked, never auto-detect
      prompt: transcriptionPrompt(finalLanguage),
    });

    const raw = (transcription.text || "").replace(/\s+/g, " ").trim();
    const tooShortOrNoise = raw.length < 2 || /^(um+|uh+|hmm+|noise|silence|inaudible)$/i.test(raw);
    if (tooShortOrNoise) {
      return Response.json({ text: "" });
    }

    // ── Post-transcription corruption check ────────────────────────────────
    // Whisper occasionally returns garbled output even with a locked language,
    // especially for very short or quiet audio. Detect this and return empty
    // so the interview page can ask for clarification instead of passing garbage
    // to the LLM which then produces garbage output.
    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    const validChars = (raw.match(/[a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0B80-\u0BFF\u3040-\u30FF\u4E00-\u9FFF\s0-9.,!?'"-]/g) || []).length;
    const invalidRatio = 1 - validChars / raw.length;

    // Check for impossible consonant clusters (non-words from STT hallucination)
    const words = raw.split(/\s+/).filter(Boolean);
    const longNonWords = words.filter((w: string) => {
      const alpha = w.replace(/[^a-zA-Z\u00C0-\u024F]/g, "");
      if (alpha.length < 8) return false;
      return /[bcdfghjklmnpqrstvwxyz]{4,}/i.test(alpha);
    });
    const isGarbled =
      (invalidRatio > 0.25 && wordCount > 2) ||
      (longNonWords.length >= 2 && longNonWords.length / words.length > 0.35) ||
      /(.)(\1){4,}/i.test(raw);

    if (isGarbled) {
      console.warn("[transcribe] Post-transcription corruption detected. language=" + finalLanguage + " rawPreview=" + raw.slice(0, 80));
      // Return a corruption flag so the interview page can handle it
      return Response.json({ text: "", corrupted: true });
    }

    return Response.json({ text: raw });
  } catch (error) {
    console.error("WorkZo transcription route failed", error);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }
}
