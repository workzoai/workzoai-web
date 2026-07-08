/*
  WorkZo AI — Vision CV Extractor (primary extraction path)

  Why this exists:
  Flattened PDF text destroys layout — columns get interleaved, spaced-caps
  names lose their word boundaries, sidebars bleed into summaries. No amount of
  downstream regex reconstructs information that was thrown away at extraction.
  This module skips the flattened-text stage entirely: it hands page IMAGES to a
  vision model, which reads the page the way a human recruiter does (columns,
  banners, right-to-left scripts, any template, any language).

  Design:
  - The model is instructed to emit the SAME JSON shape (`AiResumeJson`) your
    text parser already produces, so the output flows through your existing,
    tested coercion (`buildResumeProfileFromAiJson` → identity repair, skills
    filtering, email/phone validation, dedup). One coercion source of truth.
  - We then compute a per-field CONFIDENCE for the three fields that matter most
    (name, experience, skills). If any is low, `needsConfirmation` is true and the
    caller shows a "here's what we read, fix anything" screen BEFORE the interview.
    That gate — not a mythical 100% model — is what guarantees an interview never
    runs on wrong data.
  - The email handle is used as a deterministic name oracle: it both validates the
    model's name and, in the rare case the model returns a mashed single token,
    re-segments it (HARITHAVIJAYAKUMAR + haritha.vijayakumar@ → "Haritha Vijayakumar").

  This module is transport-agnostic about how images are produced. See
  workzoCvRasterize.ts for the PDF→PNG step, or pass a PDF directly to a
  document-capable model via `pdfDataUrl`.
*/

import { buildResumeProfileFromAiJson, type AiResumeJson } from "@/lib/workzoAiCvParser";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export type VisionCvSource =
  | "vision_structured_cv"
  | "vision_empty_response"
  | "vision_invalid_json"
  | "vision_error"
  | "vision_disabled_no_api_key";

export type FieldConfidence = {
  name: number; // 0..1
  experience: number; // 0..1
  skills: number; // 0..1
  overall: number; // 0..1
};

export type VisionCvResult = {
  ok: boolean;
  source: VisionCvSource;
  resumeProfile: ResumeProfile;
  confidence: FieldConfidence;
  needsConfirmation: boolean;
  confirmationReasons: string[];
  error: string;
};

export type VisionCvInput = {
  /** Page images as data URLs (data:image/png;base64,...). Preferred, universal. */
  pageImages?: string[];
  /** Alternatively, a PDF data URL for models that accept documents natively. */
  pdfDataUrl?: string;
  fileName?: string;
  /** Email pulled from the upload form or a cheap text pre-scan. Used as the
   *  name oracle. Optional but strongly recommended. */
  email?: string;
  /** Overrides for model selection / limits. */
  model?: string;
  maxTokens?: number;
};

// ── Confidence thresholds ──────────────────────────────────────────────────
// Deliberately conservative. We would rather show a 3-second confirm screen than
// silently run an interview on a misread name. Tune from real telemetry.
const NAME_CONFIRM_BELOW = 0.75;
const EXPERIENCE_CONFIRM_BELOW = 0.5;
const SKILLS_CONFIRM_BELOW = 0.5;

// Layout anchors that are never a person's name. Substring match (unanchored),
// multilingual. This mirrors your existing finalizer intent but is only a
// backstop — the vision model rarely returns these.
// Note: stems that can be followed by more letters (competenc→competencies,
// certificat→certifications, zertifi→zertifikate) use \w* instead of a trailing
// \b, which would otherwise fail to match the inflected word.
const NON_NAME_ANCHORS =
  /\b(?:profile|profil|summary|zusammenfassung|about\s*me|über\s*mich|contact|kontakt|kontakt\s*[üu]bersicht|kontaktdaten|contact\s+overview|experience|erfahrung|berufserfahrung|berufliches\s+profil|beruflicher\s+werdegang|berufspraxis|praktische\s+erfahrung|education|ausbildung|bildung|skills|kenntnisse|f[äa]higkeiten|competenc\w*|languages|sprachen|projects|projekte|references|referenzen|certificat\w*|zertifi\w*|curriculum\s*vitae|resume|work\s+history|employment|objective|interests|hobbies|achievements|accomplishments|expertise|qualifikationen|kernkompetenzen|kompetenzen|profil\s*info|profile\s*info)\b/i;

const COMPANY_SCHOOL_ANCHORS =
  /\b(gmbh|ag|ug|kg|ltd|llc|inc|corp|co\b|plc|bv|nv|group|systems|solutions|technologies|software|services|labs|studio|consulting|industries|university|universit[äa]t|college|school|schule|hochschule|institute|academy|akademie)\b/i;

function compact(v: string): string {
  return (v || "").replace(/\s+/g, " ").trim();
}

function tokens(v: string): string[] {
  return compact(v)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Person-name shape check: 1–4 words, each capitalized or all-caps, no anchors. */
export function looksLikePersonName(value: string): boolean {
  const clean = compact(value);
  if (!clean || clean.length < 2 || clean.length > 60) return false;
  if (NON_NAME_ANCHORS.test(clean)) return false;
  if (COMPANY_SCHOOL_ANCHORS.test(clean)) return false;
  if (/[0-9@|/\\]|https?:|www\.|\.[a-z]{2,}(\s|$)/i.test(clean)) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-ZÀ-Ö][A-Za-zÀ-öø-ÿ'’.-]*$/.test(w) || w === w.toUpperCase());
}

/** Handle from an email: "haritha.vijayakumar@x.com" → ["haritha","vijayakumar"]. */
export function emailHandleTokens(email?: string): string[] {
  if (!email || !email.includes("@")) return [];
  const handle = email.split("@")[0].toLowerCase();
  if (/^(your|name|hello|info|contact|admin|test|example|email|mail|user|career|apply|hr|jobs?)$/i.test(handle)) {
    return [];
  }
  return handle
    .replace(/\d+/g, " ")
    .split(/[._\-+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function titleCase(v: string): string {
  return compact(v)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Name oracle. Given the model's name and the email handle:
 *  - If the model returned a mashed single token that the handle can segment,
 *    rebuild the spaced name (handles the spaced-caps failure class).
 *  - Otherwise decide whether the handle CORROBORATES the model's name, robust to
 *    separatorless handles ("harithavijayakumar30") and first.last handles.
 */
export function reconcileNameWithEmail(
  modelName: string,
  email?: string,
): { name: string; matched: boolean } {
  const handleToks = emailHandleTokens(email);
  const handleBlob = handleToks.join(""); // "haritha","vijayakumar" → "harithavijayakumar"
  const nameClean = compact(modelName);
  const nameToks = tokens(nameClean);
  const nameBlob = nameToks.join("");

  // Case A: model returned a single mashed token; segment it using the handle.
  if (
    handleToks.length >= 2 &&
    nameToks.length === 1 &&
    nameToks[0].length >= 8 &&
    nameToks[0] === handleBlob
  ) {
    return { name: titleCase(handleToks.join(" ")), matched: true };
  }

  if (!handleBlob || !nameBlob) return { name: nameClean, matched: false };

  // Case B: strong match — concatenated name equals or is contained in the handle
  // blob (or vice-versa). Handles "harithavijayakumar30" vs "Haritha Vijayakumar".
  if (handleBlob.includes(nameBlob) || nameBlob.includes(handleBlob)) {
    return { name: nameClean, matched: true };
  }

  // Case C: token-level corroboration (first.last handles, partial matches). A name
  // token (>=3 chars) either equals a handle token or appears in the handle blob.
  const handleSet = new Set(handleToks);
  const matched = nameToks.some(
    (t) => t.length >= 3 && (handleSet.has(t) || handleBlob.includes(t)),
  );
  return { name: nameClean, matched };
}

/**
 * When the model returns no name at all, construct a low-confidence candidate from
 * a clearly-separated email handle ("sophia.martinez@…" → "Sophia Martinez"). Only
 * fires when the handle splits into 2–3 alphabetic tokens; a separatorless blob
 * ("sophiamartinez") is left alone because we can't split it without guessing.
 * The result always routes through the confirm screen — it was inferred, not read.
 */
export function deriveNameFromEmail(email?: string): string {
  const toks = emailHandleTokens(email).filter((t) => /^[a-z]{2,}$/.test(t));
  if (toks.length >= 2 && toks.length <= 3) return titleCase(toks.join(" "));
  return "";
}

// ── Confidence scoring for the three fields that matter most ────────────────
export function scoreConfidence(profile: ResumeProfile, email?: string): {
  confidence: FieldConfidence;
  reasons: string[];
} {
  const reasons: string[] = [];
  const name = compact(profile.basics?.name || "");

  // NAME
  let nameScore = 0;
  if (!name) {
    nameScore = 0;
    reasons.push("No candidate name was extracted.");
  } else if (!looksLikePersonName(name)) {
    nameScore = 0.4;
    reasons.push(`Extracted name "${name}" does not look like a person's name.`);
  } else {
    const { matched } = reconcileNameWithEmail(name, email);
    if (matched) {
      nameScore = 0.97; // handle corroborates → very high
    } else if (emailHandleTokens(email).length > 0) {
      nameScore = 0.62; // plausible name but the email actively disagrees
      reasons.push("Extracted name is not corroborated by the email address.");
    } else {
      // Looks like a name, but there is no second signal to confirm it.
      // Below the confirm threshold on purpose: we ask rather than assume.
      nameScore = 0.72;
      reasons.push("No email was available to corroborate the candidate name.");
    }
  }

  // EXPERIENCE
  const expCount = Array.isArray(profile.experience) ? profile.experience.length : 0;
  const expWithTitle = (profile.experience || []).filter((e) => compact(e?.title || "")).length;
  let expScore: number;
  if (expCount === 0) {
    expScore = 0.2;
    reasons.push("No work experience entries were extracted.");
  } else if (expWithTitle === 0) {
    expScore = 0.4;
    reasons.push("Experience entries are missing job titles.");
  } else {
    expScore = Math.min(1, 0.6 + expWithTitle * 0.15);
  }

  // SKILLS
  const skillCount = Array.isArray(profile.skills) ? profile.skills.length : 0;
  let skillScore: number;
  if (skillCount === 0) {
    skillScore = 0.2;
    reasons.push("No skills were extracted.");
  } else if (skillCount < 3) {
    skillScore = 0.55;
  } else {
    skillScore = Math.min(1, 0.7 + skillCount * 0.03);
  }

  const overall = nameScore * 0.5 + expScore * 0.3 + skillScore * 0.2;
  return {
    confidence: {
      name: round2(nameScore),
      experience: round2(expScore),
      skills: round2(skillScore),
      overall: round2(overall),
    },
    reasons,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Escape raw control characters (newlines, tabs, etc.) that a model left
// unescaped INSIDE string values, without touching the whitespace between JSON
// tokens. This is the single most common reason vision JSON fails to parse:
// multi-line CV bullet text with literal newlines inside a "..." value.
function escapeControlCharsInJsonStrings(s: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") { out += ch + (s[i + 1] ?? ""); i++; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += ch === "\n" ? "\\n" : ch === "\t" ? "\\t" : ch === "\r" ? "\\r" : " ";
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

// Recover JSON that the model truncated mid-output (the #1 cause of vision
// fallback on data-rich CVs). Trims any dangling partial token, closes an open
// string, drops a trailing comma, and appends the missing closing brackets in
// the right order. Best-effort: it salvages a valid prefix rather than losing
// the whole extraction to the garbled local parser.
function repairTruncatedJson(s: string): string {
  let out = s;
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let lastComplete = -1; // index just after a closed bracket or string at depth
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') { inStr = false; lastComplete = i; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") { stack.pop(); lastComplete = i; }
  }
  // If we ended mid-string or mid-token, cut back to the last complete value.
  if (inStr && lastComplete >= 0) {
    out = out.slice(0, lastComplete + 1);
    // Recompute the open-bracket stack for the trimmed prefix.
    stack.length = 0;
    let is = false;
    let es = false;
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (is) {
        if (es) es = false;
        else if (ch === "\\") es = true;
        else if (ch === '"') is = false;
        continue;
      }
      if (ch === '"') is = true;
      else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }
  // Drop dangling trailing partials before closing: a lone comma/colon, or a
  // key that was truncated before its value arrived.
  out = out
    .replace(/[:,]\s*$/, "")
    .replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, "")
    .replace(/[:,]\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}

// ── JSON extraction from a possibly-noisy model response ────────────────────
export function parseModelJson(raw: string): AiResumeJson | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip code fences anywhere (in case the model added them despite instructions).
  text = text.replace(/```(?:json)?/gi, "").trim();
  // Grab the outermost JSON object if there's leading/trailing prose.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1) return null;
  // For truncated output there may be no closing brace at all — slice to the end.
  const slice = last > first ? text.slice(first, last + 1) : text.slice(first);

  // Vision models routinely emit JSON that JSON.parse rejects — trailing commas,
  // literal newlines/tabs inside strings, or (most often on long CVs) truncation.
  // Try progressively more forgiving repairs before giving up to the fallback.
  const noTrailingCommas = slice.replace(/,(\s*[}\]])/g, "$1");
  const escaped = escapeControlCharsInJsonStrings(noTrailingCommas);
  const attempts = [
    slice,
    noTrailingCommas,
    escaped,
    repairTruncatedJson(escaped),
    repairTruncatedJson(escapeControlCharsInJsonStrings(text.slice(first))),
  ];
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as AiResumeJson;
    } catch {
      /* try the next, more forgiving, repair */
    }
  }
  return null;
}

// ── The extraction prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a precise CV/résumé extraction engine. You will receive one or more IMAGES that are the pages of a SINGLE candidate's CV. Read them the way a human recruiter would, fully respecting the VISUAL LAYOUT: multiple columns, sidebars, header banners, and boxes. The CV may be in ANY language and ANY template.

Return ONLY a single JSON object. No prose, no markdown, no code fences. Use EXACTLY this schema:
{
  "basics": { "name": "", "headline": "", "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "",
  "experience": [ { "title": "", "company": "", "location": "", "dates": "", "bullets": [] } ],
  "education": [ { "degree": "", "institution": "", "location": "", "dates": "" } ],
  "skills": [],
  "projects": [ { "name": "", "bullets": [] } ],
  "languages": [],
  "certifications": [],
  "strengths": [],
  "additionalEvidence": [],
  "warnings": []
}

Rules:
1. "name" is the human candidate's own name ONLY. It is NEVER a section header (e.g. "Profile", "Berufliches Profil", "Experience", "Core Competencies"), NEVER a company or school, NEVER a job title. If a name is rendered with wide letter spacing (e.g. "H A R I T H A"), read it as a normal name. The name is usually the most prominent text near the top; return it even when it is styled large or in all caps. Only set "name" to an empty string "" if there is genuinely no person's name anywhere on the CV (e.g. a blank template that literally says "Your Name").
2. Keep all content in its ORIGINAL language. Do not translate.
3. Do NOT invent data. If a field is absent from the CV, use an empty string or empty array.
4. "skills" is an array of ATOMIC entries — exactly one tool, technology, or named competency per array element (e.g. "Python", "Tableau", "SLA Management"). NEVER put commas inside a single element, NEVER combine several skills into one string, NEVER output full sentences, and NEVER include the candidate's name. If the CV lists "Python, SQL, Tableau", output three separate elements.
5. "experience" is actual roles the person held. Include every bullet point present for each role.
6. Output MUST be valid JSON and nothing else.`;

type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/**
 * Calls an OpenRouter vision model. Matches the fetch/header conventions in
 * lib/openrouter.ts but supports multimodal content (askOpenRouter is text-only).
 */
async function callVisionModel(input: VisionCvInput): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing.");

  // Cheap, multilingual, vision-capable default. Override via env and VERIFY the
  // current cheapest available vision model + its per-token price on OpenRouter.
  const model =
    input.model || process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.5-flash";

  const parts: OpenRouterContentPart[] = [
    { type: "text", text: "Extract this CV as JSON per the schema. Output JSON only." },
  ];

  if (input.pageImages?.length) {
    for (const url of input.pageImages) {
      parts.push({ type: "image_url", image_url: { url } });
    }
  } else if (input.pdfDataUrl) {
    // Document path for models that accept PDFs directly (e.g. Gemini). Not all
    // models support this via OpenRouter — prefer pageImages for portability.
    parts.push({
      type: "file",
      file: { filename: input.fileName || "cv.pdf", file_data: input.pdfDataUrl },
    });
  } else {
    throw new Error("No pageImages or pdfDataUrl provided to vision extractor.");
  }

  const usingPdf = !input.pageImages?.length && Boolean(input.pdfDataUrl);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://workzoai.com",
      "X-Title": "WorkZo AI",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parts },
      ],
      temperature: 0,
      max_tokens: input.maxTokens ?? 16000,
      response_format: { type: "json_object" },
      // When sending a PDF, tell OpenRouter to let the MODEL read the file
      // natively (i.e. visually, page by page) rather than running a text
      // extractor on it — otherwise we'd silently reintroduce the flattened-text
      // problem this whole approach exists to eliminate. Requires a model with
      // native file support (Gemini has it). Harmless for the image path.
      ...(usingPdf
        ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] }
        : {}),
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`OpenRouter vision failed: ${response.status} ${text}`);

  let data: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("OpenRouter vision returned invalid transport JSON.");
  }
  if (data.error?.message) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Primary entry point. Extracts a CV from page images (or a PDF) via a vision
 * model, coerces through your existing pipeline, and returns a confidence gate.
 */
export async function extractCvWithVision(input: VisionCvInput): Promise<VisionCvResult> {
  const emptyProfile = buildResumeProfileFromAiJson({}, { fileName: input.fileName });

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      ok: false,
      source: "vision_disabled_no_api_key",
      resumeProfile: emptyProfile,
      confidence: { name: 0, experience: 0, skills: 0, overall: 0 },
      needsConfirmation: true,
      confirmationReasons: ["Vision extraction is unavailable (no API key)."],
      error: "OPENROUTER_API_KEY is missing.",
    };
  }

  let rawResponse = "";
  try {
    rawResponse = await callVisionModel(input);
  } catch (err) {
    return {
      ok: false,
      source: "vision_error",
      resumeProfile: emptyProfile,
      confidence: { name: 0, experience: 0, skills: 0, overall: 0 },
      needsConfirmation: true,
      confirmationReasons: ["Vision extraction failed; falling back."],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!rawResponse) {
    return {
      ok: false,
      source: "vision_empty_response",
      resumeProfile: emptyProfile,
      confidence: { name: 0, experience: 0, skills: 0, overall: 0 },
      needsConfirmation: true,
      confirmationReasons: ["Vision model returned an empty response."],
      error: "Empty vision response.",
    };
  }

  let ai = parseModelJson(rawResponse);
  if (!ai) {
    // Intermittent: the model occasionally wraps output in prose or truncates.
    // One retry clears the large majority of these before we fall back.
    try {
      const retry = await callVisionModel(input);
      ai = parseModelJson(retry);
    } catch {
      ai = null;
    }
  }
  if (!ai) {
    return {
      ok: false,
      source: "vision_invalid_json",
      resumeProfile: emptyProfile,
      confidence: { name: 0, experience: 0, skills: 0, overall: 0 },
      needsConfirmation: true,
      confirmationReasons: ["Vision model output could not be parsed as JSON."],
      error: "Invalid model JSON.",
    };
  }

  // Rescue an empty name from a clearly-separated email handle, and reconcile a
  // present name against the handle. Both run BEFORE coercion so the name flows
  // through identity repair rather than fighting it.
  let nameFromEmail = false;
  if (ai.basics && typeof ai.basics === "object") {
    const modelName = typeof ai.basics.name === "string" ? ai.basics.name : "";
    if (!modelName.trim()) {
      const derived = deriveNameFromEmail(input.email);
      if (derived) {
        ai.basics.name = derived;
        nameFromEmail = true;
      }
    } else {
      ai.basics.name = reconcileNameWithEmail(modelName, input.email).name;
    }
    if (!ai.basics.email && input.email) ai.basics.email = input.email;
  }

  const resumeProfile = buildResumeProfileFromAiJson(ai, {
    fileName: input.fileName,
  });

  const { confidence, reasons } = scoreConfidence(resumeProfile, input.email);
  if (nameFromEmail) {
    reasons.push("Candidate name was inferred from the email; please confirm it.");
  }
  const needsConfirmation =
    nameFromEmail ||
    confidence.name < NAME_CONFIRM_BELOW ||
    confidence.experience < EXPERIENCE_CONFIRM_BELOW ||
    confidence.skills < SKILLS_CONFIRM_BELOW;

  return {
    ok: true,
    source: "vision_structured_cv",
    resumeProfile,
    confidence,
    needsConfirmation,
    confirmationReasons: reasons,
    error: "",
  };
}
