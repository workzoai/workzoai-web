/**
 * apply-uri-patch.mjs
 *
 * Applies 3 fixes to lib/unifiedRecruiterIntelligence.ts
 * Handles both CRLF (Windows) and LF (Unix) line endings.
 *
 * Usage (from repo root):
 *   node apply-uri-patch.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const FILE = resolve("lib/unifiedRecruiterIntelligence.ts");

// Read raw bytes, normalise to LF for matching, then restore original endings on write
let src = readFileSync(FILE, "utf8");
const hasCRLF = src.includes("\r\n");
const normalised = src.replace(/\r\n/g, "\n");
let working = normalised;
let changed = 0;

// ─── PATCH 1: Replace brand-specific STT recovery with generic version ───────
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

  // Generic phonetic STT corrections safe for any candidate.
  // Brand-specific substitutions removed — they corrupt answers from candidates
  // who were not talking about those products.
  text = text
    .replace(/\\bp2b\\b/gi, "B2B")
    .replace(/\\bb\\s*two\\s*b\\b/gi, "B2B")
    .replace(/\\bb\\s*to\\s*b\\b/gi, "B2B")
    .replace(/\\bb2\\s*c\\b/gi, "B2C")
    .replace(/\\bb\\s*two\\s*c\\b/gi, "B2C")
    .replace(/\\bb\\s*to\\s*c\\b/gi, "B2C")
    .replace(/\\baffirmware\\b/gi, "firmware")
    .replace(/\\ba firmware\\b/gi, "firmware")
    .replace(/\\bwrap with\\b/gi, "rapport with")
    .replace(/\\bgood wrap\\b/gi, "good rapport")
    .replace(/\\bbuild a wrap\\b/gi, "build rapport")
    .replace(/\\brapple\\b/gi, "rapport");

  return cleanText(text);
}`;

if (working.includes(OLD_STT)) {
  working = working.replace(OLD_STT, NEW_STT);
  changed++;
  console.log("✅ Patch 1 applied: generic STT recovery");
} else {
  console.warn("⚠️  Patch 1 SKIPPED — text not found (may already be patched)");
}

// ─── PATCH 2: temperature 0.38 → 0.62, max_tokens 760 → 1100 ────────────────
const OLD_MODEL = `      temperature: 0.38,
      max_tokens: 760,`;

const NEW_MODEL = `      temperature: 0.62,
      max_tokens: 1100,`;

if (working.includes(OLD_MODEL)) {
  working = working.replace(OLD_MODEL, NEW_MODEL);
  changed++;
  console.log("✅ Patch 2 applied: temperature 0.62 + max_tokens 1100");
} else {
  console.warn("⚠️  Patch 2 SKIPPED — text not found (may already be patched)");
}

// ─── PATCH 3: Promote critical rules to top of system prompt ─────────────────
const OLD_ANCHOR = `Recent transcript:
\${recentTranscript || "No prior transcript."}

NATURAL INTERVIEW FLOW:`;

const NEW_ANCHOR = `Recent transcript:
\${recentTranscript || "No prior transcript."}

CRITICAL RULES — READ FIRST:
1. Only advance to the next question if the candidate actually answered the active question with substantive content. Greetings, audio checks, clarifications, and candidate questions about the process must NOT count as answers and must NEVER trigger pressure or impact demands.
2. Never repeat the same follow-up twice. If you asked for impact and received any qualitative outcome (satisfaction, trust, fewer complaints, repeat customers), accept it and move forward.
3. Ask ONE question per turn. Replies must be 1–3 natural spoken sentences.
4. If the candidate recovers after a low-trust moment, soften your tone immediately.
5. Never say: "answer too generic", "answer too short", "STAR format", "I noticed this pattern earlier", or "as an AI".

NATURAL INTERVIEW FLOW:`;

if (working.includes(OLD_ANCHOR)) {
  working = working.replace(OLD_ANCHOR, NEW_ANCHOR);
  changed++;
  console.log("✅ Patch 3 applied: critical rules promoted to top of system prompt");
} else {
  console.warn("⚠️  Patch 3 SKIPPED — text not found (may already be patched)");
}

// ─── Write output, restoring original line endings ───────────────────────────
if (changed > 0) {
  const output = hasCRLF ? working.replace(/\n/g, "\r\n") : working;
  writeFileSync(FILE, output, "utf8");
  console.log(`\n✅ Done — ${changed}/3 patches applied to ${FILE}`);
} else {
  console.log("\n⚠️  No changes written — all patches already applied or text not found.");
}
