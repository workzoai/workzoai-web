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
    pressureBias: -8,
    interruptionBias: -12,
    questionFocus: ["communication", "teamwork", "motivation", "culture fit", "conflict handling"],
    behaviorPrompt:
      "Warm, supportive, human, and honest. Ask about communication, teamwork, motivation, and culture fit. Challenge gently when answers are vague.",
  },
  analytical_hiring_manager: {
    key: "analytical_hiring_manager",
    name: "Daniel",
    role: "Hiring Manager",
    voiceGender: "male",
    pacing: "balanced",
    pressureBias: 8,
    interruptionBias: 8,
    questionFocus: ["measurable impact", "ownership", "technical depth", "business value", "evidence"],
    behaviorPrompt:
      "Analytical, direct, evidence-driven, and serious. Push for metrics, ownership, technical depth, and measurable business impact.",
  },
  startup_recruiter: {
    key: "startup_recruiter",
    name: "Priya",
    role: "Startup Recruiter",
    voiceGender: "female",
    pacing: "fast",
    pressureBias: 14,
    interruptionBias: 16,
    questionFocus: ["speed", "ownership", "execution", "ambiguity", "adaptability"],
    behaviorPrompt:
      "Fast-paced, practical, and energetic. Interrupt quickly when answers are vague. Test ownership, speed, adaptability, and execution.",
  },
  corporate_recruiter: {
    key: "corporate_recruiter",
    name: "Markus",
    role: "Corporate Recruiter",
    voiceGender: "male",
    pacing: "structured",
    pressureBias: 5,
    interruptionBias: 4,
    questionFocus: ["structure", "reliability", "planning", "process", "professionalism"],
    behaviorPrompt:
      "Structured, formal, precise, and process-oriented. Expect concise, organized answers with consistency and professionalism.",
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
  let confidence = 42;
  let clarity = 42;
  let relevance = 42;
  let evidence = 34;
  let structure = 36;

  if (hasMetric(answer)) evidence += 32;
  if (claimsImprovement(answer)) relevance += 12;
  if (hasOwnership(answer)) confidence += 18;
  if (hasStructure(answer)) structure += 24;
  if (answer.length > 220) clarity += 12;
  if (isTooShort(answer)) {
    clarity -= 12;
    evidence -= 8;
  }
  if (isTooLong(answer)) {
    clarity -= 18;
    structure -= 12;
  }
  if (vagueOwnership(answer)) {
    confidence -= 14;
    evidence -= 8;
  }
  if (isGeneric(answer)) {
    clarity -= 10;
    evidence -= 12;
  }

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

  if (contradictions.length) {
    return {
      shouldInterrupt: true,
      interruptionMessage: `Wait — I need to clarify something. ${contradictions[0]}`,
      severity: "high" as const,
    };
  }
  if (claimsImprovement(answer) && !hasMetric(answer)) {
    return {
      shouldInterrupt: shouldBeMoreDirect,
      interruptionMessage: "Let me stop you there. How exactly did you measure that improvement?",
      severity: "medium" as const,
    };
  }
  if (vagueOwnership(answer)) {
    return {
      shouldInterrupt: shouldBeMoreDirect,
      interruptionMessage: "Pause there. What exactly was YOUR direct contribution?",
      severity: "medium" as const,
    };
  }
  if (isTooLong(answer)) {
    return {
      shouldInterrupt: true,
      interruptionMessage: "Let me stop you there. Start with the result first, then give me one example.",
      severity: "medium" as const,
    };
  }
  if (isTooShort(answer)) {
    return {
      shouldInterrupt: false,
      interruptionMessage: "That is too brief. Give me one specific example with action and result.",
      severity: "low" as const,
    };
  }
  if (isGeneric(answer)) {
    return {
      shouldInterrupt: shouldBeMoreDirect,
      interruptionMessage: "That still sounds generic. Give me a real example from your work.",
      severity: "medium" as const,
    };
  }
  if (score.relevance < 36) {
    return {
      shouldInterrupt: false,
      interruptionMessage: "Tie this more clearly to the role. Why would this matter for this job?",
      severity: "low" as const,
    };
  }
  return {
    shouldInterrupt: false,
    interruptionMessage: "",
    severity: "low" as const,
  };
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
  const prefixByPacing = {
    calm: "Okay.",
    balanced: "Hmm.",
    fast: "Wait.",
    structured: "Let me be precise.",
  }[profile.pacing];

  if (mood === "impressed") return `${prefixByPacing} That is a stronger example.`;
  if (mood === "interested") return `${prefixByPacing} That gives me something useful to work with.`;
  if (mood === "skeptical") return `${prefixByPacing} I am not fully convinced yet.`;
  if (mood === "impatient") return `${prefixByPacing} You are losing the main point.`;
  if (mood === "clarifying") return `${prefixByPacing} I need to clarify a mismatch before we continue.`;
  if (mood === "interrupting") return `${prefixByPacing} Let me stop you there.`;
  if (mood === "concerned") return `${prefixByPacing} That creates a concern for me.`;
  return `${prefixByPacing} I am evaluating the answer.`;
}

function createNextQuestionSeed(input: PsychologyInput, score: ReturnType<typeof scoreAnswer>, memory: RecruiterMemory, contradictions: string[], profile: RecruiterProfile) {
  if (contradictions.length) return `Clarify this contradiction directly: ${contradictions[0]}`;
  if (memory.missingMetrics.length) return `Earlier or just now, the candidate claimed improvement without numbers. Ask how success was measured.`;
  if (memory.vagueAnswers.length) return `The candidate's ownership is unclear. Ask what they personally did.`;
  if (score.relevance < 40) return `Ask them to connect the example more directly to ${input.targetRole || "the role"}.`;
  if (score.structure < 40) return `Ask them to answer again with result first, then one example.`;
  return `Ask a realistic follow-up focused on ${profile.questionFocus.slice(0, 2).join(" and ")}.`;
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
- Role: ${input.targetRole || "Unknown"}
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
