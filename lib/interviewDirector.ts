/**
 * interviewDirector.ts
 *
 * The "steering column" for the recruiter simulation.
 *
 * The recruiter brain (recruiterBrainEngine.ts) is an excellent set of SENSORS:
 * it computes competency scores, JD coverage, hiring signal, emotional state.
 * But until now those signals were only *serialized into a prompt* and the LLM
 * was free to ignore them — which is why the recruiter repeated questions, got
 * stuck on a topic, and re-asked for proof already given.
 *
 * The Interview Director owns PERSISTENT state across turns and turns those
 * sensors into an ENFORCED decision:
 *   - which topics are DONE (never revisit)
 *   - which topics we've spent too long on (pivot after N attempts)
 *   - which JD gaps were already probed
 *   - which recruiter concerns are still open vs resolved
 *   - which specific facts the candidate gave (so we can call back to them)
 *   - what the single NEXT AREA must be
 *
 * The LLM (or the live Vapi assistant) then only PHRASES the question on that
 * area. It does not get to pick the topic anymore. That is what kills the loops.
 *
 * This module is intentionally PURE and environment-agnostic: it imports only
 * from the pure recruiterBrainEngine and has no server-only dependencies, so it
 * can run both server-side (text mode, in the API routes) and client-side
 * (voice mode, in app/interview/page.tsx to steer the live Vapi call).
 */

import {
  buildRecruiterBrain,
  type RecruiterBrainContext,
  type TranscriptItem,
  type Competency,
  type CompetencyStatus,
} from "@/lib/recruiterBrainEngine";

export const DIRECTOR_STATE_VERSION = 1;

// Defaults — tunable per state instance.
const DEFAULT_PIVOT_AFTER_ATTEMPTS = 2;
const DEFAULT_COMPLETION_THRESHOLD = 60;
const MAX_CONCERN_ATTEMPTS = 2;
const MAX_MEMORY_FACTS = 24;
const MAX_CONCERNS = 8;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConcernStatus = "open" | "partially_resolved" | "resolved";
export type DirectiveIntent =
  | "probe_topic"
  | "resolve_concern"
  | "probe_jd_gap"
  | "callback"
  | "closing";

export type DirectorTopic = {
  id: string; // a Competency id, or `jd_gap:<skill>`
  label: string;
  attempts: number; // turns DELIBERATELY steered here (not regex matches)
  status: "untouched" | "in_progress" | "complete" | "abandoned";
  bestScore: number | null; // 0-100 from the competency tracker
  lastAskedTurn: number;
};

export type DirectorConcern = {
  id: string; // stable slug, e.g. "career-transition" or "jd-gap:python"
  label: string;
  status: ConcernStatus;
  attempts: number; // resolve attempts spent
  evidence: string[]; // candidate quotes that moved it toward resolution
  raisedAtTurn: number;
  lastTouchedTurn: number;
};

export type DirectorMemoryFact = {
  text: string; // "95% CSAT", "moved to Germany 2021"
  kind: "metric" | "claim" | "company" | "skill" | "role";
  turn: number;
  referenced: boolean; // already used in a callback question
};

export type DirectorDirective = {
  topicId: string;
  topicLabel: string;
  intent: DirectiveIntent;
  angle: string; // HOW to approach it (not the literal words)
  constraintLine: string; // one-line summary for the prompt header
};

export type InterviewDirectorState = {
  version: number;
  turn: number; // candidate-answer count
  trustScore: number; // mirrors recruiterTrust
  interestScore: number;
  completedTopics: string[]; // topic ids that must NEVER be revisited
  topics: Record<string, DirectorTopic>; // coverage map + attempt counters
  probedJdGaps: string[]; // JD skills already asked about
  concerns: DirectorConcern[];
  memoryFacts: DirectorMemoryFact[];
  lastDirective: DirectorDirective | null;
  pivotAfterAttempts: number;
  completionThreshold: number;
};

export type AdvanceDirectorInput = {
  prior: InterviewDirectorState | null;
  answer: string;
  transcript: TranscriptItem[];
  cvText: string;
  jobDescription: string;
  targetRole: string;
  companyStyle: string;
  trust: number;
  recruiterState: string;
  lastAnswerScore?: number | null;
};

export type AdvanceDirectorResult = {
  state: InterviewDirectorState;
  directive: DirectorDirective;
  // The recruiter brain is computed inside advanceDirector — return it so the
  // caller (API route) doesn't recompute it a second time.
  brain: RecruiterBrainContext;
};

// ── Cold start ──────────────────────────────────────────────────────────────

export function createDirectorState(seedTrust = 70): InterviewDirectorState {
  return {
    version: DIRECTOR_STATE_VERSION,
    turn: 0,
    trustScore: clampScore(seedTrust),
    interestScore: 70,
    completedTopics: [],
    topics: {},
    probedJdGaps: [],
    concerns: [],
    memoryFacts: [],
    lastDirective: null,
    pivotAfterAttempts: DEFAULT_PIVOT_AFTER_ATTEMPTS,
    completionThreshold: DEFAULT_COMPLETION_THRESHOLD,
  };
}

/**
 * Defensively coerce an untrusted blob (e.g. one round-tripped from the client
 * via recruiterMemoryV2.director, or restored from recovery_snapshot) back into
 * a valid state. Returns null when the value isn't a usable director state so
 * callers can fall back to a cold start.
 */
export function hydrateDirectorState(value: unknown): InterviewDirectorState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<InterviewDirectorState>;
  if (typeof raw.turn !== "number") return null;
  const base = createDirectorState(raw.trustScore ?? 70);
  return {
    ...base,
    version: DIRECTOR_STATE_VERSION,
    turn: raw.turn ?? 0,
    trustScore: clampScore(raw.trustScore ?? base.trustScore),
    interestScore: clampScore(raw.interestScore ?? base.interestScore),
    completedTopics: arr(raw.completedTopics),
    topics: raw.topics && typeof raw.topics === "object" ? raw.topics : {},
    probedJdGaps: arr(raw.probedJdGaps),
    concerns: Array.isArray(raw.concerns) ? raw.concerns : [],
    memoryFacts: Array.isArray(raw.memoryFacts) ? raw.memoryFacts : [],
    lastDirective: raw.lastDirective ?? null,
    pivotAfterAttempts: raw.pivotAfterAttempts ?? base.pivotAfterAttempts,
    completionThreshold: raw.completionThreshold ?? base.completionThreshold,
  };
}

// ── The per-turn control loop ─────────────────────────────────────────────────

export function advanceDirector(input: AdvanceDirectorInput): AdvanceDirectorResult {
  const prior = input.prior ?? createDirectorState(input.trust);

  // 1. SENSE — reuse the pure recruiter brain (single compute, returned to caller).
  const brain = buildRecruiterBrain({
    cvText: input.cvText,
    jobDescription: input.jobDescription,
    targetRole: input.targetRole,
    companyStyle: input.companyStyle,
    transcript: input.transcript,
    trust: input.trust,
    recruiterState: input.recruiterState,
    lastAnswerScore: input.lastAnswerScore ?? null,
  });

  // 2. INGEST — fold this turn's evidence into persistent state.
  const state: InterviewDirectorState = {
    ...prior,
    version: DIRECTOR_STATE_VERSION,
    turn: prior.turn + 1,
    trustScore: clampScore(input.trust),
    topics: { ...prior.topics },
    completedTopics: [...prior.completedTopics],
    probedJdGaps: [...prior.probedJdGaps],
    concerns: prior.concerns.map((c) => ({ ...c, evidence: [...c.evidence] })),
    memoryFacts: [...prior.memoryFacts],
  };

  ingestCompetencies(state, brain.competencies);
  ingestSteeredTopicAttempt(state, brain.competencies, input.answer);
  ingestJdGaps(state, brain);
  ingestConcerns(state, brain, input.answer);
  ingestMemoryFacts(state, input.answer);
  state.interestScore = computeInterest(prior.interestScore, lastTurnScore(brain, input.lastAnswerScore));

  // 3. DECIDE — choose the single NEXT AREA, deterministically.
  const directive = chooseNextArea(state, brain);
  state.lastDirective = directive;

  return { state, directive, brain };
}

// ── Ingestion helpers ─────────────────────────────────────────────────────────

function ingestCompetencies(state: InterviewDirectorState, competencies: CompetencyStatus[]) {
  for (const comp of competencies) {
    if (!comp.tested) continue;
    const existing = state.topics[comp.id];
    const bestScore = Math.max(existing?.bestScore ?? 0, comp.score ?? 0);
    state.topics[comp.id] = {
      id: comp.id,
      label: comp.label,
      attempts: existing?.attempts ?? 0,
      status: existing?.status === "complete" || existing?.status === "abandoned"
        ? existing.status
        : "in_progress",
      bestScore,
      lastAskedTurn: existing?.lastAskedTurn ?? state.turn,
    };
    // Complete a topic once it clears the threshold (answered well enough).
    if (bestScore >= state.completionThreshold) {
      markTopicComplete(state, comp.id, "complete");
    }
  }
}

/**
 * Attempts are counted only against the topic we DELIBERATELY steered to last
 * turn — never against any keyword the regex happens to match. This is what
 * makes "pivot after N attempts" trustworthy. After N attempts without clearing
 * the threshold, the topic is abandoned and added to completedTopics so it is
 * never re-asked.
 */
function ingestSteeredTopicAttempt(
  state: InterviewDirectorState,
  competencies: CompetencyStatus[],
  answer: string,
) {
  const last = state.lastDirective;
  if (!last || last.intent === "closing" || !answer.trim()) return;
  if (last.topicId.startsWith("jd_gap:")) return; // handled in ingestJdGaps

  const topic = state.topics[last.topicId];
  if (!topic || topic.status === "complete" || topic.status === "abandoned") return;

  topic.attempts += 1;
  topic.lastAskedTurn = state.turn;

  const comp = competencies.find((c) => c.id === last.topicId);
  if (comp?.tested && (comp.score ?? 0) >= state.completionThreshold) {
    markTopicComplete(state, topic.id, "complete");
  } else if (topic.attempts >= state.pivotAfterAttempts) {
    markTopicComplete(state, topic.id, "abandoned");
  }
}

function ingestJdGaps(state: InterviewDirectorState, brain: RecruiterBrainContext) {
  // Any JD skill that has now surfaced in the transcript (probed) is locked in
  // so we don't re-ask it. Also lock the gap we explicitly steered toward.
  for (const req of brain.jdCoverage.covered.concat(brain.jdCoverage.missing)) {
    if (req.probed && !state.probedJdGaps.includes(req.skill)) {
      state.probedJdGaps.push(req.skill);
    }
  }
  const last = state.lastDirective;
  if (last?.intent === "probe_jd_gap" && last.topicId.startsWith("jd_gap:")) {
    const skill = last.topicId.slice("jd_gap:".length);
    if (skill && !state.probedJdGaps.includes(skill)) state.probedJdGaps.push(skill);
    markTopicComplete(state, last.topicId, "complete");
  }
}

function ingestConcerns(state: InterviewDirectorState, brain: RecruiterBrainContext, answer: string) {
  // Resolve the concern we were actively probing, based on answer quality.
  const last = state.lastDirective;
  if (last?.intent === "resolve_concern") {
    const concern = state.concerns.find((c) => c.id === last.topicId);
    if (concern && concern.status !== "resolved") {
      concern.attempts += 1;
      concern.lastTouchedTurn = state.turn;
      const quality = answerEvidenceStrength(answer);
      if (quality >= 2) {
        concern.status = "resolved";
        concern.evidence.push(snippet(answer));
      } else if (quality === 1) {
        concern.status = "partially_resolved";
        concern.evidence.push(snippet(answer));
      }
      // Recruiters don't badger forever — drop a concern after N attempts.
      if (concern.status !== "resolved" && concern.attempts >= MAX_CONCERN_ATTEMPTS) {
        concern.status = "resolved";
      }
    }
  }

  // Seed new concerns from the brain's risk signals (deduped, capped).
  const candidates: Array<{ id: string; label: string }> = [];
  if (brain.hasCareerTransition) {
    candidates.push({ id: "career-transition", label: "Career transition fit" });
  }
  for (const gap of brain.jdCoverage.unprobed) {
    candidates.push({ id: `jd-gap:${slug(gap.skill)}`, label: `JD gap: ${gap.skill}` });
  }
  for (const risk of brain.hiringRecommendation.riskFactors) {
    candidates.push({ id: `risk:${slug(risk)}`, label: risk });
  }

  for (const cand of candidates) {
    if (state.concerns.length >= MAX_CONCERNS) break;
    if (state.concerns.some((c) => c.id === cand.id)) continue;
    state.concerns.push({
      id: cand.id,
      label: cand.label,
      status: "open",
      attempts: 0,
      evidence: [],
      raisedAtTurn: state.turn,
      lastTouchedTurn: state.turn,
    });
  }
}

function ingestMemoryFacts(state: InterviewDirectorState, answer: string) {
  for (const fact of extractMemoryFacts(answer, state.turn)) {
    const key = fact.text.toLowerCase();
    if (state.memoryFacts.some((f) => f.text.toLowerCase() === key)) continue;
    state.memoryFacts.push(fact);
  }
  if (state.memoryFacts.length > MAX_MEMORY_FACTS) {
    state.memoryFacts = state.memoryFacts.slice(-MAX_MEMORY_FACTS);
  }
}

// ── Next-area decision (the core "never repeat" logic) ─────────────────────────

const PRIORITY_ORDER: Competency[] = [
  "problem_solving",
  "ownership",
  "technical_depth",
  "stakeholder_management",
  "leadership",
  "adaptability",
  "communication",
];

export function chooseNextArea(
  state: InterviewDirectorState,
  brain: RecruiterBrainContext,
): DirectorDirective {
  const done = new Set(state.completedTopics);

  // 1. Earliest turns: rapport + motivation, unless already covered.
  if (state.turn <= 2 && !done.has("motivation_and_fit")) {
    return directive(
      "motivation_and_fit",
      "Motivation & Fit",
      "probe_topic",
      "Let them introduce themselves and explain their interest in this role.",
    );
  }

  // 2. A high-priority OPEN concern that we haven't exhausted.
  const openConcern = state.concerns.find(
    (c) => c.status === "open" && c.attempts < MAX_CONCERN_ATTEMPTS,
  );
  if (openConcern) {
    return directive(
      openConcern.id,
      openConcern.label,
      "resolve_concern",
      `Resolve this concern with concrete evidence: ${openConcern.label}. If the candidate already addressed it, acknowledge and move on.`,
    );
  }

  // 3. Career transition — validate before going deep.
  if (brain.hasCareerTransition && !done.has("career_transition")) {
    return directive(
      "career_transition",
      "Career Transition",
      "probe_topic",
      "Ask why the switch, what preparation they've done, and which skills transfer.",
    );
  }

  // 4. First unprobed JD gap.
  const gap = brain.jdCoverage.unprobed.find(
    (r) => !state.probedJdGaps.includes(r.skill) && !done.has(`jd_gap:${r.skill}`),
  );
  if (gap) {
    return directive(
      `jd_gap:${gap.skill}`,
      `JD Gap: ${gap.skill}`,
      "probe_jd_gap",
      `${gap.skill} is required by the role but not clearly in the CV. Introduce it naturally — have they worked with it, or how would they approach it?`,
    );
  }

  // 5. Brain's suggested next topic, if not already completed.
  const suggested = brain.strategy.nextBestTopicId;
  if (suggested && !done.has(suggested)) {
    return directive(
      suggested,
      brain.strategy.nextBestTopicLabel,
      "probe_topic",
      brain.strategy.suggestedAngle,
    );
  }

  // 5b. Walk the priority order to the next competency we haven't completed.
  const next = PRIORITY_ORDER.find((id) => !done.has(id));
  if (next) {
    const label = brain.competencies.find((c) => c.id === next)?.label ?? labelFor(next);
    return directive(
      next,
      label,
      "probe_topic",
      "Find a natural opening from their last answer to explore this dimension.",
    );
  }

  // 6. Everything covered — wrap up.
  return directive(
    "closing",
    "Closing",
    "closing",
    "Core areas are covered. Move toward closing: development areas, fit, and whether they have questions.",
  );
}

// ── Prompt serialization (HARD constraint block) ───────────────────────────────

/**
 * Compact, high-priority constraint block injected ABOVE the advisory recruiter
 * brain. The framing makes clear: the system picks the AREA; the model only
 * picks the wording. Kept well under ~1800 chars to protect the token budget.
 */
export function serializeDirectorConstraint(
  state: InterviewDirectorState,
  directive: DirectorDirective,
): string {
  const lines: string[] = [];
  lines.push("═══ INTERVIEW DIRECTOR — HARD CONSTRAINTS (obey exactly) ═══");
  lines.push(`NEXT AREA (mandatory): ${directive.topicLabel}`);
  lines.push(`INTENT: ${directive.intent}`);
  lines.push(`APPROACH: ${directive.angle}`);

  const completedLabels = state.completedTopics
    .map((id) => topicLabel(state, id))
    .filter(Boolean);
  if (completedLabels.length) {
    lines.push(`DO NOT REVISIT (already covered): ${completedLabels.join("; ")}`);
  }

  const resolved = state.concerns
    .filter((c) => c.status === "resolved")
    .map((c) => c.label);
  if (resolved.length) {
    lines.push(`RESOLVED — never re-demand proof: ${resolved.join("; ")}`);
  }

  const openConcern = state.concerns.find((c) => c.status === "open");
  if (openConcern && directive.intent !== "resolve_concern") {
    lines.push(`OPEN CONCERN (fold in only if natural): ${openConcern.label}`);
  }

  const callbacks = state.memoryFacts
    .filter((f) => !f.referenced)
    .slice(-4)
    .map((f) => f.text);
  if (callbacks.length) {
    lines.push(`MEMORY CALLBACKS available: ${callbacks.join("; ")}`);
  }

  lines.push("RULES:");
  lines.push("- Ask ONE natural question on NEXT AREA. You choose the wording, NOT the topic.");
  lines.push("- If the candidate's last answer already satisfies NEXT AREA, acknowledge it and advance — never loop.");
  lines.push("- Never re-ask a DO NOT REVISIT topic and never re-demand proof already listed as RESOLVED.");
  lines.push("═══ END DIRECTOR ═══");
  return lines.join("\n");
}

// ── Small pure utilities ───────────────────────────────────────────────────────

function directive(
  topicId: string,
  topicLabel: string,
  intent: DirectiveIntent,
  angle: string,
): DirectorDirective {
  return {
    topicId,
    topicLabel,
    intent,
    angle,
    constraintLine: `${topicLabel} (${intent})`,
  };
}

function markTopicComplete(
  state: InterviewDirectorState,
  id: string,
  status: "complete" | "abandoned",
) {
  const topic = state.topics[id];
  if (topic) {
    topic.status = status;
    if (topic.bestScore === null) topic.bestScore = 0;
  }
  if (!state.completedTopics.includes(id)) state.completedTopics.push(id);
}

function computeInterest(prev: number, lastScore: number | null): number {
  if (lastScore === null) return prev;
  // Strong answers raise interest; weak answers lower it (mirrors the brief's
  // +10 / -5 model, smoothed).
  const delta = lastScore >= 70 ? 8 : lastScore >= 50 ? 2 : -5;
  return clampScore(prev + delta);
}

function lastTurnScore(brain: RecruiterBrainContext, explicit?: number | null): number | null {
  if (typeof explicit === "number") return explicit;
  const tested = brain.competencies.filter((c) => c.tested && c.score !== null);
  if (!tested.length) return null;
  // Most-recently-tested competency is the best proxy for "this answer".
  return tested.sort((a, b) => b.lastTestedAt - a.lastTestedAt)[0].score ?? null;
}

/** 0 = vague, 1 = some evidence, 2 = strong (ownership + outcome/metric). */
function answerEvidenceStrength(answer: string): number {
  const text = answer || "";
  const hasOwnership = /\bi (?:built|created|led|owned|decided|initiated|drove|implemented|designed|improved|reduced|increased|handled|resolved)\b/i.test(text);
  const hasOutcome = /\b(result|impact|outcome|improved|reduced|increased|achieved|delivered|saved|resolved|grew|retained)\b/i.test(text);
  const hasMetric = /\b\d+\s*%?|\bCSAT|\bNPS|\bSLA|\bKPI\b/i.test(text);
  const longEnough = text.split(/\s+/).length >= 25;
  let score = 0;
  if (hasOwnership && (hasOutcome || hasMetric)) score = 2;
  else if (hasOutcome || hasMetric || (hasOwnership && longEnough)) score = 1;
  return score;
}

// Small, self-contained memory extractors (kept here so this module stays pure
// and client-bundle-safe rather than importing the openai-laden engine).
// Note: percentages need their own branch — there is no word boundary between
// "%" and the following space, so a trailing \b would (wrongly) reject "95%".
const METRIC_RE = /\b\d+\+?\s*%|\b\d+\+?\s*(?:percent|years|yrs|months|people|engineers|customers|clients|tickets|cases|projects|million|thousand)\b|\b(?:CSAT|NPS|SLA|KPI)\b/gi;
const COMPANY_RE = /\b(Zoho|Microsoft|Amazon|Google|Tesla|Apple|Meta|Facebook|Salesforce|SAP|Oracle|IBM|Infosys|TCS|Wipro|Accenture|Deloitte|Freshworks|HubSpot|ServiceNow|Zendesk|Atlassian|Adobe|Netflix|Uber|Airbnb|Stripe|Shopify|OpenAI|Anthropic|Nvidia|Toyota|BMW|Siemens|Bosch)\b/gi;
const SKILL_RE = /\b(Python|SQL|Excel|Tableau|Power BI|Salesforce|HubSpot|Zendesk|Jira|CRM|SaaS|API|REST|JavaScript|TypeScript|React|Next\.js|Node\.js|AWS|Azure|GCP|Docker|Kubernetes|Machine Learning|LLM|Figma)\b/gi;

function extractMemoryFacts(answer: string, turn: number): DirectorMemoryFact[] {
  const facts: DirectorMemoryFact[] = [];
  const push = (text: string, kind: DirectorMemoryFact["kind"]) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) facts.push({ text: clean, kind, turn, referenced: false });
  };
  for (const m of answer.matchAll(METRIC_RE)) push(m[0], "metric");
  for (const m of answer.matchAll(COMPANY_RE)) push(m[0], "company");
  for (const m of answer.matchAll(SKILL_RE)) push(m[0], "skill");
  return facts;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function snippet(text: string, max = 120): string {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slug(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const COMPETENCY_LABELS: Record<Competency, string> = {
  technical_depth: "Technical Depth",
  communication: "Communication",
  leadership: "Leadership",
  stakeholder_management: "Stakeholder Management",
  problem_solving: "Problem Solving",
  ownership: "Ownership",
  adaptability: "Adaptability",
  motivation_and_fit: "Motivation & Fit",
  career_transition: "Career Transition",
  jd_gap: "JD Skill Gap",
};

function labelFor(id: Competency): string {
  return COMPETENCY_LABELS[id] ?? id;
}

function topicLabel(state: InterviewDirectorState, id: string): string {
  if (state.topics[id]?.label) return state.topics[id].label;
  if (id.startsWith("jd_gap:")) return `JD Gap: ${id.slice("jd_gap:".length)}`;
  if (id in COMPETENCY_LABELS) return COMPETENCY_LABELS[id as Competency];
  return id;
}
