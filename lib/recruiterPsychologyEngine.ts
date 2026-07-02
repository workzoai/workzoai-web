export type RecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

export type RecruiterMood =
  | "neutral"
  | "interested"
  | "skeptical"
  | "impatient"
  | "impressed"
  | "concerned"
  | "clarifying"
  | "interrupting";

export type RecruiterMemory = {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  risks: string[];
  contradictions: string[];
  missingMetrics: string[];
  vagueAnswers: string[];
  repeatedPatterns: string[];
  confidenceTrend: number[];
  trustHistory: number[];
  recruiterMoodHistory: RecruiterMood[];
};

export type RecruiterScore = {
  confidence: number;
  clarity: number;
  relevance: number;
  evidence: number;
  structure: number;
};

export type RecruiterProfile = {
  key: RecruiterPersonality;
  name: string;
  role: string;
  voiceGender: "female" | "male";
  pacing: "calm" | "balanced" | "fast" | "structured";
  pressureBias: number;
  interruptionBias: number;
  behaviorPrompt: string;
  questionFocus: string[];
};

export type PsychologyInput = {
  answer: string;
  currentQuestion?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  previousMemory?: Partial<RecruiterMemory>;
  previousTrust?: number;
  previousPressure?: number;
  previousScores?: Partial<RecruiterScore>;
  transcript?: Array<{ role?: string; text?: string }>;
};

export type PsychologyResult = {
  recruiterProfile: RecruiterProfile;
  memory: RecruiterMemory;
  score: RecruiterScore;
  recruiterTrust: number;
  pressure: number;
  mood: RecruiterMood;
  interruption: {
    shouldInterrupt: boolean;
    interruptionMessage: string;
    severity: "low" | "medium" | "high";
  };
  contradictions: string[];
  psychologicalInsight: string;
  nextQuestionSeed: string;
  recruiterReaction: string;
};

const recruiterProfiles: Record<RecruiterPersonality, RecruiterProfile> = {
  friendly_hr: {
    key: "friendly_hr",
    name: "Sarah",
    role: "Friendly HR",
    voiceGender: "female",
    pacing: "calm",
    pressureBias: -10,
    interruptionBias: -14,
    questionFocus: ["communication", "teamwork", "motivation", "culture fit", "conflict handling", "values alignment"],
    behaviorPrompt:
      "You are Sarah, a warm and people-focused HR recruiter. Your job is to make the candidate feel comfortable while still assessing fit. " +
      "Ask about communication style, how they work in teams, what motivates them, and how they handle conflict or feedback. " +
      "When answers are vague, prompt gently — never aggressively. " +
      "Say things like 'That's helpful, can you tell me a bit more about...' or 'How did that make you feel?' " +
      "You care about culture fit and emotional intelligence as much as skills. " +
      "You do NOT push hard for metrics — you accept qualitative outcomes. " +
      "You are the least interruptive recruiter. Let the candidate finish before responding. " +
      "Never say 'I need proof' or 'Give me a number'. Instead ask 'How did the team respond to that?' or 'What was the impact on the people involved?'",
  },
  analytical_hiring_manager: {
    key: "analytical_hiring_manager",
    name: "Daniel",
    role: "Hiring Manager",
    voiceGender: "male",
    pacing: "balanced",
    pressureBias: 10,
    interruptionBias: 10,
    questionFocus: ["measurable impact", "personal ownership", "technical depth", "business value", "evidence and proof"],
    behaviorPrompt:
      "You are Daniel, an analytical hiring manager who evaluates candidates on evidence, not claims. " +
      "You are direct, serious, and evidence-driven. You probe every claim for metrics, scope, and personal ownership. " +
      "When a candidate says 'we improved X', you immediately ask: 'What was your specific role in that?' " +
      "When they claim success, ask: 'How did you measure it? What was the baseline?' " +
      "You are focused on business impact: revenue, cost, efficiency, retention, or customer outcomes. " +
      "You challenge vague answers with: 'I need more than that. Give me one concrete example with a result.' " +
      "You ask technical depth questions relevant to the role. " +
      "You are not unkind, but you are not easily impressed. A strong answer gets: 'Good — now go deeper.'",
  },
  startup_recruiter: {
    key: "startup_recruiter",
    name: "Priya",
    role: "Startup Recruiter",
    voiceGender: "female",
    pacing: "fast",
    pressureBias: 16,
    interruptionBias: 18,
    questionFocus: ["speed of execution", "ownership and initiative", "ambiguity handling", "adaptability", "what you built from scratch"],
    behaviorPrompt:
      "You are Priya, a fast-moving startup recruiter who values execution over credentials. " +
      "You move fast. You interrupt if the candidate is rambling. You have no patience for corporate language. " +
      "You care about: What did YOU build from scratch? How fast did you ship? What did you do when the plan broke? " +
      "When answers are slow or vague, cut in with: 'I'm going to stop you — what actually shipped?' or 'Skip the context, what did you personally do?' " +
      "You test for ownership aggressively: 'Were you the decision-maker or were you supporting someone?' " +
      "You reward candidates who say 'I launched X in 3 weeks without a team' more than 'we delivered a project'. " +
      "High pressure. High energy. You treat the interview like a pitch — the candidate has 30 seconds to prove relevance. " +
      "You ask things like: 'If we hired you tomorrow, what would you do in week one?' and 'What's the fastest you've ever shipped something important?'",
  },
  corporate_recruiter: {
    key: "corporate_recruiter",
    name: "Markus",
    role: "Corporate Recruiter",
    voiceGender: "male",
    pacing: "structured",
    pressureBias: 3,
    interruptionBias: 2,
    questionFocus: ["governance and compliance", "documentation and audit trails", "hierarchy and stakeholder alignment", "risk management", "process adherence", "cross-functional approval processes"],
    behaviorPrompt:
      "You are Markus, a structured corporate recruiter focused on compliance, governance, and process integrity. " +
      "You are formal and methodical. You do not rush. You follow a structured question sequence. " +
      "You care about: Did they follow the right process? Did they escalate properly? Did they document their decisions? Were all stakeholders informed and aligned? " +
      "You ask questions like: 'Who signed off on that decision?' and 'How did you ensure audit compliance?' and 'What was the approval process?' " +
      "You are explicitly NOT focused on speed or disruption — you value reliability, predictability, and risk mitigation. " +
      "When a candidate says they moved fast or bypassed process, you raise an eyebrow: 'Was that escalated appropriately?' " +
      "You are polite and formal. You say 'Could you walk me through the governance process for that?' not 'Give me a number'. " +
      "You are interested in seniority hierarchy, committee decisions, risk registers, change management, and compliance frameworks. " +
      "This makes you DISTINCT from Daniel (who focuses on metrics and outcomes) — you focus on HOW decisions were made, WHO was involved, and WHETHER process was followed.",
  },
};

const defaultMemory: RecruiterMemory = {
  strengths: [],
  weaknesses: [],
  improvements: [],
  risks: [],
  contradictions: [],
  missingMetrics: [],
  vagueAnswers: [],
  repeatedPatterns: [],
  confidenceTrend: [],
  trustHistory: [],
  recruiterMoodHistory: [],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(items: string[], limit = 8) {
  return Array.from(new Set(items.filter(Boolean).map((item) => item.trim()).filter(Boolean))).slice(-limit);
}

function normalizeRecruiterPersonality(value?: string): RecruiterPersonality {
  if (
    value === "friendly_hr" ||
    value === "analytical_hiring_manager" ||
    value === "startup_recruiter" ||
    value === "corporate_recruiter"
  ) {
    return value;
  }
  return "analytical_hiring_manager";
}

export function getRecruiterProfile(value?: string): RecruiterProfile {
  return recruiterProfiles[normalizeRecruiterPersonality(value)];
}

export function mergeMemory(memory?: Partial<RecruiterMemory>): RecruiterMemory {
  return {
    strengths: memory?.strengths || [],
    weaknesses: memory?.weaknesses || [],
    improvements: memory?.improvements || [],
    risks: memory?.risks || [],
    contradictions: memory?.contradictions || [],
    missingMetrics: memory?.missingMetrics || [],
    vagueAnswers: memory?.vagueAnswers || [],
    repeatedPatterns: memory?.repeatedPatterns || [],
    confidenceTrend: memory?.confidenceTrend || [],
    trustHistory: memory?.trustHistory || [],
    recruiterMoodHistory: memory?.recruiterMoodHistory || [],
  };
}

function hasMetric(answer: string) {
  return /(\d+%|\d+\s?(x|times|days|hours|hrs|minutes|min|weeks|months|years|users|customers|tickets|cases|projects|€|\$|kpi|sla|nps|csat|revenue|cost|time))/i.test(answer);
}

function claimsImprovement(answer: string) {
  return /\b(improved|increased|reduced|optimized|decreased|saved|grew|boosted|accelerated|resolved|delivered|achieved|raised|lowered)\b/i.test(answer);
}

function hasOwnership(answer: string) {
  return /\b(i led|i owned|i built|i created|i designed|i implemented|i analyzed|i resolved|i improved|my role was|i was responsible|i handled|i drove)\b/i.test(answer);
}

function vagueOwnership(answer: string) {
  return /\b(we|our team|team worked|supported|helped|involved|participated|contributed)\b/i.test(answer) && !hasOwnership(answer);
}

function hasStructure(answer: string) {
  return /\b(result|situation|task|action|impact|outcome|because|therefore|first|then|finally|as a result)\b/i.test(answer);
}

function isTooShort(answer: string) {
  return answer.trim().split(/\s+/).length < 28;
}

function isTooLong(answer: string) {
  return answer.trim().split(/\s+/).length > 180;
}

function isGeneric(answer: string) {
  return /\b(hardworking|team player|passionate|good communication|problem solver|learn quickly|detail oriented)\b/i.test(answer) && !hasMetric(answer);
}

function extractLikelyName(text: string) {
  const match = text.match(/\b(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  return match?.[1]?.trim();
}

function detectCvName(cvText?: string) {
  if (!cvText) return undefined;
  const firstLines = cvText.split(/\n|\. /).slice(0, 8).join(" ");
  const match = firstLines.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  return match?.[0];
}

function detectLocationConflict(answer: string, cvText?: string) {
  if (!cvText) return undefined;
  const locations = ["Germany", "Berlin", "Würzburg", "Munich", "Chennai", "India", "Netherlands", "UK", "US", "USA"];
  const answerHits = locations.filter((loc) => new RegExp(`\\b${loc}\\b`, "i").test(answer));
  const cvHits = locations.filter((loc) => new RegExp(`\\b${loc}\\b`, "i").test(cvText));
  const conflict = answerHits.find((hit) => cvHits.length && !cvHits.includes(hit));
  if (!conflict) return undefined;
  return `You mentioned ${conflict}, but your CV appears to reference ${cvHits.slice(0, 2).join(" / ")}. Clarify your current location or context.`;
}

function detectContradictions(input: PsychologyInput) {
  const contradictions: string[] = [];
  const answer = input.answer;
  const cvText = input.cvText || "";
  const answerName = extractLikelyName(answer);
  const cvName = detectCvName(cvText);

  if (answerName && cvName && !cvName.toLowerCase().includes(answerName.toLowerCase())) {
    contradictions.push(`You introduced yourself as ${answerName}, but the CV appears to show ${cvName}. Clarify which name the recruiter should use.`);
  }

  const locationConflict = detectLocationConflict(answer, cvText);
  if (locationConflict) contradictions.push(locationConflict);

  if (/\b(no experience|never worked|no background)\b/i.test(answer) && /\bexperience|engineer|manager|analyst|specialist|worked\b/i.test(cvText)) {
    contradictions.push("You said you have no relevant experience, but your CV shows prior professional experience. Clarify the difference.");
  }

  const previous = input.transcript?.map((item) => item.text || "").join(" ") || "";
  if (/\bi led\b/i.test(previous) && /\bi only supported|my manager led|i was not leading\b/i.test(answer)) {
    contradictions.push("Earlier you suggested you led the work, but now it sounds like you mainly supported it. Clarify your actual ownership.");
  }

  return contradictions;
}

function scoreAnswer(input: PsychologyInput) {
  const answer = input.answer;
  const role = input.targetRole || "";
  const jd = input.jobDescription || "";
  const personality = normalizeRecruiterPersonality(input.recruiterPersonality);

  // Base scores — same starting point for all
  let confidence = 42;
  let clarity = 42;
  let relevance = 42;
  let evidence = 34;
  let structure = 36;

  // Universal signals
  const metricPresent = hasMetric(answer);
  const improvementClaimed = claimsImprovement(answer);
  const ownershipPresent = hasOwnership(answer);
  const structurePresent = hasStructure(answer);
  const tooShort = isTooShort(answer);
  const tooLong = isTooLong(answer);
  const generic = isGeneric(answer);
  const vagueOwn = vagueOwnership(answer);

  // ── Personality-specific scoring weights ─────────────────────────────────
  if (personality === "friendly_hr") {
    // Sarah: rewards communication signals, emotional language, culture words
    // Doesn't penalise lack of metrics as hard as others
    const hasCultureWords = /\b(team|collaborate|support|listen|empathy|feedback|open|honest|value|people|relationship|culture|motivation|conflict|resolve)\b/i.test(answer);
    const hasEmotionalContext = /\b(felt|feeling|realised|learned|grew|understood|appreciated|difficult|challenging|proud|rewarding)\b/i.test(answer);
    if (hasCultureWords) { confidence += 14; relevance += 12; }
    if (hasEmotionalContext) { clarity += 10; relevance += 8; }
    if (metricPresent) evidence += 16; // metrics nice-to-have, not required
    if (improvementClaimed) relevance += 14;
    if (ownershipPresent) confidence += 10;
    if (structurePresent) structure += 18;
    if (answer.length > 180) clarity += 10;
    if (tooShort) { clarity -= 8; evidence -= 4; }
    if (tooLong) { clarity -= 10; structure -= 8; }
    if (vagueOwn) { confidence -= 6; } // gentle penalty — Sarah expects team language
    if (generic) { clarity -= 6; evidence -= 6; }

  } else if (personality === "analytical_hiring_manager") {
    // Daniel: metrics are mandatory, vague ownership heavily penalised
    if (metricPresent) evidence += 36;
    if (improvementClaimed && !metricPresent) { evidence -= 14; relevance -= 4; } // claims without proof
    if (ownershipPresent) { confidence += 22; evidence += 8; }
    if (structurePresent) structure += 26;
    if (answer.length > 220) clarity += 12;
    if (tooShort) { clarity -= 16; evidence -= 14; }
    if (tooLong) { clarity -= 20; structure -= 14; }
    if (vagueOwn) { confidence -= 20; evidence -= 12; }
    if (generic) { clarity -= 14; evidence -= 16; }

  } else if (personality === "startup_recruiter") {
    // Priya: speed signals, initiative, built-from-scratch language
    // Heavily penalises rambling and team-speak
    const hasSpeedSignal = /\b(shipped|launched|built|created|deployed|moved fast|week|sprint|overnight|quickly|immediately|zero to|from scratch|solo|alone|without a team)\b/i.test(answer);
    const hasInitiative = /\b(i decided|i proposed|i initiated|i saw|i noticed|i took ownership|without being asked|on my own|proactively)\b/i.test(answer);
    if (hasSpeedSignal) { confidence += 20; relevance += 16; }
    if (hasInitiative) { confidence += 18; evidence += 12; }
    if (metricPresent) evidence += 28;
    if (ownershipPresent) { confidence += 24; evidence += 10; }
    if (structurePresent) structure += 18;
    if (tooShort) { clarity -= 10; evidence -= 8; } // concise is ok for Priya
    if (tooLong) { clarity -= 28; structure -= 20; } // rambling is worst sin for Priya
    if (vagueOwn) { confidence -= 26; evidence -= 16; } // "we did it" is unacceptable
    if (generic) { clarity -= 18; evidence -= 18; }
    if (improvementClaimed) relevance += 10;

  } else {
    // Markus (corporate_recruiter): process, governance, compliance signals
    // Penalises "moved fast and broke things" language, rewards procedural language
    const hasProcessSignal = /\b(process|procedure|protocol|governance|compliance|audit|documented|escalated|approved|signed off|committee|stakeholder|aligned|reviewed|framework|policy|regulation|risk|change management)\b/i.test(answer);
    const hasFastMove = /\b(bypassed|skipped|moved fast|shipped quickly|no approval|without asking|alone|independently without)\b/i.test(answer);
    if (hasProcessSignal) { structure += 28; relevance += 20; confidence += 10; }
    if (hasFastMove) { structure -= 18; confidence -= 12; } // red flag for Markus
    if (metricPresent) evidence += 20;
    if (ownershipPresent) confidence += 14;
    if (structurePresent) structure += 22;
    if (answer.length > 200) clarity += 10; // Markus prefers thorough answers
    if (tooShort) { clarity -= 16; structure -= 12; } // incomplete = non-compliant
    if (tooLong) { clarity -= 8; structure -= 6; } // long is ok if structured
    if (vagueOwn) { confidence -= 10; }
    if (generic) { clarity -= 12; evidence -= 10; }
    if (improvementClaimed) relevance += 8;
  }

  // Universal role/JD match
  const roleTokens = role.toLowerCase().split(/\W+/).filter((token) => token.length > 3);
  const jdTokens = jd.toLowerCase().split(/\W+/).filter((token) => token.length > 5).slice(0, 40);
  const answerLower = answer.toLowerCase();
  const roleMatches = roleTokens.filter((token) => answerLower.includes(token)).length;
  const jdMatches = jdTokens.filter((token) => answerLower.includes(token)).length;
  relevance += roleMatches * 7 + Math.min(jdMatches * 2, 20);

  return {
    confidence: clamp(confidence),
    clarity: clamp(clarity),
    relevance: clamp(relevance),
    evidence: clamp(evidence),
    structure: clamp(structure),
  };
}

function pickMood(score: ReturnType<typeof scoreAnswer>, contradictions: string[], interruption: boolean): RecruiterMood {
  const average = (score.confidence + score.clarity + score.relevance + score.evidence + score.structure) / 5;
  if (interruption) return "interrupting";
  if (contradictions.length) return "clarifying";
  if (average >= 78) return "impressed";
  if (average >= 62) return "interested";
  if (score.evidence < 35 || score.confidence < 35) return "skeptical";
  if (score.clarity < 30 || score.structure < 30) return "impatient";
  return "neutral";
}

function createInterruption(input: PsychologyInput, score: ReturnType<typeof scoreAnswer>, contradictions: string[], profile: RecruiterProfile) {
  const answer = input.answer;
  const pressure = input.previousPressure || 35;
  const shouldBeMoreDirect = pressure + profile.interruptionBias > 42;
  const p = profile.key;

  // Contradiction check — all personalities handle this, but with different phrasing
  if (contradictions.length) {
    const msg =
      p === "friendly_hr"
        ? `I just want to make sure I understand — ${contradictions[0]}`
        : p === "startup_recruiter"
          ? `Hold on — ${contradictions[0]} Which is it?`
          : p === "corporate_recruiter"
            ? `I need to pause here for a compliance point. ${contradictions[0]}`
            : `Wait — I need to clarify something. ${contradictions[0]}`;
    return { shouldInterrupt: true, interruptionMessage: msg, severity: "high" as const };
  }

  // Claims improvement without metric
  if (claimsImprovement(answer) && !hasMetric(answer)) {
    const msg =
      p === "friendly_hr"
        ? "Could you give me a sense of the impact — even qualitatively? How did things change?"
        : p === "startup_recruiter"
          ? "Stop — what's the actual number? Revenue, time saved, users, something concrete."
          : p === "corporate_recruiter"
            ? "Could you walk me through how that improvement was measured and documented?"
            : "Let me stop you there. How exactly did you measure that improvement?";
    return { shouldInterrupt: shouldBeMoreDirect, interruptionMessage: msg, severity: "medium" as const };
  }

  // Vague ownership
  if (vagueOwnership(answer)) {
    const msg =
      p === "friendly_hr"
        ? "That's helpful — and what was your personal role in that?"
        : p === "startup_recruiter"
          ? "I'm going to cut in — were YOU the one who did this, or was it the team? Be specific."
          : p === "corporate_recruiter"
            ? "Could you clarify your designated role in that project? What was formally your responsibility?"
            : "Pause there. What exactly was YOUR direct contribution?";
    return { shouldInterrupt: shouldBeMoreDirect, interruptionMessage: msg, severity: "medium" as const };
  }

  // Too long
  if (isTooLong(answer)) {
    const msg =
      p === "friendly_hr"
        ? "Thank you — let me bring you back. What was the key outcome of all that?"
        : p === "startup_recruiter"
          ? "I'm going to stop you — what actually happened? One sentence."
          : p === "corporate_recruiter"
            ? "Let me ask you to summarise the key process outcome. What was the final result?"
            : "Let me stop you there. Start with the result first, then give me one example.";
    return { shouldInterrupt: true, interruptionMessage: msg, severity: "medium" as const };
  }

  // Too short
  if (isTooShort(answer)) {
    const msg =
      p === "friendly_hr"
        ? "Can you tell me a bit more about that? I'd love to hear the full picture."
        : p === "startup_recruiter"
          ? "That's not enough. Give me the real situation and what you personally did."
          : p === "corporate_recruiter"
            ? "Could you expand on that? I'd like to understand the full process you followed."
            : "That is too brief. Give me one specific example with action and result.";
    return { shouldInterrupt: false, interruptionMessage: msg, severity: "low" as const };
  }

  // Generic language
  if (isGeneric(answer)) {
    const msg =
      p === "friendly_hr"
        ? "I appreciate that — could you give me one real example from your experience that shows that?"
        : p === "startup_recruiter"
          ? "That's a generic answer. Tell me one specific thing you built or shipped."
          : p === "corporate_recruiter"
            ? "Could you give me a specific documented example that demonstrates that capability?"
            : "That still sounds generic. Give me a real example from your work.";
    return { shouldInterrupt: shouldBeMoreDirect, interruptionMessage: msg, severity: "medium" as const };
  }

  // Markus-specific: fast-mover red flag
  if (p === "corporate_recruiter" && /\b(bypassed|skipped|without approval|no sign.off|alone|independently without|without asking)\b/i.test(answer)) {
    return {
      shouldInterrupt: true,
      interruptionMessage: "Can I ask — was that decision escalated through the proper approval process? Who signed off on it?",
      severity: "medium" as const,
    };
  }

  // Low relevance
  if (score.relevance < 36) {
    const msg =
      p === "corporate_recruiter"
        ? "How does that connect to the governance requirements of this role specifically?"
        : "Tie this more clearly to the role. Why would this matter for this job?";
    return { shouldInterrupt: false, interruptionMessage: msg, severity: "low" as const };
  }

  return { shouldInterrupt: false, interruptionMessage: "", severity: "low" as const };
}

function updateMemory(input: PsychologyInput, score: ReturnType<typeof scoreAnswer>, contradictions: string[], mood: RecruiterMood): RecruiterMemory {
  const memory = mergeMemory(input.previousMemory);
  const answer = input.answer;
  const strengths = [...memory.strengths];
  const weaknesses = [...memory.weaknesses];
  const improvements = [...memory.improvements];
  const risks = [...memory.risks];
  const missingMetrics = [...memory.missingMetrics];
  const vagueAnswers = [...memory.vagueAnswers];
  const repeatedPatterns = [...memory.repeatedPatterns];

  if (hasMetric(answer)) strengths.push("Uses measurable evidence when prompted.");
  if (hasOwnership(answer)) strengths.push("Shows personal ownership.");
  if (hasStructure(answer)) strengths.push("Can structure answers with action and result.");

  if (claimsImprovement(answer) && !hasMetric(answer)) {
    missingMetrics.push("Claimed improvement without measurable result.");
    weaknesses.push("Avoids measurable impact.");
    improvements.push("Add exact numbers, scope, before/after comparison, or business outcome.");
  }
  if (vagueOwnership(answer)) {
    vagueAnswers.push("Used team-based language without clear ownership.");
    weaknesses.push("Ownership signal is unclear.");
    improvements.push("Use 'I did X' before explaining what the team did.");
  }
  if (isTooShort(answer)) {
    weaknesses.push("Answers too briefly.");
    improvements.push("Use a 45–75 second STAR-style answer.");
  }
  if (isTooLong(answer)) {
    weaknesses.push("Answers run too long.");
    improvements.push("Start with the result, then give one example.");
  }
  if (isGeneric(answer)) {
    weaknesses.push("Uses generic claims without proof.");
    improvements.push("Replace generic traits with one concrete work example.");
  }
  if (contradictions.length) {
    risks.push("Possible contradiction between CV/setup and answer.");
  }

  const latestWeaknesses = [...weaknesses].slice(-6);
  const counts = latestWeaknesses.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

  for (const [pattern, count] of Object.entries(counts)) {
    if (count >= 2) repeatedPatterns.push(pattern);
  }

  return {
    strengths: uniq(strengths, 5),
    weaknesses: uniq(weaknesses, 5),
    improvements: uniq(improvements, 5),
    risks: uniq(risks, 4),
    contradictions: uniq([...memory.contradictions, ...contradictions], 6),
    missingMetrics: uniq(missingMetrics, 6),
    vagueAnswers: uniq(vagueAnswers, 6),
    repeatedPatterns: uniq(repeatedPatterns, 5),
    confidenceTrend: [...memory.confidenceTrend, score.confidence].slice(-12),
    trustHistory: memory.trustHistory.slice(-12),
    recruiterMoodHistory: [...memory.recruiterMoodHistory, mood].slice(-12),
  };
}

function computeTrust(previousTrust: number, score: ReturnType<typeof scoreAnswer>, contradictions: string[], memory: RecruiterMemory) {
  const average = (score.confidence + score.clarity + score.relevance + score.evidence + score.structure) / 5;
  let delta = 0;
  if (average >= 75) delta += 12;
  else if (average >= 60) delta += 6;
  else if (average < 40) delta -= 12;
  if (score.evidence < 35) delta -= 8;
  if (score.confidence < 35) delta -= 8;
  if (contradictions.length) delta -= 22;
  if (memory.repeatedPatterns.length) delta -= 6;
  if (score.evidence >= 70 && score.confidence >= 65) delta += 8;
  return clamp(previousTrust + delta);
}

function computePressure(previousPressure: number, score: ReturnType<typeof scoreAnswer>, contradictions: string[], profile: RecruiterProfile) {
  let pressure = previousPressure + profile.pressureBias * 0.25;
  if (contradictions.length) pressure += 18;
  if (score.evidence < 35) pressure += 10;
  if (score.confidence < 35) pressure += 8;
  if (score.clarity > 65 && score.evidence > 60) pressure -= 8;
  if (score.structure > 70) pressure -= 5;
  return clamp(pressure);
}

function reactionForMood(mood: RecruiterMood, profile: RecruiterProfile) {
  const p = profile.key;

  const reactions: Record<RecruiterPersonality, Record<RecruiterMood, string>> = {
    friendly_hr: {
      impressed:    "That's really good to hear — that's exactly the kind of example I was hoping for.",
      interested:   "Thank you, that helps me understand you better.",
      skeptical:    "I want to make sure I'm getting a full picture — can you tell me a bit more?",
      impatient:    "Let me bring you back to the core of what I asked.",
      clarifying:   "I just want to make sure I've understood that correctly before we move on.",
      interrupting: "Let me jump in here for a moment.",
      concerned:    "That's something I'd want to explore a bit further.",
      neutral:      "Okay, that gives me something to work with.",
    },
    analytical_hiring_manager: {
      impressed:    "Good — that's the kind of evidence I need. Let's go deeper.",
      interested:   "Hmm. That's useful, but I want to verify the specifics.",
      skeptical:    "I'm not fully convinced. What's the data behind that?",
      impatient:    "You're losing the thread. Give me the result first.",
      clarifying:   "Wait — I need to reconcile something before we continue.",
      interrupting: "Let me stop you there.",
      concerned:    "That raises a flag for me. Explain that.",
      neutral:      "Noted. Let's keep moving.",
    },
    startup_recruiter: {
      impressed:    "Okay — that's what I'm talking about. What did you do next?",
      interested:   "Right, that's a start. What was your actual output?",
      skeptical:    "I'm not buying it yet. What specifically did YOU ship?",
      impatient:    "Too slow. What actually happened?",
      clarifying:   "Hold on — which part of that was you?",
      interrupting: "Stop — I'm going to cut in.",
      concerned:    "That's a red flag. Tell me more.",
      neutral:      "Okay. Keep going.",
    },
    corporate_recruiter: {
      impressed:    "That is well-structured. I appreciate the thoroughness.",
      interested:   "I see. Could you clarify the process that led to that outcome?",
      skeptical:    "I'm not certain the full compliance picture is clear here.",
      impatient:    "Let's return to the process question I raised.",
      clarifying:   "I need to pause on a procedural point.",
      interrupting: "If I may interject — ",
      concerned:    "That raises a governance question for me.",
      neutral:      "Understood. Proceeding to the next point.",
    },
  };

  const personalityReactions = reactions[p] || reactions.analytical_hiring_manager;
  return personalityReactions[mood] || personalityReactions.neutral;
}

function createNextQuestionSeed(input: PsychologyInput, score: ReturnType<typeof scoreAnswer>, memory: RecruiterMemory, contradictions: string[], profile: RecruiterProfile) {
  const p = profile.key;

  if (contradictions.length) return `Clarify this contradiction directly: ${contradictions[0]}`;

  if (p === "friendly_hr") {
    if (memory.vagueAnswers.length) return `The candidate used team-based language. Gently ask: 'And what was your personal contribution to that?'`;
    if (score.relevance < 40) return `Ask how they felt about that experience and what it taught them about working with others.`;
    if (score.structure < 40) return `Ask them to walk you through the situation from the beginning — what happened and how they responded.`;
    return `Ask a question focused on ${profile.questionFocus.slice(0, 2).join(" and ")} — make it conversational and human.`;
  }

  if (p === "analytical_hiring_manager") {
    if (memory.missingMetrics.length) return `The candidate claimed improvement without proof. Ask: 'What was the exact metric — before and after?'`;
    if (memory.vagueAnswers.length) return `Ownership is still unclear. Ask: 'What would NOT have happened if you hadn't been there?'`;
    if (score.evidence < 40) return `Ask for a specific example with a measurable business outcome — revenue, cost, time, retention, or efficiency.`;
    if (score.relevance < 40) return `Ask them to connect this directly to the ${input.targetRole || "role"} requirements.`;
    return `Push for deeper technical or business detail on ${profile.questionFocus.slice(0, 2).join(" and ")}.`;
  }

  if (p === "startup_recruiter") {
    if (memory.vagueAnswers.length) return `Ownership is team-speak. Ask: 'What specifically did YOU ship? What would have been missing without you?'`;
    if (memory.missingMetrics.length) return `Ask: 'Give me one number — users, revenue, time, anything concrete.'`;
    if (score.structure < 40) return `Ask: 'What was the fastest you moved on something similar? What did you ship and how long did it take?'`;
    if (score.relevance < 40) return `Ask: 'If we hired you tomorrow, what would you do in the first week?'`;
    return `Ask a high-velocity ownership question about ${profile.questionFocus.slice(0, 2).join(" or ")}.`;
  }

  // Markus (corporate_recruiter)
  if (memory.missingMetrics.length) return `Ask: 'How was that outcome formally documented and reported to stakeholders?'`;
  if (score.structure < 40) return `Ask them to walk through the formal process step by step — who was involved, what approvals were needed, and how it was signed off.`;
  if (score.relevance < 40) return `Ask how that experience connects to the governance or compliance requirements of this role.`;
  return `Ask a structured question about ${profile.questionFocus.slice(0, 2).join(" and ")} — focus on process, approval chains, and documentation.`;
}

export function evaluateRecruiterPsychology(input: PsychologyInput): PsychologyResult {
  const profile = getRecruiterProfile(input.recruiterPersonality);
  const score = scoreAnswer(input);
  const contradictions = detectContradictions(input);
  const interruption = createInterruption(input, score, contradictions, profile);
  const mood = pickMood(score, contradictions, interruption.shouldInterrupt);
  const memory = updateMemory(input, score, contradictions, mood);
  const recruiterTrust = computeTrust(input.previousTrust ?? 46, score, contradictions, memory);
  const pressure = computePressure(input.previousPressure ?? 35, score, contradictions, profile);

  const finalMemory: RecruiterMemory = {
    ...memory,
    trustHistory: [...memory.trustHistory, recruiterTrust].slice(-12),
  };

  const psychologicalInsight =
    contradictions.length > 0
      ? "The recruiter detected a mismatch and should clarify before moving forward."
      : memory.repeatedPatterns.length > 0
        ? `Repeated pattern detected: ${memory.repeatedPatterns[memory.repeatedPatterns.length - 1]}`
        : score.evidence < 40
          ? "The recruiter still needs measurable evidence."
          : score.confidence < 40
            ? "The recruiter still needs clearer ownership."
            : "The recruiter has enough signal to continue deeper.";

  return {
    recruiterProfile: profile,
    memory: finalMemory,
    score,
    recruiterTrust,
    pressure,
    mood,
    interruption,
    contradictions,
    psychologicalInsight,
    nextQuestionSeed: createNextQuestionSeed(input, score, finalMemory, contradictions, profile),
    recruiterReaction: reactionForMood(mood, profile),
  };
}

export function buildRecruiterSystemPrompt(input: PsychologyInput, psychology: PsychologyResult) {
  const profile = psychology.recruiterProfile;

  return `
You are ${profile.name}, a ${profile.role} conducting a realistic interview.

Product promise:
This must feel like the closest thing to a real interview.

Recruiter behavior:
${profile.behaviorPrompt}

Current emotional state:
${psychology.mood}

Current psychology insight:
${psychology.psychologicalInsight}

Current memory:
- Strengths: ${psychology.memory.strengths.join("; ") || "None yet"}
- Weaknesses: ${psychology.memory.weaknesses.join("; ") || "None yet"}
- Missing metrics: ${psychology.memory.missingMetrics.join("; ") || "None yet"}
- Vague ownership: ${psychology.memory.vagueAnswers.join("; ") || "None yet"}
- Contradictions: ${psychology.memory.contradictions.join("; ") || "None yet"}
- Repeated patterns: ${psychology.memory.repeatedPatterns.join("; ") || "None yet"}

Trust and pressure:
- Recruiter trust: ${psychology.recruiterTrust}/100
- Pressure: ${psychology.pressure}/100

Candidate target:
- Role: ${input.targetRole || "Not specified"}
- Market: ${input.targetMarket || "Global"}
- Company style: ${input.companyStyle || "Realistic"}

Rules:
1. Do not ask random question-bank questions.
2. Use the candidate's CV, job description, and previous answers.
3. If there is a contradiction, clarify it immediately before continuing.
4. If impact is vague, ask for metrics.
5. If ownership is vague, ask what the candidate personally did.
6. If the answer is too long, interrupt and ask for result first.
7. If the answer is generic, demand one real example.
8. Sound human. Use short natural reactions like "Hmm", "Okay", "Wait", but do not overdo it.
9. Keep the next recruiter response concise: 2 to 5 sentences.
10. End with exactly one follow-up question.

Next question direction:
${psychology.nextQuestionSeed}
`.trim();
}
