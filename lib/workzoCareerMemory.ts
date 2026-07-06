export type CareerMemorySignal =
  | "missing_metrics"
  | "weak_ownership"
  | "vague_answer"
  | "rambling"
  | "strong_metrics"
  | "clear_ownership"
  | "good_recovery"
  | "confidence_drop"
  | "weak_structure"
  | "strong_structure"
  | "career_gap_risk"
  | "company_alignment"
  | "contradiction_risk";

export type CareerMemoryPattern = {
  signal: CareerMemorySignal;
  count: number;
  lastSeenAt: string;
};

export type CareerMemoryInterview = {
  id: string;
  date: string;
  targetRole: string;
  companyName: string;
  score: number;
  trust: number;
  evidence: number;
  ownership: number;
  structure: number;
  biggestBlocker: string;
  recurringSignals: CareerMemorySignal[];
};

export type CareerRoadmapItem = {
  id: string;
  priority: string;
  title: string;
  action: string;
  source: "cv" | "job" | "interview" | "results" | "global";
  estimatedGain: string;
  completed: boolean;
  updatedAt: string;
};

export type InterviewProbability = {
  current: number;
  afterCv: number;
  afterPrep: number;
  label: "Low" | "Developing" | "Promising" | "Strong";
  reasons: string[];
};

export type WorkZoCareerMemory = {
  version: 1;
  updatedAt: string;
  patterns: CareerMemoryPattern[];
  strengths: string[];
  risks: string[];
  interviewHistory?: CareerMemoryInterview[];
  roadmap?: CareerRoadmapItem[];
  companyTargets?: string[];
  roleTargets?: string[];
};

export type PhaseCCareerBrainInput = {
  targetRole?: string;
  companyName?: string;
  overallScore?: number;
  trustScore?: number;
  evidenceQuality?: number;
  ownershipScore?: number;
  structureScore?: number;
  biggestBlocker?: string;
  strengths?: string[];
  improvements?: string[];
  answerInsights?: Array<{
    answer?: string;
    metricPresent?: boolean;
    ownershipPresent?: boolean;
    resultPresent?: boolean;
    structureScore?: number;
    evidenceScore?: number;
    trustImpact?: number;
    redFlags?: string[];
    weakness?: string;
  }>;
  contradictions?: Array<{ detail?: string; title?: string }> | string[];
};

export type PhaseCCareerBrain = {
  memory: WorkZoCareerMemory;
  probability: InterviewProbability;
  persistentWeaknesses: Array<{ label: string; count: number; coachLine: string }>;
  recurringStrengths: string[];
  crossFeatureActions: Array<{ feature: "Improve CV" | "Cover Letter" | "Job Assist" | "Interview"; action: string }>;
  futureRecruiterChallenges: string[];
  roadmap: CareerRoadmapItem[];
  progress: {
    scoreTrend: number[];
    trustTrend: number[];
    evidenceTrend: number[];
    ownershipTrend: number[];
    latestSummary: string;
  };
};

const STORAGE_KEY = "workzo-career-memory-v1";

export const emptyCareerMemory: WorkZoCareerMemory = {
  version: 1,
  updatedAt: "",
  patterns: [],
  strengths: [],
  risks: [],
  interviewHistory: [],
  roadmap: [],
  companyTargets: [],
  roleTargets: [],
};

function nowIso() {
  return new Date().toISOString();
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

function unique(values: string[], limit = 8) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeMemory(value: Partial<WorkZoCareerMemory> | null | undefined): WorkZoCareerMemory {
  if (!value || value.version !== 1 || !Array.isArray(value.patterns)) return emptyCareerMemory;
  return {
    version: 1,
    updatedAt: value.updatedAt || "",
    patterns: Array.isArray(value.patterns) ? value.patterns : [],
    strengths: Array.isArray(value.strengths) ? value.strengths.filter(Boolean) : [],
    risks: Array.isArray(value.risks) ? value.risks.filter(Boolean) : [],
    interviewHistory: Array.isArray(value.interviewHistory) ? value.interviewHistory : [],
    roadmap: Array.isArray(value.roadmap) ? value.roadmap : [],
    companyTargets: Array.isArray(value.companyTargets) ? value.companyTargets.filter(Boolean) : [],
    roleTargets: Array.isArray(value.roleTargets) ? value.roleTargets.filter(Boolean) : [],
  };
}

export function readCareerMemory(): WorkZoCareerMemory {
  if (typeof window === "undefined") return emptyCareerMemory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCareerMemory;
    return normalizeMemory(JSON.parse(raw) as Partial<WorkZoCareerMemory>);
  } catch {
    return emptyCareerMemory;
  }
}

export function saveCareerMemory(memory: WorkZoCareerMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...memory, updatedAt: nowIso() }));
  } catch {}
}

export function recordCareerMemorySignal(memory: WorkZoCareerMemory, signal: CareerMemorySignal): WorkZoCareerMemory {
  const now = nowIso();
  const existing = memory.patterns.find((item) => item.signal === signal);
  const patterns = existing
    ? memory.patterns.map((item) => item.signal === signal ? { ...item, count: item.count + 1, lastSeenAt: now } : item)
    : [...memory.patterns, { signal, count: 1, lastSeenAt: now }];

  const next = {
    ...memory,
    updatedAt: now,
    patterns: patterns.sort((a, b) => b.count - a.count).slice(0, 18),
  };

  return { ...next, strengths: buildCareerStrengths(next.patterns), risks: buildCareerRisks(next.patterns) };
}

export function inferSignalsFromAnswer(answer: string): CareerMemorySignal[] {
  const text = clean(answer);
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const signals: CareerMemorySignal[] = [];
  const hasMetric = /\d|%|percent|reduced|increased|saved|improved|faster|tickets|users|customers|revenue|cost|hours|days|weeks/i.test(text);
  const hasOwnership = /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bowned\b|\bcreated\b|\bhandled\b|\bresolved\b|\bimplemented\b|\bimproved\b/i.test(text);
  const vague = /\bhelped\b|\bworked on\b|\binvolved in\b|\bthings\b|\bstuff\b|\bvarious\b|\ba lot\b|\bgood\b|\bnice\b/i.test(lower);
  const uncertain = /\bmaybe\b|\bi think\b|\bprobably\b|\bnot sure\b|\bkind of\b|\bsort of\b/i.test(lower);
  if (!hasMetric && words.length > 28) signals.push("missing_metrics");
  if (!hasOwnership && words.length > 20) signals.push("weak_ownership");
  if (vague) signals.push("vague_answer");
  if (words.length > 150) signals.push("rambling");
  if (uncertain) signals.push("confidence_drop");
  if (hasMetric) signals.push("strong_metrics");
  if (hasOwnership) signals.push("clear_ownership");
  return Array.from(new Set(signals));
}

export function updateCareerMemoryFromAnswer(answer: string) {
  const memory = readCareerMemory();
  const signals = inferSignalsFromAnswer(answer);
  const updated = signals.reduce((current, signal) => recordCareerMemorySignal(current, signal), memory);
  saveCareerMemory(updated);
  return updated;
}

function inferSignalsFromReport(input: PhaseCCareerBrainInput): CareerMemorySignal[] {
  const signals: CareerMemorySignal[] = [];
  const answers = input.answerInsights || [];
  if (answers.some((item) => item.metricPresent === false) || (input.evidenceQuality || 0) < 65) signals.push("missing_metrics");
  if (answers.some((item) => item.ownershipPresent === false) || (input.ownershipScore || 0) < 65) signals.push("weak_ownership");
  if ((input.structureScore || 0) < 66) signals.push("weak_structure");
  if ((input.trustScore || 0) < 62) signals.push("confidence_drop");
  if ((input.evidenceQuality || 0) >= 76 || answers.some((item) => item.metricPresent)) signals.push("strong_metrics");
  if ((input.ownershipScore || 0) >= 76 || answers.some((item) => item.ownershipPresent)) signals.push("clear_ownership");
  if ((input.structureScore || 0) >= 76) signals.push("strong_structure");
  if ((input.contradictions || []).length) signals.push("contradiction_risk");
  for (const answer of answers) for (const signal of inferSignalsFromAnswer(clean(answer.answer))) signals.push(signal);
  return Array.from(new Set(signals));
}

function buildInterviewRecord(input: PhaseCCareerBrainInput): CareerMemoryInterview {
  const signals = inferSignalsFromReport(input);
  return {
    id: `interview_${Date.now()}`,
    date: nowIso(),
    targetRole: clean(input.targetRole, "Target role"),
    companyName: clean(input.companyName, "General company"),
    score: clamp(input.overallScore || 0),
    trust: clamp(input.trustScore || 0),
    evidence: clamp(input.evidenceQuality || 0),
    ownership: clamp(input.ownershipScore || 0),
    structure: clamp(input.structureScore || 0),
    biggestBlocker: clean(input.biggestBlocker, "Missing measurable interview evidence"),
    recurringSignals: signals,
  };
}

export function updateCareerMemoryFromReport(input: PhaseCCareerBrainInput): PhaseCCareerBrain {
  const current = readCareerMemory();
  let next = current;
  for (const signal of inferSignalsFromReport(input)) next = recordCareerMemorySignal(next, signal);
  const record = buildInterviewRecord(input);
  const hasRealInterview = (input.answerInsights || []).some((item) => clean(item.answer) && !/not captured/i.test(clean(item.answer)));
  const interviewHistory = hasRealInterview ? [record, ...(next.interviewHistory || [])].slice(0, 12) : (next.interviewHistory || []);
  const roadmap = mergeRoadmap(next.roadmap || [], buildRoadmapFromInput(input, next));
  const companyTargets = unique([clean(input.companyName), ...(next.companyTargets || [])], 8);
  const roleTargets = unique([clean(input.targetRole), ...(next.roleTargets || [])], 8);
  next = { ...next, interviewHistory, roadmap, companyTargets, roleTargets, updatedAt: nowIso() };
  next = { ...next, strengths: buildCareerStrengths(next.patterns), risks: buildCareerRisks(next.patterns) };
  saveCareerMemory(next);
  return buildCareerBrain(input, next);
}

export function buildCareerBrain(input: PhaseCCareerBrainInput = {}, memory = readCareerMemory()): PhaseCCareerBrain {
  const normalized = normalizeMemory(memory);
  const probability = calculateInterviewProbability(input, normalized);
  const roadmap = mergeRoadmap(normalized.roadmap || [], buildRoadmapFromInput(input, normalized));
  const persistentWeaknesses = (normalized.patterns || [])
    .filter((item) => ["missing_metrics", "weak_ownership", "vague_answer", "rambling", "weak_structure", "confidence_drop", "contradiction_risk"].includes(item.signal))
    .slice(0, 5)
    .map((item) => ({ label: signalLabel(item.signal), count: item.count, coachLine: coachLineForSignal(item.signal) }));

  const recurringStrengths = unique([...(input.strengths || []), ...(normalized.strengths || [])], 5);
  const scoreTrend = (normalized.interviewHistory || []).slice(0, 6).reverse().map((item) => item.score);
  const trustTrend = (normalized.interviewHistory || []).slice(0, 6).reverse().map((item) => item.trust);
  const evidenceTrend = (normalized.interviewHistory || []).slice(0, 6).reverse().map((item) => item.evidence);
  const ownershipTrend = (normalized.interviewHistory || []).slice(0, 6).reverse().map((item) => item.ownership);

  return {
    memory: { ...normalized, roadmap },
    probability,
    persistentWeaknesses,
    recurringStrengths: recurringStrengths.length ? recurringStrengths : ["WorkZo will identify recurring strengths after more interview data."],
    crossFeatureActions: buildCrossFeatureActions(input, persistentWeaknesses),
    futureRecruiterChallenges: buildFutureRecruiterChallenges(input, persistentWeaknesses),
    roadmap,
    progress: {
      scoreTrend,
      trustTrend,
      evidenceTrend,
      ownershipTrend,
      latestSummary: buildProgressSummary(normalized, probability),
    },
  };
}

function calculateInterviewProbability(input: PhaseCCareerBrainInput, memory: WorkZoCareerMemory): InterviewProbability {
  const score = clamp(input.overallScore || 0);
  const trust = clamp(input.trustScore || 0);
  const evidence = clamp(input.evidenceQuality || 0);
  const ownership = clamp(input.ownershipScore || 0);
  const structure = clamp(input.structureScore || 0);
  const repeatedPenalty = (memory.patterns || []).reduce((sum, item) => {
    if (["missing_metrics", "weak_ownership", "vague_answer", "rambling", "weak_structure", "contradiction_risk"].includes(item.signal)) return sum + Math.min(8, item.count * 2);
    return sum;
  }, 0);
  const current = clamp((score * 0.28) + (trust * 0.22) + (evidence * 0.22) + (ownership * 0.16) + (structure * 0.12) - repeatedPenalty, 18, 92);
  const afterCv = clamp(current + (evidence < 75 ? 10 : 5) + (ownership < 70 ? 5 : 2), current, 96);
  const afterPrep = clamp(afterCv + (structure < 75 ? 7 : 3) + (trust < 75 ? 5 : 2), afterCv, 98);
  const reasons = [
    evidence < 70 ? "Evidence is still limiting your interview probability." : "Evidence quality is becoming a positive signal.",
    ownership < 70 ? "Ownership needs to be clearer before a recruiter fully trusts the story." : "Ownership signals support recruiter confidence.",
    structure < 70 ? "A tighter STAR structure can improve next-round readiness." : "Answer structure is helping the hiring signal.",
  ];
  return { current, afterCv, afterPrep, label: current >= 78 ? "Strong" : current >= 64 ? "Promising" : current >= 48 ? "Developing" : "Low", reasons };
}

function buildRoadmapFromInput(input: PhaseCCareerBrainInput, memory: WorkZoCareerMemory): CareerRoadmapItem[] {
  const items: CareerRoadmapItem[] = [];
  const now = nowIso();
  const add = (id: string, priority: string, title: string, action: string, source: CareerRoadmapItem["source"], estimatedGain: string) => {
    items.push({ id, priority, title, action, source, estimatedGain, completed: false, updatedAt: now });
  };
  if ((input.evidenceQuality || 0) < 75 || memory.patterns.some((p) => p.signal === "missing_metrics" && p.count >= 2)) add("add_metrics", "Priority 1", "Add measurable outcomes", "Improve CV bullets and interview stories with truthful numbers: %, time saved, tickets handled, users supported, quality improvement, or business impact.", "cv", "+8 to +12 pts");
  if ((input.ownershipScore || 0) < 72 || memory.patterns.some((p) => p.signal === "weak_ownership" && p.count >= 2)) add("clarify_ownership", "Priority 2", "Make ownership unmistakable", "Rewrite examples to show what you personally decided, handled, built, improved, or delivered.", "interview", "+5 to +9 pts");
  if ((input.structureScore || 0) < 72 || memory.patterns.some((p) => p.signal === "weak_structure" || p.signal === "rambling")) add("tighten_star", "Priority 3", "Use tighter STAR delivery", "Prepare 60-90 second answers with situation, task, action, result, and role connection.", "interview", "+4 to +8 pts");
  if ((input.contradictions || []).length || memory.patterns.some((p) => p.signal === "contradiction_risk")) add("fix_consistency", "Priority 4", "Resolve consistency risks", "Clarify timeline, role scope, skills, and leadership claims so CV, Job Assist, and interview answers tell the same story.", "global", "+4 to +7 pts");
  return items.length ? items : [
    { id: "keep_practicing", priority: "Priority 1", title: "Repeat one focused mock interview", action: "Run one more interview and intentionally use metrics, ownership, and concise STAR answers.", source: "interview", estimatedGain: "+3 to +6 pts", completed: false, updatedAt: now },
  ];
}

function mergeRoadmap(existing: CareerRoadmapItem[], incoming: CareerRoadmapItem[]) {
  const byId = new Map<string, CareerRoadmapItem>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, { ...(byId.get(item.id) || item), ...item, completed: byId.get(item.id)?.completed || false });
  return Array.from(byId.values()).slice(0, 8);
}

function buildCrossFeatureActions(input: PhaseCCareerBrainInput, weaknesses: Array<{ label: string; count: number }>): PhaseCCareerBrain["crossFeatureActions"] {
  const labels = weaknesses.map((w) => w.label.toLowerCase()).join(" ");
  const actions: PhaseCCareerBrain["crossFeatureActions"] = [];
  if (labels.includes("metric") || (input.evidenceQuality || 0) < 72) {
    actions.push({ feature: "Improve CV", action: "Add measurable impact to the top 3 role-relevant bullets before applying." });
    actions.push({ feature: "Job Assist", action: "Flag jobs where missing metrics could weaken your application readiness." });
  }
  if (labels.includes("ownership") || (input.ownershipScore || 0) < 72) {
    actions.push({ feature: "Cover Letter", action: "Use stronger first-person ownership language in the opening proof paragraph." });
    actions.push({ feature: "Interview", action: "Expect the recruiter to ask what you personally owned in the story." });
  }
  if (labels.includes("structure") || labels.includes("rambling") || (input.structureScore || 0) < 72) {
    actions.push({ feature: "Interview", action: "Practice shorter STAR answers and stop after the measurable result." });
  }
  return actions.length ? actions.slice(0, 6) : [{ feature: "Interview", action: "Keep practicing with one measurable result and one clear role connection in every answer." }];
}

function buildFutureRecruiterChallenges(input: PhaseCCareerBrainInput, weaknesses: Array<{ label: string; count: number }>) {
  const labels = weaknesses.map((w) => w.label.toLowerCase()).join(" ");
  const challenges: string[] = [];
  if (labels.includes("metric") || (input.evidenceQuality || 0) < 72) challenges.push("Last time your answer missed measurable impact. Can you quantify the result this time?");
  if (labels.includes("ownership") || (input.ownershipScore || 0) < 72) challenges.push("I want to separate team effort from your personal contribution. What exactly did you own?");
  if (labels.includes("vague")) challenges.push("That sounds broad. Give me one concrete example with context, action, and result.");
  if (labels.includes("contradiction")) challenges.push("I noticed a consistency risk earlier. Can you clarify the timeline and your exact role?");
  if (!challenges.length) challenges.push("Let’s raise the difficulty: give me one stronger example with proof, trade-offs, and outcome.");
  return challenges.slice(0, 5);
}

export function getTopCareerPattern(memory: WorkZoCareerMemory) {
  return memory.patterns[0] || null;
}

export function getCareerMemoryCoachLine(memory: WorkZoCareerMemory) {
  const top = getTopCareerPattern(memory);
  return top ? coachLineForSignal(top.signal) : "Work-O-Bot will learn your recurring interview patterns as you practice.";
}

function signalLabel(signal: CareerMemorySignal) {
  const labels: Record<CareerMemorySignal, string> = {
    missing_metrics: "Missing metrics",
    weak_ownership: "Weak ownership",
    vague_answer: "Vague answers",
    rambling: "Rambling",
    strong_metrics: "Strong metrics",
    clear_ownership: "Clear ownership",
    good_recovery: "Good recovery",
    confidence_drop: "Confidence drop",
    weak_structure: "Weak structure",
    strong_structure: "Strong structure",
    career_gap_risk: "Career gap risk",
    company_alignment: "Company alignment",
    contradiction_risk: "Contradiction risk",
  };
  return labels[signal] || signal;
}

function coachLineForSignal(signal: CareerMemorySignal) {
  switch (signal) {
    case "missing_metrics": return "Add numbers, scale, time saved, quality improvement, customer impact, or rough truthful estimates.";
    case "weak_ownership": return "Say what you personally handled, decided, built, improved, or delivered.";
    case "vague_answer": return "Replace broad claims with one concrete example from a real project, customer, or problem.";
    case "rambling": return "Keep the story within 60-90 seconds and stop after the result.";
    case "confidence_drop": return "Use firmer language and avoid maybe/probably when the answer is known.";
    case "weak_structure": return "Use STAR: situation, task, action, result, and role connection.";
    case "contradiction_risk": return "Align CV, job narrative, and interview claims before the next session.";
    case "strong_metrics": return "Metric usage is becoming a strength. Keep proof visible early in the answer.";
    case "clear_ownership": return "Ownership signals are improving. Keep saying exactly what you owned.";
    case "strong_structure": return "Your answer structure is becoming recruiter-ready.";
    case "good_recovery": return "You recover well after pressure. Use that confidence in harder follow-ups.";
    default: return "Work-O-Bot is learning your interview behavior.";
  }
}

function buildCareerStrengths(patterns: CareerMemoryPattern[]) {
  const strengths: string[] = [];
  if (patterns.some((item) => item.signal === "strong_metrics" && item.count >= 2)) strengths.push("You are starting to use measurable impact well.");
  if (patterns.some((item) => item.signal === "clear_ownership" && item.count >= 2)) strengths.push("You show clearer personal ownership in answers.");
  if (patterns.some((item) => item.signal === "strong_structure" && item.count >= 1)) strengths.push("Your answer structure is becoming easier for recruiters to follow.");
  if (patterns.some((item) => item.signal === "good_recovery" && item.count >= 1)) strengths.push("You can recover after recruiter pressure.");
  return strengths.slice(0, 5);
}

function buildCareerRisks(patterns: CareerMemoryPattern[]) {
  const risks: string[] = [];
  if (patterns.some((item) => item.signal === "missing_metrics" && item.count >= 2)) risks.push("Recruiters may doubt impact because metrics are often missing.");
  if (patterns.some((item) => item.signal === "weak_ownership" && item.count >= 2)) risks.push("Your personal contribution may not be clear enough.");
  if (patterns.some((item) => item.signal === "vague_answer" && item.count >= 2)) risks.push("Answers may sound too broad without concrete examples.");
  if (patterns.some((item) => item.signal === "rambling" && item.count >= 1)) risks.push("Long answers may reduce recruiter attention.");
  if (patterns.some((item) => item.signal === "contradiction_risk" && item.count >= 1)) risks.push("Inconsistent claims can reduce trust if not clarified.");
  return risks.slice(0, 5);
}

function buildProgressSummary(memory: WorkZoCareerMemory, probability: InterviewProbability) {
  const history = memory.interviewHistory || [];
  if (history.length >= 2) {
    const latest = history[0];
    const previous = history[1];
    const delta = latest.score - previous.score;
    if (delta > 0) return `Your latest interview improved by ${delta} points. Keep reinforcing the same evidence pattern.`;
    if (delta < 0) return `Your latest interview dropped by ${Math.abs(delta)} points. Focus the next attempt on ${latest.biggestBlocker.toLowerCase()}.`;
    return "Your score is stable. The next gain will come from stronger metrics and sharper ownership.";
  }
  return `Current interview probability is ${probability.current}%. WorkZo will become more personalized after more sessions.`;
}

// ── Premium Pro: cross-session opening callback ─────────────────────────────
// Builds the one line the recruiter says at the START of a new session that
// proves the coach remembers the last one. English-only by design, callers
// must skip it for non-English interviews. Returns "" when there is nothing
// real to reference, so it can be appended unconditionally.
function openingCallbackPhraseForSignal(signal: CareerMemorySignal): string {
  switch (signal) {
    case "missing_metrics": return "your answers kept missing measurable results";
    case "weak_ownership": return "it was not always clear what you personally owned";
    case "vague_answer": return "several answers stayed too general";
    case "rambling": return "your stories ran long past the result";
    case "confidence_drop": return "your delivery lost confidence under pressure";
    case "weak_structure": return "your answers were hard to follow without a clear structure";
    case "contradiction_risk": return "a few of your claims did not fully line up";
    case "career_gap_risk": return "the gaps in your timeline were left unexplained";
    case "strong_metrics":
    case "clear_ownership":
    case "strong_structure":
    case "good_recovery":
    case "company_alignment":
      return "";
    default:
      return "";
  }
}

export function buildWorkZoProOpeningCallback(memory: WorkZoCareerMemory): string {
  const last = (memory.interviewHistory || [])[0]; // history is newest-first
  const top = getTopCareerPattern(memory);
  if (!last && !top) return "";

  const weakPhrase = top ? openingCallbackPhraseForSignal(top.signal) : "";
  const roleRef = last?.targetRole ? ` for the ${last.targetRole} role` : "";

  if (weakPhrase && (top?.count || 0) >= 2) {
    return `Before we start, last time we spoke${roleRef}, ${weakPhrase}. I will be listening for that today.`;
  }

  if (last && last.score >= 70) {
    return `Before we start, your last session${roleRef} scored ${last.score}, and your evidence was getting stronger. Today I will push harder to see if it holds.`;
  }

  if (last?.biggestBlocker) {
    return `Before we start, last time, the biggest blocker was: ${last.biggestBlocker.replace(/\.$/, "")}. Let us see if that has changed.`;
  }

  return "";
}
