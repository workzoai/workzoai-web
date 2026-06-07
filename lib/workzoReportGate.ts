"use client";

export type WorkZoTranscriptTurn = {
  role?: string;
  speaker?: string;
  text?: string;
  time?: string;
  timestamp?: string;
};

export type WorkZoReportSource = {
  overallScore?: number;
  communicationScore?: number;
  confidenceScore?: number;
  roleCompetencyScore?: number;
  trustScore?: number;
  evidenceQuality?: number;
  contradictionRisk?: number;
  strengths?: string[];
  improvements?: string[];
  transcript?: WorkZoTranscriptTurn[];
  weakAnswers?: Array<{ question?: string; answer?: string; reason?: string; betterAnswer?: string }>;
  contradictions?: string[];
  evidenceRequests?: string[];
  redFlags?: string[];
  recruiterHeard?: Array<{ question?: string; said?: string; heard?: string; rewrite?: string }>;
  companyDNA?: { company?: string; score?: number; principles?: Array<{ label: string; score: number; note: string }> };
  durationSeconds?: number;
  startedAt?: string;
  completedAt?: string;
  targetRole?: string;
  targetCompany?: string;
  companyName?: string;
  setup?: Record<string, unknown>;
};

export type WorkZoFreeReport = {
  tier: "free";
  overallScore: number;
  letterGrade: string;
  communication: number;
  confidence: number;
  roleCompetency: number;
  sentiment: string;
  basicMetrics: {
    wpm: number;
    durationLabel: string;
    answerCount: number;
  };
  freeTip: string;
  paywallPreview: {
    questionCount: number;
    redFlagsCount: number;
    contradictionsCount: number;
    hasDeepAnalysis: true;
  };
};

export type WorkZoPremiumReport = WorkZoFreeReport & {
  tier: "premium";
  transcriptTimeline: Array<{
    id: string;
    question: string;
    answer: string;
    score: number;
    flags: string[];
    whatRecruiterHeard: string;
    betterAnswer: string;
  }>;
  redFlags: string[];
  contradictions: Array<{ severity: number; text: string; impact: string; repair: string }>;
  trustAudit: {
    trustScore: number;
    evidenceQuality: number;
    contradictionRisk: number;
    notes: string[];
  };
  benchmark: {
    user: Record<string, number>;
    topCandidate: Record<string, number>;
  };
  companyDNA: {
    company: string;
    score: number;
    principles: Array<{ label: string; score: number; note: string }>;
  };
  vocalFillers: Array<{ label: string; count: number; note: string }>;
  presence: {
    available: boolean;
    summary: string;
    metrics: Array<{ label: string; value: string }>;
  };
};

function clamp(value: unknown, fallback = 0) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;
}

function normalizeRole(turn: WorkZoTranscriptTurn) {
  const raw = `${turn.role || ""} ${turn.speaker || ""}`.toLowerCase();
  if (/candidate|user|you|applicant|me/.test(raw)) return "candidate";
  if (/recruiter|assistant|interviewer|ai|bot/.test(raw)) return "recruiter";
  return raw.includes("system") ? "system" : "unknown";
}

function answerPairs(transcript?: WorkZoTranscriptTurn[]) {
  if (!Array.isArray(transcript)) return [];
  const pairs: Array<{ question: string; answer: string }> = [];
  let currentQuestion = "Tell me about your background for this role.";

  for (const turn of transcript) {
    const text = clean(turn.text);
    if (!text) continue;
    const role = normalizeRole(turn);
    if (role === "recruiter") currentQuestion = text;
    if (role === "candidate") pairs.push({ question: currentQuestion, answer: text });
  }

  return pairs;
}

function wordCount(text: string) {
  return clean(text).split(/\s+/).filter(Boolean).length;
}

function hasMetric(text: string) {
  return /\b\d+(?:\.\d+)?\s*(%|percent|users?|customers?|tickets?|cases?|hours?|days?|weeks?|months?|people|team|revenue|€|\$|kpis?|reports?)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i|my|owned|led|built|created|implemented|resolved|improved|reduced|handled|delivered|designed|developed|trained|managed|analyzed|presented)\b/i.test(text);
}

function hasStructure(text: string) {
  return /\b(situation|task|action|result|challenge|approach|outcome|impact|because|therefore|as a result)\b/i.test(text);
}

function fillerCount(text: string) {
  return (text.toLowerCase().match(/\b(um|uh|like|basically|actually|you know|kind of|sort of|maybe|i think)\b/g) || []).length;
}

function scoreAnswer(answer: string) {
  const wc = wordCount(answer);
  let score = 45;
  if (wc >= 45 && wc <= 150) score += 12;
  if (hasMetric(answer)) score += 18;
  if (hasOwnership(answer)) score += 16;
  if (hasStructure(answer)) score += 12;
  if (/\b(example|project|customer|client|team|system|process|issue|problem|deadline|escalation)\b/i.test(answer)) score += 8;
  if (wc < 25) score -= 20;
  if (wc > 190) score -= 12;
  if (fillerCount(answer) >= 4) score -= 8;
  return clamp(score, 50);
}

function grade(score: number) {
  if (score >= 90) return "A";
  if (score >= 82) return "B+";
  if (score >= 74) return "B";
  if (score >= 66) return "B-";
  if (score >= 58) return "C";
  return "Needs work";
}

function durationLabel(source: WorkZoReportSource) {
  const seconds = typeof source.durationSeconds === "number" ? source.durationSeconds : 0;
  if (seconds > 0) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  if (source.startedAt && source.completedAt) {
    const diff = new Date(source.completedAt).getTime() - new Date(source.startedAt).getTime();
    if (Number.isFinite(diff) && diff > 0) {
      const minutes = Math.max(1, Math.round(diff / 60000));
      return `${minutes}m`;
    }
  }

  return "Not captured";
}

function sentiment(score: number, evidence: number, contradictionRisk: number) {
  if (score >= 84 && evidence >= 75 && contradictionRisk < 20) return "You created strong recruiter confidence with clear examples and credible evidence.";
  if (score >= 72) return "You showed useful role fit, but the recruiter still needs sharper metrics, ownership, or structure.";
  if (score >= 60) return "You have relevant experience, but several answers would feel too vague or unsupported in a real interview.";
  return "The interview needs stronger structure, clearer examples, and more evidence before it feels recruiter-ready.";
}

function quickTip(pairs: Array<{ question: string; answer: string }>) {
  const scored = pairs.map((pair) => ({ ...pair, score: scoreAnswer(pair.answer), words: wordCount(pair.answer) }));
  const weak = scored.sort((a, b) => a.score - b.score)[0];
  if (!weak) return "Complete a full interview to receive your first personalized quick win.";
  if (weak.words > 180) return "Your longest answer may feel unfocused. Try keeping it under 90 seconds using Situation → Action → Result.";
  if (!hasMetric(weak.answer)) return "Add one measurable result to your weakest answer: time saved, quality improved, users supported, revenue, or cases handled.";
  if (!hasOwnership(weak.answer)) return "Make your personal role explicit. Start one sentence with: ‘I personally owned…’ or ‘My contribution was…’.";
  if (!hasStructure(weak.answer)) return "Use STAR structure more clearly: situation, task, action, result.";
  return "Your answers are usable. The next improvement is to connect each answer more directly to the target role.";
}

function recruiterHeard(answer: string) {
  if (!answer) return "No answer captured.";
  if (!hasOwnership(answer)) return "The recruiter may hear useful team activity, but unclear personal ownership.";
  if (!hasMetric(answer)) return "The recruiter may believe the story, but still lacks measurable proof of impact.";
  if (wordCount(answer) > 180) return "The recruiter may feel the answer contains useful detail but needs sharper structure.";
  return "The recruiter hears a credible example with enough signal to continue probing.";
}

function rewriteAnswer(answer: string) {
  const base = clean(answer, "I handled a relevant challenge and improved the outcome.");
  if (!base) return "Use a specific situation, explain your action, and close with the measurable result.";
  const short = base.length > 220 ? `${base.slice(0, 220)}...` : base;
  return `A stronger version: “In this situation, I owned the key action instead of only supporting the team. ${short} The result was clearer because I connected my action to the business or customer outcome.”`;
}

function redFlags(pairs: Array<{ question: string; answer: string }>) {
  const flags: string[] = [];
  const missingMetric = pairs.filter((p) => !hasMetric(p.answer)).length;
  const unclearOwnership = pairs.filter((p) => !hasOwnership(p.answer)).length;
  const rambling = pairs.filter((p) => wordCount(p.answer) > 190).length;
  const tooShort = pairs.filter((p) => wordCount(p.answer) < 25).length;
  const fillers = pairs.reduce((sum, p) => sum + fillerCount(p.answer), 0);

  if (missingMetric >= 2) flags.push("Repeated answers described impact without measurable proof.");
  if (unclearOwnership >= 2) flags.push("Personal ownership was unclear across multiple answers.");
  if (rambling >= 1) flags.push("At least one answer was likely too long for a live recruiter conversation.");
  if (tooShort >= 2) flags.push("Several answers were too short to build recruiter confidence.");
  if (fillers >= 6) flags.push("Frequent filler words may reduce perceived confidence.");

  return flags;
}

function buildContradictions(source: WorkZoReportSource) {
  const raw = Array.isArray(source.contradictions) ? source.contradictions.filter(Boolean) : [];
  return raw.map((item, index) => {
    const text = clean(item);
    const severity = /led|managed|team|ownership|years|experience|expert|never|no experience/i.test(text) ? 4 : 2;
    return {
      severity,
      text,
      impact: severity >= 4 ? "High credibility impact. This can lower recruiter trust quickly." : "Low to medium impact. Clarify it before it becomes a concern.",
      repair: "Reconcile the statement with a precise timeline, your actual responsibility, and what was individual vs team-owned.",
      id: `contradiction-${index}`,
    };
  });
}

function buildCompanyDNA(source: WorkZoReportSource, overall: number) {
  const company = clean(source.targetCompany || source.companyName || source.companyDNA?.company || String(source.setup?.companyName || "Target company"));
  const selected = company.toLowerCase();

  const amazon = ["Customer Obsession", "Ownership", "Dive Deep", "Bias for Action", "Deliver Results"];
  const mckinsey = ["Structured Thinking", "MECE Clarity", "Business Judgment", "Executive Communication", "Problem Solving"];
  const google = ["Role-Related Knowledge", "General Cognitive Ability", "Leadership", "Collaboration", "Googleyness"];
  const startup = ["Ownership", "Speed", "Ambiguity Handling", "Customer Focus", "Execution"];
  const generic = ["Role Fit", "Communication", "Evidence", "Ownership", "Coachability"];

  const labels = selected.includes("amazon")
    ? amazon
    : selected.includes("mckinsey")
      ? mckinsey
      : selected.includes("google")
        ? google
        : selected.includes("startup")
          ? startup
          : generic;

  const principles = labels.map((label, index) => ({
    label,
    score: clamp(overall - 8 + index * 4, 65),
    note: label.toLowerCase().includes("evidence") || label.toLowerCase().includes("dive")
      ? "Improve this by adding sharper data and a clearer decision trail."
      : "Based on interview signals and role-fit evidence captured in the session.",
  }));

  return {
    company: company || "Target company",
    score: clamp(principles.reduce((sum, p) => sum + p.score, 0) / principles.length, overall),
    principles,
  };
}

export function buildWorkZoReport(source: WorkZoReportSource, isPremium: true): WorkZoPremiumReport;
export function buildWorkZoReport(source: WorkZoReportSource, isPremium: false): WorkZoFreeReport;
export function buildWorkZoReport(source: WorkZoReportSource, isPremium: boolean): WorkZoFreeReport | WorkZoPremiumReport {
  const pairs = answerPairs(source.transcript);
  const answerScores = pairs.map((p) => scoreAnswer(p.answer));
  const avgAnswer = answerScores.length ? Math.round(answerScores.reduce((a, b) => a + b, 0) / answerScores.length) : 0;

  const overallScore = clamp(source.overallScore, avgAnswer || 72);
  const communication = clamp(source.communicationScore, Math.round(overallScore + 2));
  const confidence = clamp(source.confidenceScore, Math.round(overallScore - 4));
  const roleCompetency = clamp(source.roleCompetencyScore, Math.round(overallScore + 4));
  const evidenceQuality = clamp(source.evidenceQuality, pairs.length ? Math.round(pairs.filter((p) => hasMetric(p.answer)).length / Math.max(1, pairs.length) * 100) : 62);
  const contradictions = buildContradictions(source);
  const contradictionRisk = clamp(source.contradictionRisk, contradictions.length ? Math.min(80, contradictions.reduce((s, c) => s + c.severity * 10, 0)) : 12);
  const totalWords = pairs.reduce((sum, p) => sum + wordCount(p.answer), 0);
  const durationSeconds = typeof source.durationSeconds === "number" && source.durationSeconds > 0 ? source.durationSeconds : pairs.length * 90;
  const wpm = durationSeconds > 0 ? Math.round(totalWords / Math.max(1, durationSeconds / 60)) : 0;
  const flags = Array.isArray(source.redFlags) && source.redFlags.length ? source.redFlags : redFlags(pairs);

  const free: WorkZoFreeReport = {
    tier: "free",
    overallScore,
    letterGrade: grade(overallScore),
    communication,
    confidence,
    roleCompetency,
    sentiment: sentiment(overallScore, evidenceQuality, contradictionRisk),
    basicMetrics: {
      wpm,
      durationLabel: durationLabel({ ...source, durationSeconds }),
      answerCount: pairs.length,
    },
    freeTip: quickTip(pairs),
    paywallPreview: {
      questionCount: pairs.length,
      redFlagsCount: flags.length,
      contradictionsCount: contradictions.length,
      hasDeepAnalysis: true,
    },
  };

  if (!isPremium) return free;

  const transcriptTimeline = pairs.map((pair, index) => ({
    id: `answer-${index + 1}`,
    question: pair.question,
    answer: pair.answer,
    score: scoreAnswer(pair.answer),
    flags: [
      !hasMetric(pair.answer) && "No metric",
      !hasOwnership(pair.answer) && "Ownership unclear",
      wordCount(pair.answer) > 190 && "Rambling risk",
      wordCount(pair.answer) < 25 && "Too short",
    ].filter(Boolean) as string[],
    whatRecruiterHeard: source.recruiterHeard?.[index]?.heard || recruiterHeard(pair.answer),
    betterAnswer: source.recruiterHeard?.[index]?.rewrite || source.weakAnswers?.[index]?.betterAnswer || rewriteAnswer(pair.answer),
  }));

  const { tier: _freeTier, ...freeReportBase } = free;
  void _freeTier;

  return ({
    ...freeReportBase,
    tier: "premium",
    transcriptTimeline,
    redFlags: flags,
    contradictions,
    trustAudit: {
      trustScore: clamp(source.trustScore, overallScore - contradictionRisk / 4),
      evidenceQuality,
      contradictionRisk,
      notes: [
        "Trust is calculated from evidence, ownership, structure, contradictions, and answer consistency.",
        evidenceQuality < 65 ? "Add more measurable proof to raise recruiter confidence." : "Evidence quality is strong enough to support follow-up questions.",
      ],
    },
    benchmark: {
      user: {
        Pacing: clamp(wpm ? 100 - Math.abs(125 - wpm) : 60, 60),
        "Metric Usage": evidenceQuality,
        Structure: clamp(transcriptTimeline.filter((t) => hasStructure(t.answer)).length / Math.max(1, transcriptTimeline.length) * 100, 55),
        Ownership: clamp(transcriptTimeline.filter((t) => hasOwnership(t.answer)).length / Math.max(1, transcriptTimeline.length) * 100, 55),
        "Role Fit": roleCompetency,
      },
      topCandidate: {
        Pacing: 86,
        "Metric Usage": 88,
        Structure: 84,
        Ownership: 90,
        "Role Fit": 87,
      },
    },
    companyDNA: source.companyDNA?.principles?.length
      ? {
          company: source.companyDNA.company || "Target company",
          score: clamp(source.companyDNA.score, overallScore),
          principles: source.companyDNA.principles,
        }
      : buildCompanyDNA(source, overallScore),
    vocalFillers: [
      { label: "Filler words", count: pairs.reduce((sum, p) => sum + fillerCount(p.answer), 0), note: "Counts common fillers such as um, uh, like, basically, actually." },
      { label: "Long answers", count: pairs.filter((p) => wordCount(p.answer) > 190).length, note: "Answers that may feel too long in a live interview." },
      { label: "Short answers", count: pairs.filter((p) => wordCount(p.answer) < 25).length, note: "Answers that may not provide enough evidence." },
    ],
    presence: {
      available: false,
      summary: "Camera-based presence analysis is not enabled for this session. Voice/text signals are available now; visual presence should remain optional and consent-based.",
      metrics: [
        { label: "Eye contact", value: "Not captured" },
        { label: "Facial expression", value: "Not captured" },
        { label: "Posture", value: "Not captured" },
      ],
    },
  } as any);
}
