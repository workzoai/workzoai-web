/**
 * lib/conversationLedger.ts
 *
 * v3 ARCHITECTURE — STEP 4 (Dynamic Skill Ceiling), STEP 7 (Conversation
 * Memory), STEP 8 (Red Flag — one probe), STEP 9 (Pivot Rule — max 2
 * follow-ups), STEP 10 (Transition Variety)
 *
 * The ledger is the single deterministic memory consolidating what
 * recruiterMemoryEngine / interviewMemoryEngine / retryWeakAnswerEngine /
 * followupEngine each tracked partially. It persists in the recruiterMemoryV2
 * round-trip blob (under __v3), so no client changes are required.
 *
 * DESIGN NOTES:
 * - Detection here is deterministic and pattern-based across the platform's
 *   major languages (en/de/fr/es/it/pt/nl). It is a BACKSTOP: the same rules
 *   are also stated in the prompt so the LLM enforces them natively in every
 *   language, including ones the patterns don't cover. Either layer alone
 *   catching the signal is sufficient — the ledger persists it forever after.
 * - No candidate-specific content. Skill names are captured from the
 *   candidate's own words, never from a hardcoded list.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type SkillCeiling = {
  skill: string;            // candidate's own wording, normalized
  level: "none" | "basic" | "academic";
  quotedFrom: string;       // short evidence snippet (for results page)
  turn: number;
};

export type RedFlag = {
  id: string;               // slug of the concern
  summary: string;          // one line, engine-generated
  probed: boolean;          // Step 8: exactly one probe
  turn: number;
};

export type ConversationLedger = {
  version: 3;
  turn: number;
  skillCeilings: SkillCeiling[];
  redFlags: RedFlag[];
  establishedFacts: string[];        // deduped, max 30
  /** followupCount per topic slug — Step 9 pivot rule (max 2). */
  followupsByTopic: Record<string, number>;
  activeTopic: string | null;
  /** Last N reply openers — Step 10 anti-repetition. */
  recentOpeners: string[];
};

export function emptyLedger(): ConversationLedger {
  return {
    version: 3,
    turn: 0,
    skillCeilings: [],
    redFlags: [],
    establishedFacts: [],
    followupsByTopic: {},
    activeTopic: null,
    recentOpeners: [],
  };
}

// ── STEP 4 — Skill ceiling detection (multilingual backstop) ────────────────
// Structure: [limitation marker] ... [skill phrase]. The skill is whatever
// the candidate named — captured, not matched against any list.

const LIMITATION_PATTERNS: Array<{ re: RegExp; level: SkillCeiling["level"] }> = [
  // English
  { re: /\b(?:i\s+)?only\s+(?:know|have|used?)\s+(?:some\s+|a\s+bit\s+of\s+)?basic\s+([a-z0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bi(?:'ve| have)?\s+never\s+(?:worked\s+with|used|done)\s+([a-z0-9+#./ -]{2,40})/i, level: "none" },
  { re: /\bonly\s+(?:have\s+)?academic\s+experience(?:\s+(?:with|in)\s+([a-z0-9+#./ -]{2,40}))?/i, level: "academic" },
  { re: /\b(?:my|i have)\s+(?:very\s+)?(?:limited|beginner)\s+(?:knowledge|experience)\s+(?:of|in|with)\s+([a-z0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bi(?:'m| am)\s+(?:a\s+)?beginner\s+(?:at|in|with)\s+([a-z0-9+#./ -]{2,40})/i, level: "basic" },
  // German
  { re: /\b(?:ich\s+)?(?:kenne|habe)\s+nur\s+(?:grundlegende[sn]?|grundkenntnisse\s+in)\s+([a-zäöüß0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bich\s+habe\s+(?:noch\s+)?nie\s+mit\s+([a-zäöüß0-9+#./ -]{2,40})\s+gearbeitet/i, level: "none" },
  { re: /\bnur\s+akademische\s+erfahrung(?:\s+mit\s+([a-zäöüß0-9+#./ -]{2,40}))?/i, level: "academic" },
  // French
  { re: /\bje\s+(?:ne\s+)?connais\s+que\s+les?\s+bases?\s+(?:de|du|d')\s*([a-zà-ÿ0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bje\s+n'ai\s+jamais\s+(?:travaillé\s+avec|utilisé)\s+([a-zà-ÿ0-9+#./ -]{2,40})/i, level: "none" },
  // Spanish
  { re: /\bsolo\s+(?:sé|conozco|tengo)\s+(?:lo\s+)?básico\s+(?:de|en)\s+([a-zá-ú0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bnunca\s+he\s+(?:trabajado\s+con|usado)\s+([a-zá-ú0-9+#./ -]{2,40})/i, level: "none" },
  // Italian
  { re: /\bconosco\s+solo\s+le\s+basi\s+di\s+([a-zà-ù0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bnon\s+ho\s+mai\s+(?:lavorato\s+con|usato)\s+([a-zà-ù0-9+#./ -]{2,40})/i, level: "none" },
  // Portuguese
  { re: /\bsó\s+(?:sei|conheço)\s+o\s+básico\s+de\s+([a-zá-ú0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bnunca\s+trabalhei\s+com\s+([a-zá-ú0-9+#./ -]{2,40})/i, level: "none" },
  // Dutch
  { re: /\bik\s+ken\s+alleen\s+de\s+basis\s+van\s+([a-z0-9+#./ -]{2,40})/i, level: "basic" },
  { re: /\bik\s+heb\s+nog\s+nooit\s+met\s+([a-z0-9+#./ -]{2,40})\s+gewerkt/i, level: "none" },
];

// Function words that mark the end of the skill phrase in a captured clause
// ("basic SQL from my analytics course" → "sql"). Covers the same languages
// as the limitation patterns above.
const SKILL_TRIM_STOPWORDS = new Set([
  "from", "for", "at", "during", "in", "on", "because", "since", "while", "when", "and", "but", "so", "my", "our", "the",
  "aus", "von", "für", "bei", "während", "weil", "und", "aber", "meine", "meinem", "meiner",
  "de", "du", "des", "pour", "pendant", "et", "mais", "mon", "ma", "mes",
  "por", "para", "durante", "y", "pero", "mi", "mis",
  "per", "e", "ma", "mio", "mia",
  "voor", "tijdens", "en", "maar", "mijn",
]);

function normalizeSkill(raw: string): string {
  const tokens = raw.trim().replace(/[.,;:!?]+$/, "").replace(/\s+/g, " ").toLowerCase().split(" ");
  const kept: string[] = [];
  for (const t of tokens) {
    if (SKILL_TRIM_STOPWORDS.has(t)) break;
    kept.push(t);
    if (kept.length >= 4) break;
  }
  return kept.join(" ").slice(0, 40);
}

export function detectSkillCeilings(answer: string, turn: number): SkillCeiling[] {
  const found: SkillCeiling[] = [];
  for (const { re, level } of LIMITATION_PATTERNS) {
    const m = answer.match(re);
    if (m) {
      const skill = normalizeSkill(m[1] || "the stated area");
      if (skill.length >= 2) {
        found.push({
          skill,
          level,
          quotedFrom: answer.slice(Math.max(0, (m.index || 0) - 5), (m.index || 0) + m[0].length + 5).trim().slice(0, 120),
          turn,
        });
      }
    }
  }
  return found;
}

// ── STEP 8 — Red flag detection (deterministic backstop) ────────────────────
// Pattern classes, not phrase lists: blame-shifting, ownership avoidance,
// ethics. The prompt layer handles the same classes in all languages.

const RED_FLAG_PATTERNS: Array<{ id: string; re: RegExp; summary: string }> = [
  {
    id: "blames_customer",
    re: /\b(?:tell|told|it'?s|it\s+is|say)\s+(?:the\s+)?(?:customer|client|user)s?\b[^.]{0,40}\b(?:fault|blame|problem|wrong)\b/i,
    summary: "Candidate placed blame on the customer/client",
  },
  {
    id: "avoids_ownership",
    re: /\b(?:not\s+my\s+(?:job|problem|responsibility)|nothing\s+i\s+could\s+do|wasn'?t\s+my\s+fault)\b/i,
    summary: "Candidate avoided personal ownership",
  },
  {
    id: "ethics_concern",
    re: /\b(?:hide|hid|cover(?:ed)?\s+up|didn'?t\s+tell\s+(?:anyone|them|my\s+manager)|faked?|falsif)/i,
    summary: "Possible transparency/ethics concern",
  },
  {
    id: "team_negativity",
    re: /\b(?:my\s+(?:team|colleagues?)\s+(?:was|were)\s+(?:useless|incompetent|stupid|lazy))\b/i,
    summary: "Strong negativity toward former team",
  },
];

export function detectRedFlags(answer: string, turn: number): RedFlag[] {
  const flags: RedFlag[] = [];
  for (const { id, re, summary } of RED_FLAG_PATTERNS) {
    if (re.test(answer)) flags.push({ id, summary, probed: false, turn });
  }
  return flags;
}

// ── STEP 10 — Transition variety ─────────────────────────────────────────────
// The pool is prompt GUIDANCE (the LLM renders transitions natively in the
// interview language). The deterministic part is the recent-opener tracker:
// the engine extracts each reply's opening words and bans reuse.

export const TRANSITION_POOL: string[] = [
  "That makes sense.", "Thanks for explaining.", "Interesting.", "I appreciate the detail.",
  "Fair enough.", "Good context.", "Right.", "Okay, that helps.", "I can see that.",
  "That's a useful example.", "Clear.", "Got it.", "That answers it.", "Helpful.",
  "I follow.", "Makes sense to me.", "Alright.", "That's fair.", "Understood — thanks.",
  "Appreciate that.", "Nice example.", "That paints a picture.", "Good — thanks.",
  "Let's explore another area.", "I'd like to understand something else.",
  "Changing topics slightly...", "Let's switch gears.", "Moving to a different area...",
  "On a related note...", "Let me take this somewhere else.", "Building on that...",
  "Something you said earlier caught my attention.", "Let's zoom out for a moment.",
  "Let's get more specific.", "Coming back to the role itself...", "One more angle on this...",
  "Before we move on —", "While we're on this...", "Taking a step back...",
  "Now, thinking about the day-to-day...", "Shifting focus a little...",
  "Let me ask about a different situation.", "Here's a different kind of question.",
  "I want to look at another side of this.", "Turning to your experience with people...",
  "Let's talk through a scenario.", "Picture this situation for me.",
  "You mentioned something earlier I want to revisit.", "Connecting this to the role...",
  "That leads me somewhere.", "Which brings me to my next question.",
];

const OPENER_MEMORY = 6;

export function extractOpener(reply: string): string {
  return (reply || "").trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase().replace(/[^a-zà-ÿ0-9 ]/g, "");
}

// ── Ledger update (called once per candidate turn) ──────────────────────────

export function updateLedger(
  ledger: ConversationLedger,
  input: {
    candidateAnswer: string;
    lastRecruiterReply?: string;    // previous turn's reply, for opener tracking
    currentTopicId?: string | null; // blueprint competency in play
    wasFollowup?: boolean;          // engine-classified: same topic as last turn
  },
): ConversationLedger {
  const turn = ledger.turn + 1;
  const next: ConversationLedger = {
    ...ledger,
    turn,
    skillCeilings: [...ledger.skillCeilings],
    redFlags: [...ledger.redFlags],
    establishedFacts: [...ledger.establishedFacts],
    followupsByTopic: { ...ledger.followupsByTopic },
    recentOpeners: [...ledger.recentOpeners],
  };

  // Skill ceilings — first admission wins; never upgraded by later probing.
  for (const ceiling of detectSkillCeilings(input.candidateAnswer, turn)) {
    if (!next.skillCeilings.some((s) => s.skill === ceiling.skill)) {
      next.skillCeilings.push(ceiling);
      next.establishedFacts.push(
        `Candidate stated ${ceiling.level === "none" ? "no experience with" : ceiling.level + " level in"} ${ceiling.skill} (turn ${turn}).`,
      );
    }
  }

  // Red flags — recorded once per id.
  for (const flag of detectRedFlags(input.candidateAnswer, turn)) {
    if (!next.redFlags.some((f) => f.id === flag.id)) next.redFlags.push(flag);
  }

  // Pivot rule bookkeeping.
  if (input.currentTopicId) {
    next.activeTopic = input.currentTopicId;
    if (input.wasFollowup) {
      next.followupsByTopic[input.currentTopicId] =
        (next.followupsByTopic[input.currentTopicId] || 0) + 1;
    }
  }

  // Opener tracking for transition variety.
  if (input.lastRecruiterReply) {
    const opener = extractOpener(input.lastRecruiterReply);
    if (opener) {
      next.recentOpeners = [opener, ...next.recentOpeners.filter((o) => o !== opener)].slice(0, OPENER_MEMORY);
    }
  }

  next.establishedFacts = next.establishedFacts.slice(-30);
  return next;
}

/** Marks a red flag as probed once the engine issues its single follow-up. */
export function markRedFlagProbed(ledger: ConversationLedger, id: string): ConversationLedger {
  return {
    ...ledger,
    redFlags: ledger.redFlags.map((f) => (f.id === id ? { ...f, probed: true } : f)),
  };
}

// ── Prompt rendering ─────────────────────────────────────────────────────────

export function renderLedgerForPrompt(ledger: ConversationLedger): string {
  const lines: string[] = ["=== CONVERSATION LEDGER (binding — internal) ==="];

  if (ledger.skillCeilings.length) {
    lines.push("SKILL CEILINGS — the candidate has stated these limits. NEVER ask advanced/optimization/architecture questions on these skills again. Pivot to adjacent competencies (collaboration, requirements gathering, communication, how they worked with specialists):");
    for (const s of ledger.skillCeilings)
      lines.push(`  - ${s.skill}: ${s.level.toUpperCase()} ("${s.quotedFrom}")`);
  }

  const unprobed = ledger.redFlags.filter((f) => !f.probed);
  const probed = ledger.redFlags.filter((f) => f.probed);
  if (unprobed.length) {
    lines.push(
      "BEHAVIOURAL FLAG — probe EXACTLY ONCE with an empathetic clarification (pattern: 'I understand your intention. How would you handle that while maintaining the relationship?'), then score internally and move on:",
      ...unprobed.map((f) => `  - ${f.summary}`),
    );
  }
  if (probed.length)
    lines.push("FLAGS ALREADY PROBED — NEVER raise again, score silently: " + probed.map((f) => f.id).join(", "));

  const exhausted = Object.entries(ledger.followupsByTopic).filter(([, n]) => n >= 2);
  if (exhausted.length)
    lines.push("PIVOT RULE TRIGGERED — 2 follow-ups used on: " + exhausted.map(([t]) => t).join(", ") + ". Accept the answer, score internally, MOVE ON now.");

  if (ledger.establishedFacts.length)
    lines.push("ESTABLISHED FACTS — never ask the candidate to repeat these; build on them instead:", ...ledger.establishedFacts.slice(-12).map((f) => `  - ${f}`));

  if (ledger.recentOpeners.length)
    lines.push(
      "TRANSITION VARIETY — do NOT open your reply with any of these recently used openers: " +
      ledger.recentOpeners.map((o) => `"${o}..."`).join(", ") +
      ". Vary acknowledgements naturally, and roughly one turn in three use NO acknowledgement at all — go straight to the question.",
    );

  lines.push(
    "GLOBAL PRINCIPLES: One objective per question. Never bundle asks. Never re-test an explored competency. Never argue with the candidate — score silently. These rules apply in every language.",
    "=== END LEDGER ===",
  );
  return lines.join("\n");
}
