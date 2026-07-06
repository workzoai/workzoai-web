/**
 * recruiterBrainEngine.ts
 *
 * The "recruiter brain" that runs BEFORE every call to the LLM.
 * Computes all the missing features from the audit:
 *  - JD requirement coverage (what's covered vs missing)
 *  - Competency coverage tracker (don't retest same dimension)
 *  - Interview strategy (what to validate next, not just what to ask)
 *  - Conversation planner (dynamic stage-aware plan)
 *  - Hiring recommendation signal (continuously updated)
 *  - Recruiter emotional state (affects tone of next question)
 *  - Adaptive difficulty (harder for strong, more coaching for weak)
 *  - Company style engine (startup vs enterprise depth)
 *  - Deep resume verification triggers (skill depth probing)
 *  - Memory timeline (claims → evidence → contradictions)
 *
 * This output is passed as a structured block into the LLM system prompt
 * so the model always has a pre-computed recruiter brain state to reason from -
 * rather than hoping the LLM infers all of this itself every turn.
 */

export type TranscriptItem = {
  role: "candidate" | "recruiter" | "system" | string;
  text: string;
  time?: string;
};

// ── JD Requirement Coverage ──────────────────────────────────────────────────

export type JdRequirement = {
  skill: string;
  required: boolean;
  cvCovers: boolean;
  probed: boolean;
  candidateEvidence: string;
};

const TECH_SKILL_PATTERNS: [RegExp, string][] = [
  [/\bpython\b/i, "Python"],
  [/\bsql\b/i, "SQL"],
  [/\br\b(?!\w)/i, "R (statistics)"],
  [/\bjava(?:script)?\b/i, "JavaScript"],
  [/\btypescript\b/i, "TypeScript"],
  [/\breact\b/i, "React"],
  [/\bnext\.?js\b/i, "Next.js"],
  [/\bnode\.?js\b/i, "Node.js"],
  [/\baws\b/i, "AWS"],
  [/\bazure\b/i, "Azure"],
  [/\bgcp\b|\bGoogle Cloud\b/i, "Google Cloud"],
  [/\bdocker\b/i, "Docker"],
  [/\bkubernetes\b|\bk8s\b/i, "Kubernetes"],
  [/\btensorflow\b/i, "TensorFlow"],
  [/\bpytorch\b/i, "PyTorch"],
  [/\bsklearn\b|\bscikit.learn\b/i, "Scikit-learn"],
  [/\btableau\b/i, "Tableau"],
  [/\bpower\s*bi\b/i, "Power BI"],
  [/\bexcel\b/i, "Excel"],
  [/\bsalesforce\b/i, "Salesforce"],
  [/\bhubspot\b/i, "HubSpot"],
  [/\bjira\b/i, "Jira"],
  [/\bconfluence\b/i, "Confluence"],
  [/\bactive\s*directory\b/i, "Active Directory"],
  [/\bwindows\s*server\b/i, "Windows Server"],
  [/\bnetwork(?:ing)?\b/i, "Networking"],
  [/\bpowershell\b/i, "PowerShell"],
  [/\blinux\b/i, "Linux"],
  [/\bitil\b/i, "ITIL"],
  [/\bitsm\b/i, "ITSM"],
  [/\bcrm\b/i, "CRM"],
  [/\bapi\b/i, "API integration"],
  [/\brest(?:ful)?\b/i, "REST API"],
  [/\bgraphql\b/i, "GraphQL"],
  [/\bci\/cd\b|\bdevops\b/i, "CI/CD / DevOps"],
  [/\bagile\b|\bscrum\b|\bkanban\b/i, "Agile / Scrum"],
  [/\bcustomer\s*success\b/i, "Customer Success"],
  [/\bproject\s*manag/i, "Project Management"],
  [/\bstakeholder\b/i, "Stakeholder Management"],
  [/\bpresent(?:ation)?\b/i, "Presentations"],
  [/\bdata\s*analys/i, "Data Analysis"],
  [/\bmachine\s*learning\b/i, "Machine Learning"],
];

export function extractJdRequirements(jdText: string, cvText: string, transcript: TranscriptItem[]): JdRequirement[] {
  if (!jdText?.trim()) return [];

  const transcriptText = transcript.map(t => t.text).join(" ").toLowerCase();
  const cvLower = (cvText || "").toLowerCase();

  const requirements: JdRequirement[] = [];
  const seen = new Set<string>();

  for (const [pattern, label] of TECH_SKILL_PATTERNS) {
    if (!pattern.test(jdText)) continue;
    if (seen.has(label)) continue;
    seen.add(label);

    const cvCovers = pattern.test(cvLower);
    const probed = pattern.test(transcriptText);

    // Find what the candidate actually said about this skill in the transcript
    const relevantTurns = transcript
      .filter(t => t.role === "candidate" && pattern.test(t.text))
      .map(t => t.text.replace(/\s+/g, " ").slice(0, 120))
      .slice(0, 2);

    requirements.push({
      skill: label,
      required: true,
      cvCovers,
      probed,
      candidateEvidence: relevantTurns.join(" | "),
    });
  }

  return requirements;
}

// ── Competency Coverage Tracker ──────────────────────────────────────────────

export type Competency =
  | "technical_depth"
  | "communication"
  | "leadership"
  | "stakeholder_management"
  | "problem_solving"
  | "ownership"
  | "adaptability"
  | "motivation_and_fit"
  | "career_transition"
  | "jd_gap";

export type CompetencyStatus = {
  id: Competency;
  label: string;
  tested: boolean;
  score: number | null; // 0-100 or null if not tested
  lastTestedAt: number; // transcript turn index
  shouldTest: boolean;
};

const COMPETENCY_PATTERNS: Record<Competency, RegExp> = {
  technical_depth: /\b(python|sql|api|code|implement|algorithm|architecture|system|debug|technical|engineer|develop|deploy|database|network|server|infrastructure|cloud|aws|azure|script|automate|configure)\b/i,
  communication: /\b(present|explain|communicat|report|document|stakeholder|email|meeting|brief|update|convey|articulate|clear|language)\b/i,
  leadership: /\b(led|managed|supervised|mentored|guided|team|direct report|people|headcount|hire|coach|coordinate|delegate)\b/i,
  stakeholder_management: /\b(stakeholder|client|customer|partner|executive|sponsor|board|cross-functional|alignment|influence|buy-in|escalat)\b/i,
  problem_solving: /\b(problem|challenge|issue|solve|diagnos|troubleshoot|root cause|analyse|analyze|investigate|fix|resolution|approach|strategy)\b/i,
  ownership: /\b(i (?:built|created|led|owned|decided|initiated|drove|implemented|designed|improved|reduced|increased)|personally|my responsibility|I was accountable|I took)\b/i,
  adaptability: /\b(adapt|pivot|learn|new|chang|switch|transition|different|unfamiliar|stretch|outside my|fast-paced|ambiguous)\b/i,
  motivation_and_fit: /\b(why this|interested in|passion|motiv|goal|career|aspir|attracted|reason for|looking for|what I want)\b/i,
  career_transition: /\b(switch|transition|change|pivot|from .* to|background in|moving|different field|new direction|transferable)\b/i,
  jd_gap: /gap/i, // special, driven by JD coverage, not transcript pattern
};

export function buildCompetencyTracker(
  transcript: TranscriptItem[],
  jdRequirements: JdRequirement[],
  cvText: string,
  targetRole: string,
): CompetencyStatus[] {
  const candidateTurns = transcript.filter(t => t.role === "candidate");
  const recruiterTurns = transcript.filter(t => t.role === "recruiter");
  const fullCandidateText = candidateTurns.map(t => t.text).join(" ");

  // Detect career transition from CV vs target role
  const cvLower = (cvText || "").toLowerCase();
  const roleLower = (targetRole || "").toLowerCase();
  const hasCareerTransition = detectCareerTransition(cvLower, roleLower);

  // Detect uncovered JD gaps
  const hasJdGaps = jdRequirements.some(r => !r.cvCovers && !r.probed);

  const statuses: CompetencyStatus[] = [];
  let turnIdx = 0;

  for (const [id, pattern] of Object.entries(COMPETENCY_PATTERNS) as [Competency, RegExp][]) {
    if (id === "career_transition" && !hasCareerTransition) continue;
    if (id === "jd_gap" && !hasJdGaps) continue;

    let tested = false;
    let score: number | null = null;
    let lastTestedAt = -1;

    for (let i = 0; i < candidateTurns.length; i++) {
      const turn = candidateTurns[i];
      if (!pattern.test(turn.text)) continue;
      tested = true;
      lastTestedAt = i;
      // Score based on answer quality signals
      const hasOwnership = COMPETENCY_PATTERNS.ownership.test(turn.text);
      const hasOutcome = /\b(result|impact|outcome|improved|reduced|increased|achieved|delivered|saved|resolved|helped)\b/i.test(turn.text);
      const hasEvidence = /\b\d+|specific|example|situation|when|at [A-Z]/i.test(turn.text);
      const wordCount = turn.text.split(/\s+/).length;
      score = Math.min(100,
        (wordCount > 30 ? 30 : wordCount) +
        (hasOwnership ? 25 : 0) +
        (hasOutcome ? 25 : 0) +
        (hasEvidence ? 20 : 0)
      );
    }

    // Only mark as "should test" if recruiter hasn't already asked about it
    const recruiterAsked = recruiterTurns.some(t => pattern.test(t.text));
    const shouldTest = !tested && (id === "career_transition" || id === "jd_gap" || !recruiterAsked);

    const labels: Record<Competency, string> = {
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

    statuses.push({ id, label: labels[id], tested, score, lastTestedAt, shouldTest });
    turnIdx++;
  }

  return statuses;
}

// ── Career Transition Detection ──────────────────────────────────────────────

function detectCareerTransition(cvLower: string, roleLower: string): boolean {
  const techSupportCv = /technical support|it support|helpdesk|service desk|customer support/i.test(cvLower);
  const dataRoleTarget = /data scientist|data analyst|machine learning|data engineer/i.test(roleLower);
  const salesCv = /sales|business development|account executive/i.test(cvLower);
  const pmTarget = /product manager|project manager|program manager/i.test(roleLower);
  const designCv = /graphic design|ux designer|visual design/i.test(cvLower);
  const techTarget = /software engineer|developer|frontend|backend/i.test(roleLower);

  return (techSupportCv && dataRoleTarget) ||
    (salesCv && pmTarget) ||
    (designCv && techTarget) ||
    false;
}

// ── Interview Strategy Engine ────────────────────────────────────────────────

export type InterviewStrategyDecision = {
  primaryGoal: string;           // "What am I trying to validate?"
  nextBestTopicId: Competency;
  nextBestTopicLabel: string;
  rationale: string;             // Why this topic next
  suggestedAngle: string;        // How to approach it (not what to ask)
  urgency: "critical" | "high" | "normal" | "low";
  skipTopic: string | null;      // Topic to avoid (already tested well)
};

export function buildInterviewStrategy(
  competencies: CompetencyStatus[],
  jdRequirements: JdRequirement[],
  trust: number,
  answerCount: number,
  hasCareerTransition: boolean,
): InterviewStrategyDecision {
  // Priority order changes based on where we are in the interview
  if (answerCount <= 2) {
    return {
      primaryGoal: "Establish rapport and understand the candidate's background",
      nextBestTopicId: "motivation_and_fit",
      nextBestTopicLabel: "Motivation & Fit",
      rationale: "Early interview, understand who this person is before evaluating depth",
      suggestedAngle: "Let them introduce themselves and explain their interest in this role",
      urgency: "high",
      skipTopic: null,
    };
  }

  if (hasCareerTransition && !competencies.find(c => c.id === "career_transition")?.tested) {
    return {
      primaryGoal: "Understand the career transition: why, preparation, transferable skills, and risk",
      nextBestTopicId: "career_transition",
      nextBestTopicLabel: "Career Transition",
      rationale: "CV-to-role gap detected. A real recruiter would want to understand this before going deeper",
      suggestedAngle: "Ask why the switch, what preparation they've done, and how they'd close the skill gap",
      urgency: "critical",
      skipTopic: null,
    };
  }

  // Find critical JD gaps not yet probed
  const unprobed = jdRequirements.filter(r => !r.cvCovers && !r.probed);
  if (unprobed.length > 0 && answerCount >= 3) {
    const gap = unprobed[0];
    return {
      primaryGoal: `Validate whether the candidate can actually do ${gap.skill}, which is required in the JD but not visible in their CV`,
      nextBestTopicId: "jd_gap",
      nextBestTopicLabel: `JD Gap: ${gap.skill}`,
      rationale: "This skill is required in the JD and not clearly in the CV, this is a hiring risk that must be addressed",
      suggestedAngle: `Don't ask directly. Introduce naturally: "I see ${gap.skill} in the role. I didn't spot it clearly in your CV, have you worked with it before, or how would you approach that?"`,
      urgency: "critical",
      skipTopic: null,
    };
  }

  // Trust-based routing: low trust → go for ownership/evidence
  if (trust < 45) {
    const ownershipNotTested = competencies.find(c => c.id === "ownership" && !c.tested);
    if (ownershipNotTested) {
      return {
        primaryGoal: "Verify that the candidate can show specific personal ownership, not just team credit",
        nextBestTopicId: "ownership",
        nextBestTopicLabel: "Ownership",
        rationale: "Low trust, recruiter needs concrete evidence of personal contribution before moving on",
        suggestedAngle: "Narrow to one specific situation they personally owned. What did they decide? What changed?",
        urgency: "critical",
        skipTopic: null,
      };
    }
  }

  // Find highest-priority untested competency
  const priorityOrder: Competency[] = [
    "problem_solving", "ownership", "technical_depth",
    "stakeholder_management", "leadership", "adaptability", "communication",
  ];

  const nextTarget = priorityOrder
    .map(id => competencies.find(c => c.id === id))
    .find(c => c && c.shouldTest && !c.tested);

  if (nextTarget) {
    return {
      primaryGoal: `Assess the candidate's ${nextTarget.label}, not yet evaluated`,
      nextBestTopicId: nextTarget.id,
      nextBestTopicLabel: nextTarget.label,
      rationale: `${nextTarget.label} hasn't been tested and is relevant to this role`,
      suggestedAngle: `Find a natural opening from their last answer to explore this dimension`,
      urgency: "normal",
      skipTopic: competencies.find(c => c.score && c.score > 75)?.label || null,
    };
  }

  // All major competencies tested, go deeper on weakest
  const weakest = competencies
    .filter(c => c.tested && c.score !== null && c.score < 60)
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0];

  return {
    primaryGoal: weakest
      ? `Go deeper on ${weakest.label}, the candidate's answer was weak here`
      : "Move toward closing: strengths, weaknesses, fit, and final questions",
    nextBestTopicId: weakest?.id || "motivation_and_fit",
    nextBestTopicLabel: weakest?.label || "Closing",
    rationale: weakest
      ? `Score of ${weakest.score}/100 on ${weakest.label}, needs one more probe before forming a recommendation`
      : "Core competencies covered, natural time to wrap up",
    suggestedAngle: weakest
      ? "Don't repeat the same question. Narrow to a specific situation or decision that would show this competency"
      : "Ask about development area, ask if they have questions, begin forming a hiring signal",
    urgency: weakest ? "high" : "low",
    skipTopic: competencies.find(c => c.score && c.score > 80)?.label || null,
  };
}

// ── Hiring Recommendation Engine ─────────────────────────────────────────────

export type HiringRecommendation = {
  likelihood: "strong_yes" | "lean_yes" | "neutral" | "lean_no" | "strong_no";
  confidenceLevel: number; // 0-100
  strengthFactors: string[];
  riskFactors: string[];
  keyUncertainties: string[];
  recruiterVerdict: string; // One plain-English sentence
};

export function buildHiringRecommendation(
  trust: number,
  competencies: CompetencyStatus[],
  jdRequirements: JdRequirement[],
  answerCount: number,
  hasCareerTransition: boolean,
): HiringRecommendation {
  if (answerCount < 2) {
    return {
      likelihood: "neutral",
      confidenceLevel: 10,
      strengthFactors: [],
      riskFactors: [],
      keyUncertainties: ["Interview just started, no signal yet"],
      recruiterVerdict: "Too early to assess, interview has just begun.",
    };
  }

  const testedComps = competencies.filter(c => c.tested && c.score !== null);
  const avgScore = testedComps.length
    ? testedComps.reduce((sum, c) => sum + (c.score ?? 0), 0) / testedComps.length
    : 50;

  const uncoveredCriticalJd = jdRequirements.filter(r => r.required && !r.cvCovers && !r.probed);
  const coveredJd = jdRequirements.filter(r => r.cvCovers);
  const jdCoverage = jdRequirements.length
    ? Math.round((coveredJd.length / jdRequirements.length) * 100)
    : 80;

  const strengthFactors: string[] = [];
  const riskFactors: string[] = [];
  const keyUncertainties: string[] = [];

  // Build strength and risk factors from competency scores
  for (const comp of testedComps) {
    if ((comp.score ?? 0) >= 70) strengthFactors.push(`Strong ${comp.label}`);
    else if ((comp.score ?? 0) < 45) riskFactors.push(`Weak ${comp.label}`);
  }

  if (trust >= 75) strengthFactors.push("High recruiter trust, answers are consistent and credible");
  if (trust < 45) riskFactors.push("Low trust, inconsistencies or vague answers noticed");
  if (jdCoverage >= 70) strengthFactors.push(`CV covers ~${jdCoverage}% of JD requirements`);
  if (jdCoverage < 50) riskFactors.push(`CV only covers ~${jdCoverage}% of JD requirements`);
  if (hasCareerTransition) keyUncertainties.push("Career transition, transferable skills not yet fully validated");
  for (const gap of uncoveredCriticalJd) keyUncertainties.push(`${gap.skill} required in JD but not shown in CV or interview`);

  // Determine likelihood
  const compositeScore = (avgScore * 0.4) + (trust * 0.35) + (jdCoverage * 0.25);
  let likelihood: HiringRecommendation["likelihood"];
  if (compositeScore >= 78) likelihood = "strong_yes";
  else if (compositeScore >= 64) likelihood = "lean_yes";
  else if (compositeScore >= 50) likelihood = "neutral";
  else if (compositeScore >= 36) likelihood = "lean_no";
  else likelihood = "strong_no";

  const confidenceLevel = Math.min(95, Math.round(
    (testedComps.length / Math.max(4, competencies.length)) * 100
  ));

  const verdictMap: Record<HiringRecommendation["likelihood"], string> = {
    strong_yes: "Strong candidate, credible, evidence-backed, good role fit.",
    lean_yes: "Decent candidate, some gaps but overall positive signal.",
    neutral: "Mixed signals, needs more evidence before a recommendation.",
    lean_no: "Concerns outweigh strengths, key gaps not addressed.",
    strong_no: "Not ready for this role, significant credibility or skill gaps.",
  };

  return {
    likelihood,
    confidenceLevel,
    strengthFactors: strengthFactors.slice(0, 4),
    riskFactors: riskFactors.slice(0, 4),
    keyUncertainties: keyUncertainties.slice(0, 3),
    recruiterVerdict: verdictMap[likelihood],
  };
}

// ── Recruiter Emotional State Engine ─────────────────────────────────────────

export type RecruiterEmotionalState = {
  state: "interested" | "skeptical" | "concerned" | "impressed" | "neutral" | "impatient" | "curious";
  label: string;
  intensity: number; // 1-5
  toneInstruction: string;
  naturalReaction: string; // What a human recruiter would naturally say/do in this state
};

export function computeRecruiterEmotionalState(
  trust: number,
  lastAnswerScore: number | null,
  recruiterState: string,
  answerCount: number,
): RecruiterEmotionalState {
  const score = lastAnswerScore ?? 50;

  if (score >= 80 && trust >= 70) {
    return {
      state: "impressed",
      label: "Impressed",
      intensity: Math.ceil((score - 70) / 10),
      toneInstruction: "Warm, engaged, lean forward. The recruiter is genuinely interested. Go one level deeper, not harder.",
      naturalReaction: "That's a strong example. Let me ask you about [related depth].",
    };
  }

  if (score >= 65 && trust >= 55) {
    return {
      state: "interested",
      label: "Interested",
      intensity: 3,
      toneInstruction: "Positive but still evaluating. Brief acknowledgement, then next natural question.",
      naturalReaction: "Good. I can see the connection there. Let me ask you about [next topic].",
    };
  }

  if (score >= 50 && trust >= 45) {
    return {
      state: "curious",
      label: "Curious",
      intensity: 2,
      toneInstruction: "Genuinely uncertain, wants to understand more before forming a view. Probe naturally.",
      naturalReaction: "Okay, help me understand that a bit better. What was your actual role in that?",
    };
  }

  if (trust < 40 || (score < 35 && answerCount > 2)) {
    return {
      state: "skeptical",
      label: "Skeptical",
      intensity: Math.ceil((50 - Math.max(trust, score)) / 10),
      toneInstruction: "Shorter replies. Less warmth. Stay on this question. Don't move until there's evidence.",
      naturalReaction: "Hmm. I want to make sure I understand what you personally contributed here.",
    };
  }

  if (score < 40 && answerCount > 4) {
    return {
      state: "concerned",
      label: "Concerned",
      intensity: 3,
      toneInstruction: "Direct but fair. The recruiter is forming doubts but giving one more chance.",
      naturalReaction: "I want to be honest, I'm not getting a clear picture yet. Can you ground this in one specific situation?",
    };
  }

  if (answerCount > 8 && score < 55) {
    return {
      state: "impatient",
      label: "Impatient",
      intensity: 2,
      toneInstruction: "Tighter pacing. Less tolerance for vague answers. Push for specifics quickly.",
      naturalReaction: "Let's stay specific. I don't need the full picture, just one clear example.",
    };
  }

  return {
    state: "neutral",
    label: "Neutral",
    intensity: 2,
    toneInstruction: "Evaluating. Calm and professional. Ask the next natural question from the answer.",
    naturalReaction: "Okay. Tell me about [next topic from their answer].",
  };
}

// ── Adaptive Difficulty Engine ────────────────────────────────────────────────

export type DifficultyLevel = {
  level: "coaching" | "standard" | "probing" | "challenging" | "bar_raising";
  label: string;
  instruction: string;
};

export function computeAdaptiveDifficulty(
  trust: number,
  avgCompetencyScore: number,
  answerCount: number,
): DifficultyLevel {
  const composite = (trust * 0.5) + (avgCompetencyScore * 0.5);

  if (composite >= 80 && answerCount >= 3) {
    return {
      level: "bar_raising",
      label: "Bar-raising",
      instruction: "This candidate is performing strongly. Raise the bar: ask about scope, scale, what they'd do differently, or how they'd handle a harder version of this situation. Don't ease up, strong candidates need harder questions to differentiate.",
    };
  }

  if (composite >= 65) {
    return {
      level: "challenging",
      label: "Challenging",
      instruction: "Good candidate, apply strategic pressure. Ask for specifics, probe for edge cases, test ownership depth and JD gap awareness. Push past the comfortable answer.",
    };
  }

  if (composite >= 50) {
    return {
      level: "probing",
      label: "Probing",
      instruction: "Mixed signals, probe deliberately. Narrow each answer to one specific situation. Don't accept vague ownership or generic outcomes. One precise follow-up before moving on.",
    };
  }

  if (composite >= 35) {
    return {
      level: "standard",
      label: "Standard",
      instruction: "Candidate is struggling, keep pressure fair but real. Give them space to answer but don't soften the expectation. One clear, specific question at a time.",
    };
  }

  return {
    level: "coaching",
    label: "Coaching",
    instruction: "Candidate is significantly struggling. Narrow to the simplest, most concrete version of the question. Help them find their footing without giving away the answer. The goal is to see if they can get there with a nudge.",
  };
}

// ── Company Style Engine ──────────────────────────────────────────────────────

export type CompanyStyleProfile = {
  archetype: string;
  coreValues: string[];
  interviewPriorities: string[];
  redFlags: string[];
  greenFlags: string[];
  tonalInstruction: string;
};

export function buildCompanyStyleProfile(companyStyle: string): CompanyStyleProfile {
  const style = (companyStyle || "").toLowerCase();

  if (style.includes("startup") || style.includes("founder")) {
    return {
      archetype: "Startup",
      coreValues: ["Ownership", "Speed", "Ambiguity tolerance", "Execution over process", "Resourcefulness"],
      interviewPriorities: ["What did you build from scratch?", "How did you work without full resources?", "What would you do on day one?", "When did you take initiative without being asked?"],
      redFlags: ["Relies on process", "Waits for direction", "No examples of building from zero", "Can't handle ambiguity"],
      greenFlags: ["Shipped without full information", "Took ownership of unclear situations", "Moved fast and fixed things"],
      tonalInstruction: "Direct, fast-paced, low-fluff. Values doing over explaining. Respect candidates who answer concisely with real ownership.",
    };
  }

  if (style.includes("enterprise") || style.includes("corporate") || style.includes("process")) {
    return {
      archetype: "Enterprise",
      coreValues: ["Process discipline", "Stakeholder alignment", "Documentation", "Risk management", "Cross-team collaboration"],
      interviewPriorities: ["How do you manage stakeholders?", "How do you navigate org complexity?", "How do you document and communicate decisions?", "How do you handle competing priorities across teams?"],
      redFlags: ["Avoids process", "Lone-wolf mentality", "Can't describe stakeholder management", "No experience in matrixed orgs"],
      greenFlags: ["Clear stakeholder examples", "Experience with large-scale coordination", "Structured decision-making approach"],
      tonalInstruction: "Professional, structured, measured. Values clarity and process. Push for specific stakeholder or process examples.",
    };
  }

  if (style.includes("consult") || style.includes("advisory")) {
    return {
      archetype: "Consulting",
      coreValues: ["Structured thinking", "Client communication", "Data-driven insights", "Hypothesis-led analysis", "Delivery under pressure"],
      interviewPriorities: ["What was the client's problem?", "What was your hypothesis?", "How did you structure your analysis?", "What did you recommend and what happened?"],
      redFlags: ["Can't structure thinking on the fly", "Data without insight", "No clear recommendation", "Poor executive communication"],
      greenFlags: ["MECE thinking", "Clear problem framing", "Client-ready communication", "Comfort with ambiguous data"],
      tonalInstruction: "Logical, structured, slightly formal. Expects frameworks. Push for hypothesis first, then evidence.",
    };
  }

  if (style.includes("tech") || style.includes("faang") || style.includes("engineering")) {
    return {
      archetype: "Tech / FAANG",
      coreValues: ["Technical depth", "Scale thinking", "Ownership and leadership", "Data-driven decisions", "Customer obsession"],
      interviewPriorities: ["Walk me through the technical design", "What were the tradeoffs?", "What would you scale differently?", "What was the business impact?"],
      redFlags: ["Surface-level technical answers", "No ownership or decision-making", "Can't articulate tradeoffs", "Weak on scale or impact"],
      greenFlags: ["Clear system design thinking", "Ownership at scale", "Explicit tradeoff reasoning", "Measurable impact"],
      tonalInstruction: "Evidence-driven, technical, logical. Push for depth and tradeoffs. 'Tell me more about how that worked at scale.'",
    };
  }

  // Default: realistic balanced
  return {
    archetype: "Realistic Balanced",
    coreValues: ["Evidence", "Ownership", "Relevance", "Communication"],
    interviewPriorities: ["Specific examples", "Personal ownership", "Real outcomes", "Role fit"],
    redFlags: ["Vague answers", "No ownership", "Generic responses", "Weak evidence"],
    greenFlags: ["Specific situations", "Personal contribution", "Real outcomes", "Role awareness"],
    tonalInstruction: "Natural and balanced. Probe for specifics and ownership. Accept qualitative outcomes. One question at a time.",
  };
}

// ── Memory Timeline ───────────────────────────────────────────────────────────

export type MemoryTimelineEvent = {
  turn: number;
  type: "claim" | "evidence_provided" | "contradiction_found" | "contradiction_resolved" | "strong_moment" | "weak_moment" | "jd_gap_addressed";
  detail: string;
  severity: "low" | "medium" | "high";
};

export function buildMemoryTimeline(
  transcript: TranscriptItem[],
  jdRequirements: JdRequirement[],
): MemoryTimelineEvent[] {
  const events: MemoryTimelineEvent[] = [];
  const claimsMap = new Map<string, { text: string; turn: number }>();

  const candidateTurns = transcript.filter(t => t.role === "candidate");

  for (let i = 0; i < candidateTurns.length; i++) {
    const turn = candidateTurns[i];
    const text = turn.text || "";

    // Detect ownership claims
    if (/\bi (led|managed|built|created|owned|drove|implemented)/i.test(text)) {
      const match = text.match(/\bi (led|managed|built|created|owned|drove|implemented)[^.!?]*/i);
      if (match) {
        const claimKey = match[0].toLowerCase().slice(0, 60);
        if (!claimsMap.has(claimKey)) {
          claimsMap.set(claimKey, { text: match[0], turn: i });
          events.push({ turn: i, type: "claim", detail: match[0].slice(0, 100), severity: "low" });
        }
      }
    }

    // Detect evidence (metrics, specifics)
    if (/\b\d+%|\b\d+ (users|customers|tickets|people|months|years)\b|\b(CSAT|NPS|SLA|KPI)\b/i.test(text)) {
      events.push({ turn: i, type: "evidence_provided", detail: "Candidate provided a specific metric or measurable outcome", severity: "low" });
    }

    // Detect simple contradictions (managed vs never managed)
    if (/\b(i led|i managed|i supervised)\b/i.test(text)) {
      const managedClaim = true;
      if (candidateTurns.slice(0, i).some(t => /\b(never managed|i don't manage|no management|not a manager)\b/i.test(t.text))) {
        events.push({ turn: i, type: "contradiction_found", detail: "Earlier said no management; now claims leadership", severity: "high" });
      }
    }

    // Detect weak answers
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 15 && i > 1) {
      events.push({ turn: i, type: "weak_moment", detail: "Very short answer, possible avoidance or lack of depth", severity: "medium" });
    }

    // Detect JD gap addressed
    for (const req of jdRequirements.filter(r => !r.cvCovers)) {
      const skillPattern = new RegExp(`\\b${req.skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (skillPattern.test(text)) {
        events.push({ turn: i, type: "jd_gap_addressed", detail: `Candidate addressed JD gap: ${req.skill}`, severity: "low" });
      }
    }
  }

  return events.slice(-20); // Keep last 20 events to avoid prompt bloat
}

// ── Main: Build Recruiter Brain Context ───────────────────────────────────────

export type RecruiterBrainContext = {
  jdCoverage: {
    covered: JdRequirement[];
    missing: JdRequirement[];
    unprobed: JdRequirement[];
    coveragePercent: number;
  };
  competencies: CompetencyStatus[];
  strategy: InterviewStrategyDecision;
  hiringRecommendation: HiringRecommendation;
  emotionalState: RecruiterEmotionalState;
  difficulty: DifficultyLevel;
  companyStyle: CompanyStyleProfile;
  memoryTimeline: MemoryTimelineEvent[];
  conversationStage: "opening" | "background" | "depth" | "jd_gaps" | "leadership" | "closing";
  hasCareerTransition: boolean;
};

export function buildRecruiterBrain(input: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  companyStyle: string;
  transcript: TranscriptItem[];
  trust: number;
  recruiterState: string;
  lastAnswerScore?: number | null;
}): RecruiterBrainContext {
  const {
    cvText, jobDescription, targetRole, companyStyle,
    transcript, trust, recruiterState, lastAnswerScore,
  } = input;

  const candidateTurns = transcript.filter(t => t.role === "candidate");
  const answerCount = candidateTurns.length;

  const hasCareerTransition = detectCareerTransition(
    (cvText || "").toLowerCase(),
    (targetRole || "").toLowerCase(),
  );

  const jdRequirements = extractJdRequirements(jobDescription, cvText, transcript);
  const competencies = buildCompetencyTracker(transcript, jdRequirements, cvText, targetRole);
  const strategy = buildInterviewStrategy(competencies, jdRequirements, trust, answerCount, hasCareerTransition);

  const testedComps = competencies.filter(c => c.tested && c.score !== null);
  const avgScore = testedComps.length
    ? testedComps.reduce((sum, c) => sum + (c.score ?? 0), 0) / testedComps.length
    : 50;

  const hiringRecommendation = buildHiringRecommendation(
    trust, competencies, jdRequirements, answerCount, hasCareerTransition,
  );

  const emotionalState = computeRecruiterEmotionalState(
    trust, lastAnswerScore ?? null, recruiterState, answerCount,
  );

  const difficulty = computeAdaptiveDifficulty(trust, avgScore, answerCount);
  const companyStyleProfile = buildCompanyStyleProfile(companyStyle);
  const memoryTimeline = buildMemoryTimeline(transcript, jdRequirements);

  // Conversation stage
  let conversationStage: RecruiterBrainContext["conversationStage"];
  if (answerCount <= 1) conversationStage = "opening";
  else if (answerCount <= 3) conversationStage = "background";
  else if (hasCareerTransition && !competencies.find(c => c.id === "career_transition")?.tested) conversationStage = "background";
  else if (jdRequirements.some(r => !r.cvCovers && !r.probed)) conversationStage = "jd_gaps";
  else if (!competencies.find(c => c.id === "leadership")?.tested) conversationStage = "leadership";
  else if (answerCount >= 8) conversationStage = "closing";
  else conversationStage = "depth";

  const coveredJd = jdRequirements.filter(r => r.cvCovers);
  const missingJd = jdRequirements.filter(r => !r.cvCovers);
  const unprobedJd = jdRequirements.filter(r => !r.cvCovers && !r.probed);
  const coveragePercent = jdRequirements.length
    ? Math.round((coveredJd.length / jdRequirements.length) * 100)
    : 100;

  return {
    jdCoverage: {
      covered: coveredJd,
      missing: missingJd,
      unprobed: unprobedJd,
      coveragePercent,
    },
    competencies,
    strategy,
    hiringRecommendation,
    emotionalState,
    difficulty,
    companyStyle: companyStyleProfile,
    memoryTimeline,
    conversationStage,
    hasCareerTransition,
  };
}

/**
 * Serializes the recruiter brain context into a compact, LLM-readable block
 * that can be injected directly into the system prompt.
 * This is the key upgrade: the LLM now has a pre-computed "brain state"
 * to reason FROM, rather than having to infer all of this itself.
 */
export function serializeRecruiterBrainForPrompt(brain: RecruiterBrainContext): string {
  const lines: string[] = [];

  lines.push("═══ RECRUITER BRAIN STATE (pre-computed, use this to decide your next move) ═══");

  lines.push(`\nCONVERSATION STAGE: ${brain.conversationStage.toUpperCase()}`);
  if (brain.hasCareerTransition) lines.push("⚠ CAREER TRANSITION DETECTED, must validate before going deep");

  lines.push(`\nINTERVIEW STRATEGY, PRIMARY GOAL THIS TURN:`);
  lines.push(`  Goal: ${brain.strategy.primaryGoal}`);
  lines.push(`  Next topic: ${brain.strategy.nextBestTopicLabel} (urgency: ${brain.strategy.urgency})`);
  lines.push(`  Approach: ${brain.strategy.suggestedAngle}`);
  lines.push(`  Rationale: ${brain.strategy.rationale}`);
  if (brain.strategy.skipTopic) lines.push(`  Skip: ${brain.strategy.skipTopic} (already well tested)`);

  lines.push(`\nRECRUITER EMOTIONAL STATE: ${brain.emotionalState.label} (intensity ${brain.emotionalState.intensity}/5)`);
  lines.push(`  Tone: ${brain.emotionalState.toneInstruction}`);
  lines.push(`  Natural reaction: "${brain.emotionalState.naturalReaction}"`);

  lines.push(`\nADAPTIVE DIFFICULTY: ${brain.difficulty.label}`);
  lines.push(`  ${brain.difficulty.instruction}`);

  lines.push(`\nJD REQUIREMENT COVERAGE: ${brain.jdCoverage.coveragePercent}% covered by CV`);
  if (brain.jdCoverage.unprobed.length > 0) {
    lines.push(`  UNPROBED JD GAPS (ask about these): ${brain.jdCoverage.unprobed.map(r => r.skill).join(", ")}`);
  }
  if (brain.jdCoverage.covered.length > 0) {
    lines.push(`  CV covers: ${brain.jdCoverage.covered.map(r => r.skill).join(", ")}`);
  }

  const untestedComps = brain.competencies.filter(c => c.shouldTest && !c.tested);
  const testedComps = brain.competencies.filter(c => c.tested);
  if (untestedComps.length > 0) {
    lines.push(`\nCOMPETENCY TRACKER, NOT YET TESTED: ${untestedComps.map(c => c.label).join(", ")}`);
  }
  if (testedComps.length > 0) {
    lines.push(`  Tested: ${testedComps.map(c => `${c.label} (${c.score ?? "?"})`).join(", ")}`);
  }

  lines.push(`\nCOMPANY STYLE: ${brain.companyStyle.archetype}`);
  lines.push(`  Priorities: ${brain.companyStyle.interviewPriorities.slice(0, 2).join(" | ")}`);
  lines.push(`  Tone: ${brain.companyStyle.tonalInstruction}`);
  lines.push(`  Green flags: ${brain.companyStyle.greenFlags.slice(0, 2).join(" | ")}`);
  lines.push(`  Red flags: ${brain.companyStyle.redFlags.slice(0, 2).join(" | ")}`);

  lines.push(`\nHIRING RECOMMENDATION (continuously updated): ${brain.hiringRecommendation.likelihood.replace(/_/g, " ").toUpperCase()}`);
  lines.push(`  Confidence: ${brain.hiringRecommendation.confidenceLevel}%`);
  lines.push(`  Verdict: ${brain.hiringRecommendation.recruiterVerdict}`);
  if (brain.hiringRecommendation.strengthFactors.length) {
    lines.push(`  Strengths: ${brain.hiringRecommendation.strengthFactors.join(", ")}`);
  }
  if (brain.hiringRecommendation.riskFactors.length) {
    lines.push(`  Risks: ${brain.hiringRecommendation.riskFactors.join(", ")}`);
  }
  if (brain.hiringRecommendation.keyUncertainties.length) {
    lines.push(`  Uncertainties: ${brain.hiringRecommendation.keyUncertainties.join(", ")}`);
  }

  if (brain.memoryTimeline.length > 0) {
    const recentEvents = brain.memoryTimeline.slice(-5);
    lines.push(`\nMEMORY TIMELINE (recent):`);
    for (const event of recentEvents) {
      const icon = event.type === "contradiction_found" ? "⚠" : event.type === "strong_moment" ? "✓" : "·";
      lines.push(`  ${icon} [turn ${event.turn}] ${event.type.replace(/_/g, " ")}: ${event.detail}`);
    }
  }

  lines.push("\n═══ END RECRUITER BRAIN, use the strategy above to choose your next move ═══");

  return lines.join("\n");
}
