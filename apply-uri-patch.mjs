/**
 * apply-uri-patch.mjs
 *
 * Applies 3 surgical fixes to lib/unifiedRecruiterIntelligence.ts
 *
 * Usage (from repo root):
 *   node apply-uri-patch.mjs
 *
 * What it changes:
 *   1. Replaces brand-specific STT recovery with a generic phonetic layer
 *   2. Raises LLM temperature 0.38 → 0.62 and max_tokens 760 → 1100
 *   3. Promotes critical behavioural rules to the top of the system prompt
 *      so they receive maximum attention from GPT-4o
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const FILE = resolve("lib/unifiedRecruiterIntelligence.ts");

let src = readFileSync(FILE, "utf8");
let changed = 0;

// ─── PATCH 1: Generic STT recovery ──────────────────────────────────────────
const OLD_STT = `function recoverNoisySpokenTranscript(textRaw: string) {
  let text = cleanText(textRaw);
  if (!text) return text;

  const lower = text.toLowerCase();
  const hasRouterContext = /\\b(router|routers|wi[-\\s]?fi|wifi|internet|firmware|affirmware|ip address|computer|connect|technical|device|network)\\b/i.test(lower);
  const hasCustomerContext = /\\b(customer|client|user|consumer|b2b|b2c|old|older|scared|non[-\\s]?technical|no experience)\\b/i.test(lower);

  // Common browser/STT corruptions for the user's Linksys/Belkin router examples.
  if (hasRouterContext || hasCustomerContext) {
    text = text
      .replace(/\\blinkedin fraud\\b/gi, "Linksys router")
      .replace(/\\blinked in fraud\\b/gi, "Linksys router")
      .replace(/\\blengths and links are\\b/gi, "Linksys")
      .replace(/\\blinks are\\b/gi, "Linksys")
      .replace(/\\blink says\\b/gi, "Linksys")
      .replace(/\\blinksys products?\\b/gi, "Linksys products")
      .replace(/\\blang balcon\\b/gi, "Belkin")
      .replace(/\\blang belcon\\b/gi, "Belkin")
      .replace(/\\bbalcon\\b/gi, "Belkin")
      .replace(/\\bbelcan\\b/gi, "Belkin")
      .replace(/\\baffirmware\\b/gi, "firmware")
      .replace(/\\ba firmware\\b/gi, "firmware")
      .replace(/\\bwrap with (her|him|them|the customer)\\b/gi, "rapport with $1")
      .replace(/\\bgood wrap\\b/gi, "good rapport")
      .replace(/\\bbuild a wrap\\b/gi, "build rapport")
      .replace(/\\bp2b\\b/gi, "B2B")
      .replace(/\\bb two b\\b/gi, "B2B")
      .replace(/\\bb to b\\b/gi, "B2B")
      .replace(/\\bb2 c\\b/gi, "B2C")
      .replace(/\\bb two c\\b/gi, "B2C")
      .replace(/\\bb to c\\b/gi, "B2C");
  }

  const recoveredLower = text.toLowerCase();
  const nowHasRouterExample = /\\b(linksys|belkin|router|firmware|ip address|wi[-\\s]?fi|wifi)\\b/i.test(recoveredLower);
  const hasHumanSupportStory = /\\b(old|older|scared|non[-\\s]?technical|no experience|step[-\\s]?by[-\\s]?step|guided|explained|satisfied|happy|resolved|fixed)\\b/i.test(recoveredLower);

  if (nowHasRouterExample && hasHumanSupportStory && !/\\bconcrete customer-support example\\b/i.test(recoveredLower)) {
    text += " Concrete customer-support example: non-technical customer, router/Wi-Fi issue, firmware or IP-address check, step-by-step guidance, issue resolved or customer satisfied.";
  }

  return cleanText(text);
}`;

const NEW_STT = `function recoverNoisySpokenTranscript(textRaw: string) {
  let text = cleanText(textRaw);
  if (!text) return text;

  // Generic phonetic STT corrections that apply to any candidate.
  // DO NOT add product/brand-specific substitutions here — those silently corrupt
  // answers from candidates who were not talking about that product.
  text = text
    // B2B / B2C spoken variants ("b two b", "b to b", "p2b", "b2 c", etc.)
    .replace(/\\bp2b\\b/gi, "B2B")
    .replace(/\\bb\\s*two\\s*b\\b/gi, "B2B")
    .replace(/\\bb\\s*to\\s*b\\b/gi, "B2B")
    .replace(/\\bb2\\s*c\\b/gi, "B2C")
    .replace(/\\bb\\s*two\\s*c\\b/gi, "B2C")
    .replace(/\\bb\\s*to\\s*c\\b/gi, "B2C")
    // "affirmware" / "a firmware" → firmware (common voice transcription error)
    .replace(/\\baffirmware\\b/gi, "firmware")
    .replace(/\\ba firmware\\b/gi, "firmware")
    // "wrap" → "rapport" (phonetic confusion, language-agnostic)
    .replace(/\\bwrap with\\b/gi, "rapport with")
    .replace(/\\bgood wrap\\b/gi, "good rapport")
    .replace(/\\bbuild a wrap\\b/gi, "build rapport")
    .replace(/\\brapple\\b/gi, "rapport");

  return cleanText(text);
}`;

if (src.includes(OLD_STT)) {
  src = src.replace(OLD_STT, NEW_STT);
  changed++;
  console.log("✅ Patch 1 applied: generic STT recovery");
} else {
  console.warn("⚠️  Patch 1 SKIPPED — source text not found (already patched or file differs)");
}

// ─── PATCH 2: temperature + max_tokens ──────────────────────────────────────
const OLD_MODEL = `      model: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o",
      temperature: 0.38,
      max_tokens: 760,`;

const NEW_MODEL = `      model: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o",
      // Raised from 0.38 → 0.62 for more natural, human-sounding variation.
      // 0.38 produces clockwork-precise phrasing; real recruiters don't speak that way.
      temperature: 0.62,
      // Raised from 760 → 1100 so spokenReply can be 2-4 full sentences while the
      // structured JSON fields (psychology, pressure, memoryEvents, etc.) still fit.
      max_tokens: 1100,`;

if (src.includes(OLD_MODEL)) {
  src = src.replace(OLD_MODEL, NEW_MODEL);
  changed++;
  console.log("✅ Patch 2 applied: temperature 0.62 + max_tokens 1100");
} else {
  console.warn("⚠️  Patch 2 SKIPPED — source text not found (already patched or file differs)");
}

// ─── PATCH 3: Promote critical rules to top of system prompt ────────────────
//
// GPT-4o follows rules early in the prompt more reliably than rules buried
// after 150 lines of context. We insert a CRITICAL RULES block immediately
// after the context variables block and before NATURAL INTERVIEW FLOW.
//
const OLD_PROMPT_ANCHOR = `Recent transcript:
\${recentTranscript || "No prior transcript."}

NATURAL INTERVIEW FLOW:`;

const NEW_PROMPT_ANCHOR = `Recent transcript:
\${recentTranscript || "No prior transcript."}

CRITICAL RULES — READ THESE FIRST, THEY OVERRIDE EVERYTHING BELOW:
1. ONLY advance to the next question if the candidate actually answered the active interview question with substantive content. Small talk, greetings, audio checks ("can you hear me"), clarifications, and candidate questions about the process must NOT count as answers and must NEVER trigger impact demands or pressure follow-ups.
2. NEVER repeat the same follow-up twice. If you asked for impact and received ANY qualitative outcome (customer satisfaction, trust, fewer complaints, repeat customers, positive feedback, resolved faster), accept it and move forward.
3. Ask ONE question per turn. Replies must be 1–3 natural spoken sentences — not a paragraph.
4. When the candidate gives a weak answer, do NOT restate the same demand in different words. Either accept partially and probe one specific detail, or move forward.
5. If the candidate recovers after a low-trust moment, soften your tone immediately. Do not carry pressure forward as if nothing changed.
6. NEVER say: "answer too generic", "answer too short", "STAR format", "I noticed this pattern earlier", or "as an AI". These break immersion.

NATURAL INTERVIEW FLOW:`;

if (src.includes(OLD_PROMPT_ANCHOR)) {
  src = src.replace(OLD_PROMPT_ANCHOR, NEW_PROMPT_ANCHOR);
  changed++;
  console.log("✅ Patch 3 applied: critical rules promoted to top of system prompt");
} else {
  console.warn("⚠️  Patch 3 SKIPPED — source text not found (already patched or file differs)");
}

// ─── Write output ────────────────────────────────────────────────────────────
if (changed > 0) {
  writeFileSync(FILE, src, "utf8");
  console.log(`\n✅ Done — ${changed}/3 patches applied to ${FILE}`);
} else {
  console.log("\n⚠️  No changes written — check warnings above.");
}
