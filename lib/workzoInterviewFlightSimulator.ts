export type WorkZoSimulationPersona = {
  id: string;
  name: string;
  title: string;
  companyArchetype: string;
  senioritySignal: string;
  pressureStyle: string;
  focusAreas: string[];
  openingFrame: string;
  noteTakingStyle: string;
};

export type WorkZoWaitingRoomStep = {
  label: string;
  detail: string;
  tone: "neutral" | "reviewing" | "pressure" | "ready";
};

export type WorkZoDisruptionMemory = {
  agileClaimed?: boolean;
  waterfallClaimed?: boolean;
  metricAvoidedCount: number;
  ownershipAvoidedCount: number;
  vagueAnswerCount: number;
  strongEvidenceCount: number;
  priorClaims: string[];
};

export type WorkZoDisruptionResult = {
  shouldDisrupt: boolean;
  severity: "none" | "clarify" | "pushback" | "interrupt" | "contradiction";
  line: string;
  memoTag: string;
  whatTheyHeard: string;
};

const DEFAULT_PERSONAS: Record<string, WorkZoSimulationPersona> = {
  friendly_hr: {
    id: "friendly_hr",
    name: "Sarah Chen",
    title: "Senior Talent Partner",
    companyArchetype: "structured global company",
    senioritySignal: "calm but evidence-focused",
    pressureStyle: "warm first, then precise follow-ups",
    focusAreas: ["motivation", "communication", "role fit", "specific examples"],
    openingFrame: "Sarah has reviewed your resume and will look for clarity, ownership, and role fit.",
    noteTakingStyle: "Sarah is comparing your answer against the role requirements.",
  },
  sarah: {
    id: "sarah",
    name: "Sarah Chen",
    title: "Senior Talent Partner",
    companyArchetype: "structured global company",
    senioritySignal: "calm but evidence-focused",
    pressureStyle: "warm first, then precise follow-ups",
    focusAreas: ["motivation", "communication", "role fit", "specific examples"],
    openingFrame: "Sarah has reviewed your resume and will look for clarity, ownership, and role fit.",
    noteTakingStyle: "Sarah is comparing your answer against the role requirements.",
  },
  analytical_hiring_manager: {
    id: "analytical_hiring_manager",
    name: "Daniel Reed",
    title: "Senior Hiring Manager",
    companyArchetype: "metrics-driven product and operations team",
    senioritySignal: "direct and skeptical",
    pressureStyle: "drills into numbers, trade-offs, and individual ownership",
    focusAreas: ["metrics", "trade-offs", "technical reasoning", "decision quality"],
    openingFrame: "Daniel is reviewing your resume for measurable impact and seniority signal.",
    noteTakingStyle: "Daniel is checking whether your examples prove the level required for this role.",
  },
  daniel: {
    id: "daniel",
    name: "Daniel Reed",
    title: "Senior Hiring Manager",
    companyArchetype: "metrics-driven product and operations team",
    senioritySignal: "direct and skeptical",
    pressureStyle: "drills into numbers, trade-offs, and individual ownership",
    focusAreas: ["metrics", "trade-offs", "technical reasoning", "decision quality"],
    openingFrame: "Daniel is reviewing your resume for measurable impact and seniority signal.",
    noteTakingStyle: "Daniel is checking whether your examples prove the level required for this role.",
  },
  startup_recruiter: {
    id: "startup_recruiter",
    name: "Priya Raman",
    title: "Startup Talent Lead",
    companyArchetype: "fast-moving startup",
    senioritySignal: "fast, practical, outcome-driven",
    pressureStyle: "pushes for speed, ambiguity handling, and resourcefulness",
    focusAreas: ["speed", "initiative", "ambiguity", "business impact"],
    openingFrame: "Priya is checking whether you can operate with limited structure and still deliver outcomes.",
    noteTakingStyle: "Priya is looking for evidence that you can move without waiting for perfect instructions.",
  },
  priya: {
    id: "priya",
    name: "Priya Raman",
    title: "Startup Talent Lead",
    companyArchetype: "fast-moving startup",
    senioritySignal: "fast, practical, outcome-driven",
    pressureStyle: "pushes for speed, ambiguity handling, and resourcefulness",
    focusAreas: ["speed", "initiative", "ambiguity", "business impact"],
    openingFrame: "Priya is checking whether you can operate with limited structure and still deliver outcomes.",
    noteTakingStyle: "Priya is looking for evidence that you can move without waiting for perfect instructions.",
  },
  corporate_recruiter: {
    id: "corporate_recruiter",
    name: "Markus Weber",
    title: "Corporate Hiring Lead",
    companyArchetype: "process-oriented enterprise",
    senioritySignal: "structured and detail-conscious",
    pressureStyle: "tests consistency, documentation, and accountability",
    focusAreas: ["process", "risk", "documentation", "consistency"],
    openingFrame: "Markus is reviewing your resume for structure, reliability, and realistic ownership.",
    noteTakingStyle: "Markus is checking whether your examples are consistent and verifiable.",
  },
  markus: {
    id: "markus",
    name: "Markus Weber",
    title: "Corporate Hiring Lead",
    companyArchetype: "process-oriented enterprise",
    senioritySignal: "structured and detail-conscious",
    pressureStyle: "tests consistency, documentation, and accountability",
    focusAreas: ["process", "risk", "documentation", "consistency"],
    openingFrame: "Markus is reviewing your resume for structure, reliability, and realistic ownership.",
    noteTakingStyle: "Markus is checking whether your examples are consistent and verifiable.",
  },
};

function safe(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const INVALID_GREETING_NAME_RE =
  /\b(candidate|user|there|unknown|resume|cv|curriculum|profile|summary|experience|education|skills|projects|data|science|technical|business|customer|senior|junior|lead|head|chief|intern|graduate|bootcamp|school|college|university|institute|marketing|finance|product|digital|growth|success|manager|engineer|analyst|specialist|consultant|developer|coordinator|director|assistant|associate|officer|partner|talent|recruiter|hiring|support|science|technology|technologies|software|solutions|services)\b/i;

function safePersonName(value: unknown, fallback = "there"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  // Reject if it contains section-header or job-title words
  if (INVALID_GREETING_NAME_RE.test(raw)) return fallback;
  // Must only contain name characters
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(raw)) return fallback;
  // Extract just the first word (first name) for the greeting
  const firstName = raw.split(/\s+/)[0] || "";
  if (firstName.length < 2 || firstName.length > 24) return fallback;
  if (INVALID_GREETING_NAME_RE.test(firstName)) return fallback;
  return firstName;
}

function hasCompany(setup: Record<string, unknown>) {
  return safe(setup.targetCompany).length > 1;
}

export function getWorkZoSimulationPersona(setup: Record<string, unknown>): WorkZoSimulationPersona {
  const recruiterId = safe(setup.recruiterId, "friendly_hr").toLowerCase();

  // "german_corporate" is the app-wide id; this map historically used
  // "corporate_recruiter" for the same persona.
  const mapped =
    DEFAULT_PERSONAS[recruiterId] ||
    (recruiterId === "german_corporate" ? DEFAULT_PERSONAS.corporate_recruiter : undefined);

  // Persona not in this map (all premium/pro personas: Alex Chen, Zoe Park,
  // Victoria Stern, James Harrington, Aisha, David Kimura, ...). Previously
  // this silently fell back to friendly_hr, so the waiting-room countdown
  // showed "Sarah Chen" no matter which recruiter the user selected. Build
  // the persona from the recruiterName/recruiterTitle already present in the
  // setup instead, keeping friendly_hr only for behavioral defaults.
  const base: WorkZoSimulationPersona = mapped || {
    ...DEFAULT_PERSONAS.friendly_hr,
    id: recruiterId,
    name: safe(setup.recruiterName, DEFAULT_PERSONAS.friendly_hr.name),
    title: safe(setup.recruiterTitle, DEFAULT_PERSONAS.friendly_hr.title),
  };
  const targetCompany = safe(setup.targetCompany);

  if (!targetCompany) return base;

  return {
    ...base,
    companyArchetype: `${targetCompany} hiring environment`,
    openingFrame: `${base.name} is reviewing your resume against the ${targetCompany} role requirements. Expect follow-ups on evidence, metrics, and fit.`,
    noteTakingStyle: `${base.name} is checking whether your answer would survive a ${targetCompany} hiring debrief.`,
  };
}

export function buildWorkZoWaitingRoomSteps(setup: Record<string, unknown>): WorkZoWaitingRoomStep[] {
  const persona = getWorkZoSimulationPersona(setup);
  const role = safe(setup.targetRole, "this role");
  const company = safe(setup.targetCompany, "the target company");
  const cvPresent = Boolean(safe(setup.cvText));
  const jdPresent = Boolean(safe(setup.jobDescription));

  return [
    {
      label: "Interview room created",
      detail: `${persona.name}, ${persona.title}, is assigned for your ${role} simulation.`,
      tone: "neutral",
    },
    {
      label: "Resume review in progress",
      detail: cvPresent
        ? `${persona.name} is scanning your resume for ownership, evidence, and seniority signals.`
        : "Resume context is limited, so the interviewer will ask verification questions first.",
      tone: "reviewing",
    },
    {
      label: hasCompany(setup) ? `${company} pressure profile loaded` : "Hiring pressure profile loaded",
      detail: jdPresent
        ? `Questions will be adapted to the job description, likely gaps, and role expectations.`
        : `Questions will be adapted to the role using realistic recruiter pressure.` ,
      tone: "pressure",
    },
    {
      label: "Interviewer is ready",
      detail: `${persona.pressureStyle}. Be specific: situation, action, metric, outcome.`,
      tone: "ready",
    },
  ];
}

export function buildWorkZoPersonaOpeningQuestion(setup: Record<string, unknown>) {
  const persona = getWorkZoSimulationPersona(setup);
  const name = safePersonName(setup.candidateName, "there");
  const role = safe(setup.targetRole, "this role");
  const company = safe(setup.targetCompany);
  const companyClause = company ? ` at ${company}` : "";
  const focus = persona.focusAreas.slice(0, 3).join(", ");

  return `Hi ${name}. I’m ${persona.name}, ${persona.title}. I’ve reviewed your resume for the ${role}${companyClause}. I’ll focus on ${focus}, and I may pause you if an answer sounds vague or unsupported. To start, walk me through your background and why this role is the right next move.`;
}

export function createWorkZoDisruptionMemory(): WorkZoDisruptionMemory {
  return {
    agileClaimed: false,
    waterfallClaimed: false,
    metricAvoidedCount: 0,
    ownershipAvoidedCount: 0,
    vagueAnswerCount: 0,
    strongEvidenceCount: 0,
    priorClaims: [],
  };
}

function wordCount(answer: string) {
  return answer.trim().split(/\s+/).filter(Boolean).length;
}

function hasMetric(answer: string) {
  return /\d|%|percent|reduced|increased|improved|saved|hours?|days?|tickets?|users?|customers?|revenue|cost|sla|csat|nps|latency|conversion|retention/i.test(answer);
}

function hasOwnership(answer: string) {
  return /\b(i|my|me|personally|owned|led|built|created|implemented|designed|resolved|handled|debugged|analyzed|decided|delivered)\b/i.test(answer);
}

function isVague(answer: string) {
  return /\b(helped|worked on|involved in|various|many things|stuff|things|good|better|some tasks|responsible for|supported the team)\b/i.test(answer);
}

function hasTradeoff(answer: string) {
  return /\b(trade.?off|because|decided|alternative|instead|risk|constraint|limited|prioriti[sz]ed|chose|why)\b/i.test(answer);
}

export function updateWorkZoDisruptionMemory(memory: WorkZoDisruptionMemory, answer: string): WorkZoDisruptionMemory {
  const lower = answer.toLowerCase();
  const next = { ...memory, priorClaims: [...memory.priorClaims] };

  if (/\bagile|scrum|sprint|kanban\b/i.test(lower)) next.agileClaimed = true;
  if (/\bwaterfall|phase gate|fixed scope|big upfront\b/i.test(lower)) next.waterfallClaimed = true;
  if (!hasMetric(answer)) next.metricAvoidedCount += 1;
  if (!hasOwnership(answer)) next.ownershipAvoidedCount += 1;
  if (isVague(answer) || wordCount(answer) < 18) next.vagueAnswerCount += 1;
  if (hasMetric(answer) && hasOwnership(answer) && hasTradeoff(answer)) next.strongEvidenceCount += 1;

  const compactClaim = answer.trim().replace(/\s+/g, " ").slice(0, 160);
  if (compactClaim) next.priorClaims = [...next.priorClaims.slice(-7), compactClaim];

  return next;
}

export function analyzeWorkZoActiveDisruption(input: {
  answer: string;
  setup: Record<string, unknown>;
  memory: WorkZoDisruptionMemory;
  questionIndex: number;
}): WorkZoDisruptionResult {
  const { answer, memory, questionIndex } = input;
  const persona = getWorkZoSimulationPersona(input.setup);
  const words = wordCount(answer);
  const metric = hasMetric(answer);
  const ownership = hasOwnership(answer);
  const vague = isVague(answer);
  const tradeoff = hasTradeoff(answer);
  const lower = answer.toLowerCase();

  if (memory.agileClaimed && /\bwaterfall|fixed scope|big upfront\b/i.test(lower)) {
    return {
      shouldDisrupt: true,
      severity: "contradiction",
      line: `Let’s pause there. Earlier you positioned your work as agile, but this example sounds more waterfall or fixed-scope. Clarify the difference, and tell me what your actual role was in that process.`,
      memoTag: "Methodology inconsistency",
      whatTheyHeard: "Your operating style may be inconsistent or not clearly explained.",
    };
  }

  if (memory.waterfallClaimed && /\bagile|scrum|sprint|kanban\b/i.test(lower) && questionIndex > 1) {
    return {
      shouldDisrupt: true,
      severity: "contradiction",
      line: `I want to clarify something. You described a structured waterfall-style project earlier, but now you’re describing agile execution. Was this a hybrid process, or are you mixing two different examples?`,
      memoTag: "Process consistency check",
      whatTheyHeard: "The project context is unclear; the interviewer may question reliability of the example.",
    };
  }

  if (words > 95 && !metric) {
    return {
      shouldDisrupt: true,
      severity: "interrupt",
      line: `${persona.name.split(" ")[0]} would stop you here: the story is long, but I still don’t hear the measurable result. Give me one number, one before-and-after comparison, or one concrete business/customer outcome.`,
      memoTag: "Long answer without measurable impact",
      whatTheyHeard: "You may be over-explaining to hide weak evidence.",
    };
  }

  if (vague && !ownership) {
    return {
      shouldDisrupt: true,
      severity: "pushback",
      line: `Let’s make that sharper. Right now it sounds team-level. What exactly did you personally decide, build, fix, analyze, or own?`,
      memoTag: "Ownership unclear",
      whatTheyHeard: "Your individual contribution is not proven yet.",
    };
  }

  if (!metric && memory.metricAvoidedCount >= 1 && questionIndex > 1) {
    return {
      shouldDisrupt: true,
      severity: "pushback",
      line: `I’m going to push for evidence. What changed after your work, time saved, errors reduced, tickets closed, quality improved, revenue protected, or customer satisfaction improved?`,
      memoTag: "Repeated missing metrics",
      whatTheyHeard: "You understand the task, but the impact level is still unclear.",
    };
  }

  if (ownership && metric && !tradeoff && questionIndex > 2) {
    return {
      shouldDisrupt: true,
      severity: "clarify",
      line: `Good, that has ownership and impact. Now give me the trade-off. What did you choose not to do, and why was your approach the right one?`,
      memoTag: "Trade-off depth needed",
      whatTheyHeard: "The result is promising, but decision quality is not fully tested.",
    };
  }

  return {
    shouldDisrupt: false,
    severity: "none",
    line: "",
    memoTag: "No active disruption",
    whatTheyHeard: "Answer accepted for the next follow-up.",
  };
}
