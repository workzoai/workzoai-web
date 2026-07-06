/**
 * lib/conversationLedger.ts
 *
 * v3 ARCHITECTURE, STEP 4 (Dynamic Skill Ceiling), STEP 7 (Conversation
 * Memory), STEP 8 (Red Flag, one probe), STEP 9 (Pivot Rule, max 2
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
 *   catching the signal is sufficient, the ledger persists it forever after.
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

/** How engaged/substantive the candidate's latest answer was. */
export type AnswerEngagement = "substantive" | "declined" | "cannot_answer" | "deferred";

export type ConversationLedger = {
  version: 3;
  turn: number;
  skillCeilings: SkillCeiling[];
  redFlags: RedFlag[];
  establishedFacts: string[];        // deduped, max 30
  /** followupCount per topic slug, Step 9 pivot rule (max 2). */
  followupsByTopic: Record<string, number>;
  /** Topics where the candidate declined / couldn't answer / deflected.
   *  A single weak answer here means STOP drilling that topic. */
  weakAnswersByTopic: Record<string, number>;
  /** Consecutive weak answers across topics; drives pressure de-escalation. */
  disengagementStreak: number;
  /** Classification of the most recent answer (for the next turn's directive). */
  lastAnswerClass: AnswerEngagement;
  activeTopic: string | null;
  /** Last N reply openers, Step 10 anti-repetition. */
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
    weakAnswersByTopic: {},
    disengagementStreak: 0,
    lastAnswerClass: "substantive",
    activeTopic: null,
    recentOpeners: [],
  };
}

// ── STEP 4, Skill ceiling detection (multilingual backstop) ────────────────
// Structure: [limitation marker] ... [skill phrase]. The skill is whatever
// the candidate named, captured, not matched against any list.

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

// ── STEP 8, Red flag detection (deterministic backstop) ────────────────────
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

// ── Answer engagement (implicit skill-ceiling backstop) ─────────────────────
// The observed dead-end: an interviewer keeps escalating into harder
// sub-questions after the candidate has already signalled they can't go
// deeper, ending in an explicit "I don't know". The explicit skill-ceiling
// patterns above only fire on "I never used X" style phrasings; these classes
// catch the softer signals a human reads instantly. Structural, no topic- or
// candidate-specific content. Same multilingual backstop philosophy: the
// prompt also states the rule so the LLM enforces it in any language.

// Unicode-aware word boundaries: JS `\b` is ASCII-only, so a trailing `\b`
// after an accented letter (é, ò, …) fails to match, silently dropping valid
// non-English phrases. These wrappers use \p{L}/\p{N} lookaround instead.
const WB_START = "(?<![\\p{L}\\p{N}])";
const WB_END = "(?![\\p{L}\\p{N}])";
const eng = (alts: string) => new RegExp(`${WB_START}(?:${alts})${WB_END}`, "iu");

// Candidate explicitly declines / disengages from the question.
const DECLINE_RE = eng(
  "next question|skip (?:this|that|it|the question|ahead)|(?:let['’]?s |can we |could we )?move on|" +
  "i['’]?ll pass|pass(?:ing)? on (?:this|that)|i['’]?d rather not (?:answer|say)|no comment|" +
  "n[äa]chste frage|[üu]berspringen|weiter bitte|lass uns weitermachen|keine antwort|" +
  "question suivante|on passe|passons|sans commentaire|" +
  "siguiente pregunta|saltar|pasemos|sin comentarios|" +
  "prossima domanda|saltiamo|passiamo|senza commento|" +
  "pr[óo]xima pergunta|pular|vamos em frente|sem coment[áa]rio|" +
  "volgende vraag|overslaan|laten we verdergaan|geen commentaar",
);

// Candidate cannot answer / does not know.
const CANNOT_ANSWER_RE = eng(
  "i (?:really |just )?(?:don['’]?t|do not) know|i have no (?:idea|clue)|no idea|" +
  "i['’]?m not sure|i am not sure|not sure how|i can['’]?t (?:answer|say|help)|" +
  "i cannot (?:answer|say)|i couldn['’]?t (?:say|tell you)|" +
  "ich wei[ßs] (?:es )?nicht|keine ahnung|ich bin (?:mir )?nicht sicher|kann ich nicht beantworten|" +
  "je ne sais pas|aucune id[ée]e|je ne suis pas s[ûu]re?|je ne peux pas r[ée]pondre|" +
  "no lo sé|no sé|ni idea|no estoy segur[oa]?|no puedo responder|" +
  "non lo so|nessuna idea|non sono sicur[oa]?|non saprei|non posso rispondere|" +
  "n[ãa]o sei responder|n[ãa]o sei|nenhuma ideia|n[ãa]o tenho certeza|" +
  "ik weet het niet|geen idee|ik weet (?:het )?niet zeker|ik kan niet antwoorden",
);

// Candidate defers present capability to the future ("I'll learn it").
const DEFERRED_RE = eng(
  "quick learner|fast learner|i['’]?(?:ll| will) learn|i can learn|willing to learn|eager to learn|" +
  "i['’]?ll (?:pick it up|figure it out|figure this out)|i['’]?ll try to learn|" +
  "learn (?:it|this|that|about (?:it|this)) later|tell you later|" +
  "schnell lerne|ich lerne (?:das )?schnell|ich kann (?:das )?lernen|bereit zu lernen|werde ich (?:noch )?lernen|sp[äa]ter lernen|" +
  "j['’]?apprends vite|apprendre rapidement|je vais apprendre|je peux apprendre|pr[êe]te? [àa] apprendre|je me d[ée]brouillerai|" +
  "aprendo r[áa]pido|voy a aprender|puedo aprender|dispuest[oa] a aprender|lo aprenderé|" +
  "imparo (?:in fretta|velocemente)|imparer[òo]|posso imparare|disposto a imparare|lo imparer[òo]|" +
  "ik leer snel|ik zal (?:het )?leren|ik kan leren|bereid om te leren",
);

/**
 * Classifies how engaged/substantive an answer is. Priority: an explicit
 * decline outranks a can't-answer, which outranks a future-deflection. Anything
 * else is treated as a real attempt (substantive) and does not throttle depth.
 */
export function classifyAnswerEngagement(answer: string): AnswerEngagement {
  const a = answer || "";
  if (DECLINE_RE.test(a)) return "declined";
  if (CANNOT_ANSWER_RE.test(a)) return "cannot_answer";
  if (DEFERRED_RE.test(a)) return "deferred";
  return "substantive";
}

// ── STEP 10, Transition variety ─────────────────────────────────────────────
// The pool is prompt GUIDANCE (the LLM renders transitions natively in the
// interview language). The deterministic part is the recent-opener tracker:
// the engine extracts each reply's opening words and bans reuse.

export const TRANSITION_POOL: string[] = [
  "That makes sense.", "Thanks for explaining.", "Interesting.", "I appreciate the detail.",
  "Fair enough.", "Good context.", "Right.", "Okay, that helps.", "I can see that.",
  "That's a useful example.", "Clear.", "Got it.", "That answers it.", "Helpful.",
  "I follow.", "Makes sense to me.", "Alright.", "That's fair.", "Understood, thanks.",
  "Appreciate that.", "Nice example.", "That paints a picture.", "Good, thanks.",
  "Let's explore another area.", "I'd like to understand something else.",
  "Changing topics slightly...", "Let's switch gears.", "Moving to a different area...",
  "On a related note...", "Let me take this somewhere else.", "Building on that...",
  "Something you said earlier caught my attention.", "Let's zoom out for a moment.",
  "Let's get more specific.", "Coming back to the role itself...", "One more angle on this...",
  "Before we move on -", "While we're on this...", "Taking a step back...",
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
    weakAnswersByTopic: { ...(ledger.weakAnswersByTopic || {}) },
    disengagementStreak: ledger.disengagementStreak || 0,
    lastAnswerClass: ledger.lastAnswerClass || "substantive",
    recentOpeners: [...ledger.recentOpeners],
  };

  // Answer engagement (implicit ceiling / disengagement). A weak answer on a
  // topic means that topic must NOT be drilled further; consecutive weak
  // answers across topics trigger pressure de-escalation.
  const answerClass = classifyAnswerEngagement(input.candidateAnswer);
  next.lastAnswerClass = answerClass;
  if (answerClass === "substantive") {
    next.disengagementStreak = 0;
  } else {
    next.disengagementStreak = (next.disengagementStreak || 0) + 1;
    if (input.currentTopicId) {
      next.weakAnswersByTopic[input.currentTopicId] =
        (next.weakAnswersByTopic[input.currentTopicId] || 0) + 1;
    }
  }

  // Skill ceilings, first admission wins; never upgraded by later probing.
  for (const ceiling of detectSkillCeilings(input.candidateAnswer, turn)) {
    if (!next.skillCeilings.some((s) => s.skill === ceiling.skill)) {
      next.skillCeilings.push(ceiling);
      next.establishedFacts.push(
        `Candidate stated ${ceiling.level === "none" ? "no experience with" : ceiling.level + " level in"} ${ceiling.skill} (turn ${turn}).`,
      );
    }
  }

  // Red flags, recorded once per id.
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
  const lines: string[] = ["=== CONVERSATION LEDGER (binding, internal) ==="];

  if (ledger.skillCeilings.length) {
    lines.push("SKILL CEILINGS, the candidate has stated these limits. NEVER ask advanced/optimization/architecture questions on these skills again. Pivot to adjacent competencies (collaboration, requirements gathering, communication, how they worked with specialists):");
    for (const s of ledger.skillCeilings)
      lines.push(`  - ${s.skill}: ${s.level.toUpperCase()} ("${s.quotedFrom}")`);
  }

  const unprobed = ledger.redFlags.filter((f) => !f.probed);
  const probed = ledger.redFlags.filter((f) => f.probed);
  if (unprobed.length) {
    lines.push(
      "BEHAVIOURAL FLAG, probe EXACTLY ONCE with an empathetic clarification (pattern: 'I understand your intention. How would you handle that while maintaining the relationship?'), then score internally and move on:",
      ...unprobed.map((f) => `  - ${f.summary}`),
    );
  }
  if (probed.length)
    lines.push("FLAGS ALREADY PROBED, NEVER raise again, score silently: " + probed.map((f) => f.id).join(", "));

  const exhausted = Object.entries(ledger.followupsByTopic).filter(([, n]) => n >= 2);
  if (exhausted.length)
    lines.push("PIVOT RULE TRIGGERED, 2 follow-ups used on: " + exhausted.map(([t]) => t).join(", ") + ". Accept the answer, score internally, MOVE ON now.");

  // Implicit-ceiling throttle: one weak answer on a topic ends drilling on it.
  const weakTopics = Object.entries(ledger.weakAnswersByTopic || {}).filter(([, n]) => n >= 1);
  if (weakTopics.length)
    lines.push(
      "WEAK / DECLINED TOPICS, the candidate declined, could not answer, or deflected here. Do NOT ask any further question or harder sub-question on these, and do NOT rephrase and re-ask. Accept it, score internally, and move to a DIFFERENT competency: " +
      weakTopics.map(([t]) => t).join(", ") + ".",
    );

  // Pressure de-escalation, driven by consecutive weak answers.
  const streak = ledger.disengagementStreak || 0;
  if (streak >= 2) {
    lines.push(
      "DE-ESCALATION (BINDING): the candidate has disengaged or struggled on the last " + streak +
      " answers. Ease off now. Do NOT stack harder sub-questions, 'give me a step-by-step example', or 'go deeper' probes. Switch to a genuinely different, more accessible area (motivation, a strength they clearly have, a lighter behavioural question), keep your tone encouraging, and rebuild momentum before any further depth. This overrides any persona pressure setting.",
    );
  } else if (ledger.lastAnswerClass && ledger.lastAnswerClass !== "substantive") {
    lines.push(
      "The candidate just declined or could not answer the previous question. Do NOT re-ask it or a reworded version. Acknowledge briefly and move to a genuinely different, accessible area.",
    );
  }

  if (ledger.establishedFacts.length)
    lines.push("ESTABLISHED FACTS, never ask the candidate to repeat these; build on them instead:", ...ledger.establishedFacts.slice(-12).map((f) => `  - ${f}`));

  if (ledger.recentOpeners.length)
    lines.push(
      "TRANSITION VARIETY, do NOT open your reply with any of these recently used openers: " +
      ledger.recentOpeners.map((o) => `"${o}..."`).join(", ") +
      ". Vary acknowledgements naturally, and roughly one turn in three use NO acknowledgement at all, go straight to the question.",
    );

  lines.push(
    "GLOBAL PRINCIPLES: One objective per question. Never bundle asks. Never re-test an explored competency. Never argue with the candidate, score silently. These rules apply in every language.",
    "=== END LEDGER ===",
  );
  return lines.join("\n");
}
