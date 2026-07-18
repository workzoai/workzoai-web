/**
 * app/api/interview/vapi-llm/chat/completions/route.ts
 *
 * v3 ARCHITECTURE, UNIFIED VOICE BRAIN (Option B)
 *
 * OpenAI-compatible Custom LLM endpoint for Vapi. Vapi is configured with:
 *   model: { provider: "custom-llm", url: "https://<you>/api/interview/vapi-llm", model: "gpt-4o" }
 * and Vapi POSTs OpenAI-format { model, messages, temperature, stream, ... }
 * plus call metadata to <url>/chat/completions on EVERY assistant turn.
 *
 * This route makes the voice path run on the EXACT SAME v3 engine as the text
 * path (lib/interviewEngineV3). Per turn it:
 *   1. Verifies the candidate name payload (never lets "Unknown" through)
 *   2. Loads the single isolated persona (no cross-persona bleed)
 *   3. Rebuilds v3 state from the full transcript (stateless, no store)
 *   4. Assembles ONE system prompt: persona + blueprint(JD-lens) + ledger +
 *      closing directive + hard one-question voice constraint
 *   5. When the engine says the interview is complete, injects a TERMINATION-
 *      ONLY prompt so the model cannot ask a new question and close in the same
 *      breath (the exact bug that motivated this refactor)
 *   6. Calls the same OpenAI model and streams the reply back to Vapi as
 *      OpenAI-format SSE
 *
 * Setup context (CV, JD, role, persona, candidateName) is passed by the client
 * when starting the call, via assistantOverrides.metadata, and arrives here in
 * the request payload. We read it defensively from every location Vapi is known
 * to place metadata across versions.
 */

import OpenAI from "openai";
import { timingSafeEqual } from "node:crypto";
import {
  runInterviewEngineV3FromTranscript,
  type TranscriptTurn,
} from "@/lib/interviewEngineV3";
import { PERSONA_STYLE_CONTRACT } from "@/lib/persona/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Caller authentication ───────────────────────────────────────────────────
// This route is an OpenAI-compatible endpoint that forwards to OUR OpenAI key.
// It was previously unauthenticated, which made it a free GPT-4o gateway for
// anyone who guessed the URL, billed to us.
//
// Vapi sends custom headers configured on the assistant's model block:
//   model: { provider: "custom-llm", url: "...", headers: { "x-workzo-vapi-secret": "<secret>" } }
//
// Set VAPI_CUSTOM_LLM_SECRET in the environment AND in the Vapi assistant
// config. We fail CLOSED: an unset secret rejects every request rather than
// silently reopening the hole.
function authorizeVapiCaller(request: Request): boolean {
  const expected = process.env.VAPI_CUSTOM_LLM_SECRET || "";
  if (!expected) {
    console.error("[vapi-llm] VAPI_CUSTOM_LLM_SECRET is not set, rejecting all calls");
    return false;
  }

  const provided =
    request.headers.get("x-workzo-vapi-secret") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Name safety (server-side, bulletproof) ──────────────────────────────────
// Mirrors the client guard: a plain `|| "there"` does NOT catch the literal
// string "Unknown" (a non-empty string is truthy), which is exactly why the
// name leaked before. This blocklist filters placeholder values explicitly.
const PLACEHOLDER_NAME =
  /^(unknown|candidate|user|public|private|profile|guest|anonymous|there|n\/?a|none|null|undefined|resume|cv|summary|contact)$/i;

function safeCandidateName(raw?: string | null): string {
  const first = (raw || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";
  if (PLACEHOLDER_NAME.test(first)) return "";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'.-]{2,24}$/.test(first)) return "";
  return first;
}

// ── Metadata extraction ─────────────────────────────────────────────────────
type InterviewMeta = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  recruiterPersonality?: string;
  recruiterName?: string;
  candidateName?: string;
  language?: string;
  // Shadow Recruiter Calibration: pinned organization rubric block,
  // passed through Vapi assistantOverrides.metadata at call start.
  organizationRubricPrompt?: string;
};

function extractMeta(body: Record<string, unknown>): InterviewMeta {
  // Vapi places call config in a few spots depending on version and
  // metadataSendMode. Check all of them, first hit wins.
  const call = (body.call || {}) as Record<string, unknown>;
  const assistant = (call.assistant || {}) as Record<string, unknown>;
  const assistantOverrides = (call.assistantOverrides || {}) as Record<string, unknown>;
  const candidates = [
    body.metadata,
    call.metadata,
    assistantOverrides.metadata,
    (assistantOverrides.variableValues as Record<string, unknown>) || undefined,
    assistant.metadata,
  ].filter(Boolean) as Record<string, unknown>[];

  const merged: Record<string, unknown> = {};
  for (const c of candidates) Object.assign(merged, c);
  return merged as InterviewMeta;
}

// Vapi sends OpenAI messages; convert to the engine's transcript shape.
function messagesToTranscript(
  messages: Array<{ role: string; content: unknown }>,
): TranscriptTurn[] {
  const out: TranscriptTurn[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const text = typeof m.content === "string"
      ? m.content
      : Array.isArray(m.content)
        ? m.content.map((p: { text?: string }) => p?.text || "").join(" ")
        : "";
    if (!text.trim()) continue;
    out.push({ role: m.role === "assistant" ? "recruiter" : "candidate", text: text.trim() });
  }
  return out;
}

// ── One system prompt for the turn (single-brain assembly) ──────────────────
function buildVoiceSystemPrompt(args: {
  brainContext: string;
  personaPromptBlock: string;
  targetRole: string;
  candidateName: string;
  language?: string;
  interviewComplete: boolean;
}): string {
  const langLine = args.language && !/^en/i.test(args.language)
    ? `Conduct this entire interview in ${args.language}. Every question, acknowledgement, and closing line must be in ${args.language}.\n`
    : "";

  const nameLine = args.candidateName
    ? `The candidate's first name is ${args.candidateName}. Use it naturally and sparingly.\n`
    : `You do NOT have the candidate's name. Never address them by a name, never say "Unknown", "Candidate", or any placeholder. Just speak naturally without a name.\n`;

  // The hard voice constraint that prompt-level instructions alone failed to
  // enforce before; stated as an absolute, first-person rule.
  const voiceRules =
    "VOICE OUTPUT RULES (ABSOLUTE):\n" +
    "- You are in a real-time voice interview. Output ONLY the words you speak aloud, no JSON, no labels, no stage directions, no markdown.\n" +
    "- Ask EXACTLY ONE question per turn. Never bundle multiple questions. If you need several facts, gather them across turns, one at a time.\n" +
    "- Never ask more than one question mark in one reply. One spoken turn = one candidate task.\n" +
    "- If the candidate says 'next question', 'skip', 'pass', or 'I don't know', do not list several questions. Acknowledge once, choose ONE different angle, and ask exactly one replacement question.\n" +
    "- Stay conversational: react to the answer, ask one follow-up if useful, then move on only when enough evidence exists. Do not run through a checklist.\n" +
    "- Keep each turn short: one brief acknowledgement (optional) plus one question. Do not lecture.\n" +
    "- Never ask a new question and say goodbye in the same turn.\n";

  if (args.interviewComplete) {
    // TERMINATION-ONLY prompt: the model physically cannot ask a new question
    // because it is told to, and given, only the closing task this turn.
    return (
      `${langLine}${nameLine}` +
      "=== INTERVIEW CLOSING, THIS IS YOUR FINAL TURN ===\n" +
      "The interview is complete. Do NOT ask any new question. Deliver a warm, natural closing IN YOUR PERSONA'S VOICE that covers exactly these beats:\n" +
      "1. Signal these were all your questions for today.\n" +
      "2. Thank the candidate for their time and thoughtful answers.\n" +
      "3. Tell them they'll now receive detailed feedback on communication, skills, behaviour, and overall performance.\n" +
      "4. Wish them well and say goodbye.\n" +
      "Speak only the closing. Nothing else.\n\n" +
      `PERSONA VOICE:\n${args.personaPromptBlock}`
    );
  }

  return (
    `${langLine}${nameLine}` +
    `${voiceRules}\n` +
    `You are interviewing the candidate for this role: ${args.targetRole}.\n\n` +
    `${args.personaPromptBlock}\n\n` +
    `${args.brainContext}\n\n` +
    `${PERSONA_STYLE_CONTRACT}`
  );
}

// ── SSE helpers ──────────────────────────────────────────────────────────────
function sseChunk(id: string, model: string, delta: object, finish: string | null): string {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;
}

export async function POST(request: Request) {
  // Reject before we touch the body, and before we spend a single OpenAI token.
  if (!authorizeVapiCaller(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const incomingMessages = (Array.isArray(body.messages) ? body.messages : []) as Array<{
    role: string;
    content: unknown;
  }>;
  const modelName = (body.model as string) || process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o";
  const wantsStream = body.stream !== false; // Vapi sends stream:true

  const meta = extractMeta(body);
  const transcript = messagesToTranscript(incomingMessages);
  const candidateName = safeCandidateName(meta.candidateName);

  // Run the SAME v3 engine as the text path, rebuilt from the transcript.
  const v3 = await runInterviewEngineV3FromTranscript({
    transcript,
    jobDescription: meta.jobDescription || "",
    cvText: meta.cvText || "",
    targetRole: meta.targetRole || "the target role",
    recruiterPersonality: meta.recruiterPersonality,
    recruiterName: meta.recruiterName,
    organizationRubricPrompt: typeof meta.organizationRubricPrompt === "string"
      ? meta.organizationRubricPrompt.slice(0, 1200)
      : null,
  });

  const systemPrompt = buildVoiceSystemPrompt({
    brainContext: v3.brainContext,
    personaPromptBlock: v3.persona.promptBlock,
    targetRole: meta.targetRole || "the target role",
    candidateName,
    language: meta.language,
    interviewComplete: v3.interviewComplete,
  });

  // Rebuild the outgoing message list: our system prompt + the real dialogue
  // (drop Vapi's original system message; ours supersedes it).
  const dialogue = incomingMessages.filter((m) => m.role !== "system");
  const outgoing = [{ role: "system" as const, content: systemPrompt }, ...dialogue];

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const id = `chatcmpl-workzo-${Date.now()}`;

  if (!process.env.OPENAI_API_KEY) {
    // Never hang the call silently if the key is missing, speak a safe line.
    const line = "I'm sorry, I'm having a brief technical issue. Could you repeat your last point?";
    if (!wantsStream) {
      return Response.json({
        id, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: modelName,
        choices: [{ index: 0, message: { role: "assistant", content: line }, finish_reason: "stop" }],
      });
    }
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(sseChunk(id, modelName, { role: "assistant", content: line }, null)));
        c.enqueue(new TextEncoder().encode(sseChunk(id, modelName, {}, "stop")));
        c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        c.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  }

  // Non-streaming path (Vapi accepts both, but streaming is preferred).
  if (!wantsStream) {
    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.6,
      max_tokens: 220,
      messages: outgoing as OpenAI.Chat.ChatCompletionMessageParam[],
    });
    const content = completion.choices[0]?.message?.content || "";
    return Response.json({
      id, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: modelName,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    });
  }

  // Streaming path, call the model with stream:true and re-emit OpenAI SSE.
  const completion = await openai.chat.completions.create({
    model: modelName,
    temperature: 0.6,
    max_tokens: 220,
    stream: true,
    messages: outgoing as OpenAI.Chat.ChatCompletionMessageParam[],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Prime with the role delta (OpenAI convention).
        controller.enqueue(encoder.encode(sseChunk(id, modelName, { role: "assistant" }, null)));
        for await (const part of completion) {
          const token = part.choices?.[0]?.delta?.content || "";
          if (token) controller.enqueue(encoder.encode(sseChunk(id, modelName, { content: token }, null)));
        }
        controller.enqueue(encoder.encode(sseChunk(id, modelName, {}, "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        // Emit a spoken fallback rather than dropping the call.
        controller.enqueue(encoder.encode(sseChunk(id, modelName, { content: "Sorry, could you say that again?" }, null)));
        controller.enqueue(encoder.encode(sseChunk(id, modelName, {}, "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        console.error("[vapi-llm] stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
