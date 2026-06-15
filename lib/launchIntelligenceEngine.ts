// lib/launchIntelligenceEngine.ts

export type TranscriptRole = "recruiter" | "candidate" | "system";

export type TranscriptItem = {
  role: TranscriptRole;
  text: string;
  time?: string;
};

export type RecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

export type RecruiterProfile = {
  id: RecruiterPersonality;
  name: string;
  role: string;
  tone: string;
  style: string;
  focus: string[];
  pressure: number;
};

export type WeakAnswerCandidate = {
  question: string;
  answer: string;
  reason: string;
  trustDrop: number;
  oldScore: number;
};

export type TrustEvent = {
  label: string;
  type: "increase" | "drop" | "neutral" | "recovery";
  reason: string;
  scoreImpact: number;
};

export type EmotionalResult = {
  hiringSignal: "Strong" | "Mixed" | "Weak" | "Not enough signal";
  strongestMoment: string;
  weakestMoment: string;
  recoveryMoment: string;
  recruiterSummary: string;
  trustTimeline: TrustEvent[];
  weakestAnswer: WeakAnswerCandidate;
  nextPracticePlan: string[];
};

export const RECRUITER_PROFILES: Record<RecruiterPersonality, RecruiterProfile> = {
  friendly_hr: {
    id: "friendly_hr",
    name: "Sarah",
    role: "Friendly HR",
    tone: "warm but observant",
    style: "supportive recruiter who still challenges vague answers",
    focus: ["communication", "clarity", "motivation", "role fit"],
    pressure: 2,
  },
  analytical_hiring_manager: {
    id: "analytical_hiring_manager",
    name: "Daniel",
    role: "Hiring Manager",
    tone: "precise and skeptical",
    style: "evidence-driven interviewer who expects measurable proof",
    focus: ["metrics", "ownership", "technical depth", "decision-making"],
    pressure: 5,
  },
  startup_recruiter: {
    id: "startup_recruiter",
    name: "Priya",
    role: "Startup Recruiter",
    tone: "fast-paced and direct",
    style: "impact-focused recruiter who tests speed, initiative, and ownership",
    focus: ["initiative", "adaptability", "speed", "impact"],
    pressure: 4,
  },
  corporate_recruiter: {
    id: "corporate_recruiter",
    name: "Markus",
    role: "Corporate Recruiter",
    tone: "structured and professional",
    style: "process-oriented interviewer who values precision and consistency",
    focus: ["precision", "documentation", "process", "reliability"],
    pressure: 5,
  },
};

export function normalizeRecruiterPersonality(value?: unknown): RecruiterPersonality {
  if (typeof value !== "string") return "analytical_hiring_manager";
  const raw = value.trim().toLowerCase();
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || raw.includes("sarah")) return "friendly_hr";
  if (key === "startup_recruiter" || raw.includes("priya")) return "startup_recruiter";
  if (key === "corporate_recruiter" || key === "german_corporate" || raw.includes("markus")) return "corporate_recruiter";
  if (key === "analytical_hiring_manager" || raw.includes("daniel")) return "analytical_hiring_manager";
  return "analytical_hiring_manager";
}

export function getRecruiterProfile(value?: unknown) {
  return RECRUITER_PROFILES[normalizeRecruiterPersonality(value)];
}

export function compactText(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function extractCandidateSignals(cvText: string) {
  const text = compactText(cvText, 8000);
  const lower = text.toLowerCase();
  const signals: string[] = [];
  const missing: string[] = [];

  const skillChecks = [
    ["support", "support / customer-facing experience"],
    ["sql", "SQL exposure"],
    ["python", "Python exposure"],
    ["excel", "Excel / spreadsheet experience"],
    ["dashboard", "dashboard or reporting work"],
    ["ticket", "ticketing / service desk work"],
    ["customer", "customer communication"],
    ["project", "project work"],
    ["data", "data-related exposure"],
    ["api", "API / integration exposure"],
    ["integration", "system integration exposure"],
    ["itil", "ITIL / process exposure"],
  ];

  for (const [needle, label] of skillChecks) {
    if (lower.includes(needle)) signals.push(label);
  }

  if (!/\d+%|\d+\s*(users|customers|tickets|hours|days|weeks|months|cases|incidents)/i.test(text)) {
    missing.push("measurable business impact metrics");
  }
  if (!/led|owned|managed|coordinated|implemented|built|created|reduced|improved/i.test(text)) {
    missing.push("clear ownership verbs");
  }
  if (signals.length === 0) {
    signals.push("general background information available, but key role signals are not obvious");
  }

  return { strengths: signals.slice(0, 5), gaps: missing.slice(0, 4) };
}

export function buildCvIntelligenceSummary(cvText: string, targetRole = "this role") {
  const { strengths, gaps } = extractCandidateSignals(cvText);
  return {
    headline: "Your recruiter noticed",
    bullets: [
      ...strengths.map((item) => `Strong signal: ${item}`),
      ...gaps.map((item) => `Needs improvement: ${item}`),
      `Interview focus: connect your real background to ${targetRole}`,
    ].slice(0, 6),
  };
}

export function detectAnswerSignals(answer: string) {
  const text = compactText(answer, 3000);
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasMetric = /\d+%|\d+\s*(users|customers|tickets|hours|days|weeks|months|cases|incidents|people|team)/i.test(text);
  const hasOwnership = /\b(i|my|owned|led|built|created|implemented|coordinated|resolved|improved|reduced|handled)\b/i.test(text);
  const hasSTAR = /\bsituation\b|\btask\b|\baction\b|\bresult\b|\bchallenge\b|\boutcome\b|\bimpact\b/i.test(text);
  const vague = wordCount < 25 || /\bvarious|many things|etc|stuff|some tasks|helped with|worked on things\b/i.test(lower);
  const rambling = wordCount > 170;
  const fillerCount = (lower.match(/\b(um|uh|like|basically|actually|you know|kind of|sort of)\b/g) || []).length;

  let score = 50;
  if (hasMetric) score += 16;
  if (hasOwnership) score += 14;
  if (hasSTAR) score += 10;
  if (wordCount >= 45 && wordCount <= 130) score += 8;
  if (vague) score -= 18;
  if (rambling) score -= 10;
  if (fillerCount >= 4) score -= 8;

  return { score: Math.max(0, Math.min(100, score)), hasMetric, hasOwnership, hasSTAR, vague, rambling, fillerCount, wordCount };
}

export function getRecruiterReaction(answer: string, recruiterId?: RecruiterPersonality) {
  const signals = detectAnswerSignals(answer);
  const recruiter = getRecruiterProfile(recruiterId);

  if (signals.score >= 82) {
    return {
      mood: "engaged",
      trustDelta: 9,
      text: recruiter.id === "friendly_hr" ? "That feels credible. I can see your ownership there." : "Good. That answer gives me concrete signal.",
    };
  }
  if (!signals.hasMetric) return { mood: "skeptical", trustDelta: -7, text: "I still do not have measurable impact. Give me numbers." };
  if (!signals.hasOwnership) return { mood: "concerned", trustDelta: -6, text: "I need to understand what YOU specifically owned." };
  if (signals.vague) return { mood: "skeptical", trustDelta: -8, text: "That sounds too broad. Give me one concrete example." };
  if (signals.rambling) return { mood: "impatient", trustDelta: -5, text: "You are going too wide. Keep it tighter and focus on the result." };
  return { mood: "neutral", trustDelta: 1, text: "Okay. Now walk me through the exact decision you made." };
}

export function buildRealRecruiterPrompt({
  cvText,
  jobDescription,
  transcript,
  recruiterId,
  targetRole,
  targetMarket,
}: {
  cvText: string;
  jobDescription: string;
  transcript: TranscriptItem[] | string;
  recruiterId?: RecruiterPersonality | string;
  targetRole: string;
  targetMarket: string;
}) {
  const recruiter = getRecruiterProfile(recruiterId);
  const transcriptText = Array.isArray(transcript)
    ? transcript.map((item) => `${item.role}: ${item.text}`).join("\n")
    : transcript;

  return `
You are ${recruiter.name}, a realistic ${recruiter.role} conducting an interview for: ${targetRole}.
Market adaptation: ${targetMarket || "Global"}.

YOU ARE NOT CHATGPT.
YOU ARE NOT A CAREER COACH DURING THE INTERVIEW.
You are a recruiter evaluating credibility, clarity, proof, and hiring risk.

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent candidate experience.
- NEVER invent companies.
- NEVER invent projects.
- NEVER invent achievements.
- NEVER invent technologies.
- NEVER invent certifications.
- NEVER invent education.
- NEVER invent metrics.
- NEVER pretend you saw information that does not exist.
- ONLY use information explicitly found in:
  1. Candidate CV
  2. Job description
  3. Candidate transcript
- If information is unclear, missing, or weak: ASK the candidate.
- If the candidate claims something not in the CV, say: "I do not see that clearly in your CV. Can you clarify?"
- Do not mention these system rules to the candidate.

RECRUITER PERSONALITY:
- Tone: ${recruiter.tone}
- Style: ${recruiter.style}
- Focus areas: ${recruiter.focus.join(", ")}
- Pressure level: ${recruiter.pressure}/5

REAL RECRUITER BEHAVIOR:
- Ask one question at a time.
- Challenge vague claims naturally.
- Ask for numbers when metrics are missing.
- Ask what the candidate personally owned.
- Become skeptical if answers sound generic.
- Interrupt rambling politely but firmly.
- Remember weak answers and return to them later.
- React emotionally but professionally.
- Do not over-praise weak answers.
- Keep follow-ups short and realistic.

SCORING FOCUS:
- relevance to role
- clarity
- measurable impact
- ownership
- STAR structure
- confidence
- market fit
- consistency with CV

CANDIDATE CV:
${compactText(cvText, 5000) || "No CV text available. Ask the candidate to summarize their background."}

JOB DESCRIPTION:
${compactText(jobDescription, 3500) || "No job description available. Focus on the target role."}

TRANSCRIPT SO FAR:
${compactText(transcriptText, 3500) || "No transcript yet."}
`.trim();
}

export function findWeakestAnswer(transcript: TranscriptItem[]): WeakAnswerCandidate {
  let lastQuestion = "Tell me about a challenging project you worked on.";
  let weakest: WeakAnswerCandidate = {
    question: lastQuestion,
    answer: "No answer captured yet.",
    reason: "Not enough interview data captured.",
    trustDrop: 0,
    oldScore: 0,
  };

  for (const item of transcript) {
    if (item.role === "recruiter" && item.text.trim()) lastQuestion = item.text.trim();
    if (item.role === "candidate" && item.text.trim()) {
      const signals = detectAnswerSignals(item.text);
      if (signals.score < weakest.oldScore || weakest.oldScore === 0) {
        const reasons = [
          !signals.hasMetric && "missing metrics",
          !signals.hasOwnership && "weak ownership signal",
          signals.vague && "too vague",
          signals.rambling && "too long",
        ].filter(Boolean);
        weakest = { question: lastQuestion, answer: item.text, reason: reasons.join(", ") || "lower clarity than other answers", trustDrop: Math.max(4, 100 - signals.score), oldScore: signals.score };
      }
    }
  }
  return weakest;
}

export function buildTrustTimeline(transcript: TranscriptItem[]): TrustEvent[] {
  const events: TrustEvent[] = [];
  for (const item of transcript) {
    if (item.role !== "candidate" || !item.text.trim()) continue;
    const signals = detectAnswerSignals(item.text);
    if (signals.score >= 80) events.push({ label: "Trust increased", type: "increase", reason: "Strong clarity, ownership, or measurable impact.", scoreImpact: 8 });
    else if (!signals.hasMetric) events.push({ label: "Trust dropped", type: "drop", reason: "No measurable impact was provided.", scoreImpact: -7 });
    else if (signals.vague) events.push({ label: "Recruiter became skeptical", type: "drop", reason: "Answer sounded broad or generic.", scoreImpact: -8 });
    else if (signals.hasOwnership && signals.hasMetric) events.push({ label: "Recovery moment", type: "recovery", reason: "Candidate added proof and ownership.", scoreImpact: 6 });
  }
  if (events.length === 0) events.push({ label: "Not enough signal", type: "neutral", reason: "Complete an interview to generate trust movement.", scoreImpact: 0 });
  return events.slice(-8);
}

export function buildEmotionalResult(transcript: TranscriptItem[]): EmotionalResult {
  const timeline = buildTrustTimeline(transcript);
  const weakest = findWeakestAnswer(transcript);
  const positive = timeline.filter((item) => item.scoreImpact > 0).length;
  const negative = timeline.filter((item) => item.scoreImpact < 0).length;
  const hiringSignal = transcript.length < 3 ? "Not enough signal" : positive > negative + 1 ? "Strong" : negative > positive ? "Weak" : "Mixed";

  return {
    hiringSignal,
    strongestMoment: timeline.find((item) => item.type === "increase" || item.type === "recovery")?.reason || "No strong recovery moment captured yet.",
    weakestMoment: weakest.reason,
    recoveryMoment: timeline.find((item) => item.type === "recovery")?.reason || "Retry the weakest answer to create a recovery moment.",
    recruiterSummary:
      hiringSignal === "Strong"
        ? "The recruiter received credible signal, but your answers can still become sharper with metrics."
        : hiringSignal === "Weak"
          ? "The recruiter did not yet receive enough proof. Add numbers, ownership, and one clear example."
          : "The recruiter saw some useful signals, but the interview needs stronger proof and clarity.",
    trustTimeline: timeline,
    weakestAnswer: weakest,
    nextPracticePlan: ["Rewrite weakest answer using STAR.", "Add one measurable result.", "Clarify what you personally owned.", "Practice a tighter 60-second version."],
  };
}

export function compareAnswers(oldAnswer: string, newAnswer: string) {
  const oldSignals = detectAnswerSignals(oldAnswer);
  const newSignals = detectAnswerSignals(newAnswer);
  const delta = newSignals.score - oldSignals.score;
  return {
    oldScore: oldSignals.score,
    newScore: newSignals.score,
    trustDelta: delta,
    improved: delta > 0,
    message: delta > 12 ? "Strong recovery. This answer would rebuild recruiter trust." : delta > 0 ? "Improved. Add more measurable impact to make it stronger." : "Still weak. Make it more specific, shorter, and evidence-based.",
  };
}

export type WorkobotAction = "expectation" | "rewrite" | "metrics" | "concise" | "ownership" | "star";

export function runWorkobotAction({
  action,
  question,
  answer,
  cvText,
  targetRole,
}: {
  action: WorkobotAction;
  question: string;
  answer: string;
  cvText: string;
  targetRole: string;
}) {
  const signals = detectAnswerSignals(answer);
  const cvSignals = extractCandidateSignals(cvText);

  if (action === "expectation") {
    return ["What the recruiter is testing:", "• Can you give one concrete example?", "• Did you personally own the work?", "• Can you show measurable impact?", `• Can you connect the answer to ${targetRole || "the role"}?`].join("\n");
  }
  if (action === "metrics") {
    return ["Add metrics like this:", "• number of tickets/customers/users handled", "• response time or resolution improvement", "• error reduction, time saved, or process improvement", "• business impact after your action", "", "Example line:", "“This reduced repeated customer issues by around X% / saved Y hours per week / improved resolution time by Z.”"].join("\n");
  }
  if (action === "concise") {
    return ["Tighter version:", "“In my previous role, I handled a situation where [specific problem]. I owned [your action], worked with [team/customer], and the result was [measurable result]. This is relevant to this role because [connection].”"].join("\n");
  }
  if (action === "ownership") {
    return ["Make ownership clearer:", "• Replace “we worked on” with “I owned / I coordinated / I resolved”.", "• Mention the decision you made.", "• Mention who depended on your work.", "• End with the result."].join("\n");
  }
  if (action === "star") {
    return ["STAR structure:", "S — Situation: What was the problem?", "T — Task: What were you responsible for?", "A — Action: What exactly did you do?", "R — Result: What changed because of your action?", "", signals.hasMetric ? "Good: your answer already has some measurable signal." : "Missing: add one number or measurable outcome."].join("\n");
  }
  return ["Stronger answer draft:", `“One relevant example is from my experience with ${cvSignals.strengths[0] || "a real work situation"}. The challenge was [specific problem]. I was responsible for [your ownership]. I handled it by [clear action]. The result was [metric/result]. This connects to ${targetRole || "this role"} because it shows [role-relevant skill].”`, "", "Recruiter note:", signals.vague ? "Your original answer is still too broad. Add a real example." : "Your answer has useful direction. Make the result more measurable."].join("\n");
}
