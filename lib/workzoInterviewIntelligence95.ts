export type WorkZoTranscriptItem = {
  role?: string;
  speaker?: string;
  text?: string;
  time?: string;
};

type BuildInput = {
  answer: string;
  currentQuestion?: string;
  transcript?: WorkZoTranscriptItem[];
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyName?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  currentTrust?: number;
  currentState?: string | null;
};

type RubricFlag = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  evidence: string;
};

type CompanyDnaSignal = {
  id: string;
  label: string;
  score: number;
  target: number;
  comment: string;
};

type ChallengeDecision = {
  shouldChallenge: boolean;
  severity: 1 | 2 | 3 | 4 | 5;
  reason: string;
  challengeQuestion: string;
  challengeType: "none" | "evidence" | "ownership" | "structure" | "contradiction" | "company_dna";
};

type ContradictionFinding = {
  type: "leadership" | "experience" | "ownership" | "timeline" | "skill" | "scope";
  severity: 1 | 2 | 3 | 4 | 5;
  earlierClaim: string;
  currentClaim: string;
  challenge: string;
};

type RecruiterMemoryFact = {
  label: string;
  value: string;
  importance: "low" | "medium" | "high";
};

const ACTION_RE = /\b(i|my|me|personally|owned|led|built|created|designed|developed|implemented|resolved|improved|reduced|increased|managed|delivered|analyzed|analysed|coordinated|supported|automated|handled|decided|prioritized|prioritised|trained|mentored|negotiated)\b/i;
const METRIC_RE = /\b(\d+(?:\.\d+)?\s*(?:%|percent|years?|months?|weeks?|days?|hours?|minutes?|customers?|users?|tickets?|cases?|projects?|people|team members|revenue|cost|€|\$)|saved|reduced|increased|improved|cut|grew|boosted|lowered|raised|faster|slower|higher|lower|SLA|CSAT|NPS|KPI)\b/i;
const OUTCOME_RE = /\b(result|impact|outcome|therefore|which led|so that|after that|improved|reduced|increased|saved|achieved|delivered|enabled|helped|benefit|customer|business|quality|performance|efficiency|satisfaction|retention|conversion|resolution|stability)\b/i;
const STRUCTURE_RE = /\b(situation|task|action|result|challenge|approach|outcome|impact|first|then|finally|because|therefore|I learned|what changed)\b/i;
const BLAME_RE = /\b(my manager|they failed|team failed|not my fault|blame|lazy|stupid|useless|hate|terrible company|toxic people|everyone else|management did not)\b/i;
const VAGUE_RE = /\b(stuff|things|many things|some work|good|nice|various|etc|and so on|basically|kind of|sort of|maybe|probably|I think|I guess|not sure)\b/i;
const NO_OWNERSHIP_RE = /\b(team did|we did|someone else|my manager did|not my responsibility|not involved|only helped|just helped)\b/i;
const LEADERSHIP_RE = /\b(led|managed|supervised|owned|headed|coordinated|mentored|guided|team of|people|members|direct reports)\b/i;
const NO_LEADERSHIP_RE = /\b(no management|never managed|did not manage|didn't manage|not led|haven't led|no leadership|not responsible for people)\b/i;
const SKILL_RE = /\b(python|sql|excel|power bi|tableau|react|next\.js|typescript|javascript|node|aws|gcp|azure|docker|kubernetes|crm|salesforce|hubspot|itil|servicenow|figma|cad|solidworks|creo|api|rest|graphql|postgresql|mysql|machine learning|nlp|data pipeline|support|troubleshooting)\b/gi;

const COMPANY_DNA_LIBRARY: Record<string, {
  label: string;
  description: string;
  challengeIntensity: number;
  principles: Array<{ id: string; label: string; target: number; keywords: RegExp; comment: string }>;
  preferredFollowups: string[];
}> = {
  amazon: {
    label: "Amazon Bar Raiser",
    description: "Evaluates ownership, customer obsession, metrics, and ability to dive deep.",
    challengeIntensity: 5,
    principles: [
      { id: "customer_obsession", label: "Customer Obsession", target: 88, keywords: /customer|client|user|stakeholder|satisfaction|support|service|feedback/i, comment: "Connect the answer to a real customer or user impact." },
      { id: "ownership", label: "Ownership", target: 90, keywords: /owned|responsible|led|decided|personally|my role|I built|I handled/i, comment: "Make your personal responsibility unmistakable." },
      { id: "dive_deep", label: "Dive Deep", target: 86, keywords: /root cause|analy[sz]ed|investigated|data|metric|debug|evidence|diagnosed/i, comment: "Show how you investigated the problem, not only what happened." },
      { id: "bias_for_action", label: "Bias for Action", target: 84, keywords: /quickly|launched|implemented|resolved|delivered|within|deadline|action|decided/i, comment: "Show timely decision-making under constraints." },
    ],
    preferredFollowups: [
      "What customer impact did that create?",
      "What data did you inspect before deciding?",
      "What exactly did you own without waiting for someone else?",
    ],
  },
  google: {
    label: "Google-style Interview",
    description: "Evaluates structured problem solving, collaboration, learning ability, and technical clarity.",
    challengeIntensity: 3,
    principles: [
      { id: "problem_solving", label: "Problem Solving", target: 86, keywords: /problem|solution|analy[sz]ed|tradeoff|approach|root cause|debug|design/i, comment: "Explain your reasoning and trade-offs more clearly." },
      { id: "collaboration", label: "Collaboration", target: 82, keywords: /team|collaborated|stakeholder|cross-functional|partnered|communicated|aligned/i, comment: "Show how you worked with others without losing ownership." },
      { id: "learning", label: "Learning Ability", target: 80, keywords: /learned|adapted|improved|feedback|iterated|new tool|upskilled/i, comment: "Mention how you learned and improved from the situation." },
      { id: "technical_clarity", label: "Technical Clarity", target: 84, keywords: /system|data|technical|api|database|architecture|performance|scale|quality/i, comment: "Make the technical detail easy for the interviewer to follow." },
    ],
    preferredFollowups: [
      "What trade-off did you consider before choosing that approach?",
      "How did you align stakeholders with the decision?",
      "What would you do differently if scale increased?",
    ],
  },
  meta: {
    label: "Meta-style Interview",
    description: "Evaluates impact, speed, product thinking, and clear ownership in ambiguous situations.",
    challengeIntensity: 4,
    principles: [
      { id: "impact", label: "Impact", target: 88, keywords: /impact|metric|growth|reduced|increased|improved|users|customers|conversion|engagement/i, comment: "Anchor the answer in measurable impact." },
      { id: "speed", label: "Move Fast", target: 82, keywords: /quick|fast|launched|shipped|deadline|iterated|prototype|within/i, comment: "Explain how you moved quickly without sacrificing quality." },
      { id: "ambiguity", label: "Ambiguity Handling", target: 84, keywords: /ambiguous|unclear|prioritized|tradeoff|limited information|constraint/i, comment: "Show how you made decisions when information was incomplete." },
      { id: "ownership", label: "Ownership", target: 86, keywords: /I owned|I led|personally|my role|responsible|decision/i, comment: "Make personal contribution visible." },
    ],
    preferredFollowups: [
      "What was the measurable product or user impact?",
      "What did you do when the situation was ambiguous?",
      "How quickly did you move from problem to action?",
    ],
  },
  microsoft: {
    label: "Microsoft-style Interview",
    description: "Evaluates customer empathy, collaboration, growth mindset, and technical/business judgment.",
    challengeIntensity: 3,
    principles: [
      { id: "customer_empathy", label: "Customer Empathy", target: 84, keywords: /customer|client|user|empathy|support|need|pain point|satisfaction/i, comment: "Connect actions to customer needs." },
      { id: "growth_mindset", label: "Growth Mindset", target: 82, keywords: /learned|feedback|improved|adapted|reflected|growth|mistake/i, comment: "Show learning and reflection." },
      { id: "collaboration", label: "Collaboration", target: 84, keywords: /team|partnered|collaborated|aligned|stakeholder|cross-functional/i, comment: "Explain how you created alignment." },
      { id: "judgment", label: "Judgment", target: 82, keywords: /prioritized|tradeoff|risk|decision|balanced|quality|timeline/i, comment: "Show sound decision-making." },
    ],
    preferredFollowups: [
      "How did you include customer or stakeholder feedback?",
      "What did you learn from that situation?",
      "What trade-off did you manage?",
    ],
  },
  consulting: {
    label: "Consulting / McKinsey-style Interview",
    description: "Evaluates MECE structure, executive communication, hypothesis thinking, and measurable business impact.",
    challengeIntensity: 5,
    principles: [
      { id: "mece", label: "MECE Structure", target: 90, keywords: /first|second|third|framework|structured|bucket|hypothesis|prioritized/i, comment: "Organize the answer into clear, non-overlapping parts." },
      { id: "executive", label: "Executive Communication", target: 88, keywords: /summary|recommendation|decision|therefore|business impact|stakeholder/i, comment: "Start with the conclusion and support it with evidence." },
      { id: "quant", label: "Quantified Impact", target: 90, keywords: METRIC_RE, comment: "Consulting-style answers need numbers and impact." },
      { id: "client", label: "Client Orientation", target: 84, keywords: /client|customer|stakeholder|business|value|outcome/i, comment: "Tie the answer to client or business value." },
    ],
    preferredFollowups: [
      "Can you structure that into two or three clear buckets?",
      "What was the business impact in numbers?",
      "What would your recommendation be if I asked for the executive summary?",
    ],
  },
  startup: {
    label: "Startup Operator Interview",
    description: "Evaluates ownership, speed, resourcefulness, ambiguity tolerance, and learning velocity.",
    challengeIntensity: 4,
    principles: [
      { id: "ownership", label: "Founder-level Ownership", target: 88, keywords: /owned|built|launched|created|personally|responsible|solo|end-to-end/i, comment: "Show that you can own the outcome, not just the task." },
      { id: "speed", label: "Speed", target: 84, keywords: /quick|fast|within|launched|shipped|prototype|iterated/i, comment: "Show speed and bias for action." },
      { id: "resourceful", label: "Resourcefulness", target: 86, keywords: /limited|constraint|workaround|learned|figured out|without|small team/i, comment: "Show how you created progress with limited resources." },
      { id: "impact", label: "Business Impact", target: 84, keywords: /revenue|users|customers|growth|retention|conversion|cost|saved|increased|reduced/i, comment: "Connect your work to business outcome." },
    ],
    preferredFollowups: [
      "What did you personally own end-to-end?",
      "How did you make progress with limited resources?",
      "What business metric changed because of your work?",
    ],
  },
  enterprise: {
    label: "Enterprise / Corporate Interview",
    description: "Evaluates reliability, process maturity, stakeholder management, risk, and cross-functional communication.",
    challengeIntensity: 3,
    principles: [
      { id: "reliability", label: "Reliability", target: 84, keywords: /process|SLA|quality|compliance|stability|reliable|documentation|standard/i, comment: "Show consistency and operational maturity." },
      { id: "stakeholder", label: "Stakeholder Management", target: 84, keywords: /stakeholder|team|manager|customer|client|aligned|communicated/i, comment: "Show how you managed people and expectations." },
      { id: "risk", label: "Risk Awareness", target: 82, keywords: /risk|escalation|priority|compliance|security|issue|incident/i, comment: "Show how you handled risk and escalation." },
      { id: "impact", label: "Operational Impact", target: 84, keywords: /reduced|improved|saved|resolved|tickets|SLA|time|quality|cost/i, comment: "Quantify operational improvement." },
    ],
    preferredFollowups: [
      "How did you manage stakeholder expectations?",
      "What process or reliability metric improved?",
      "How did you handle risk or escalation?",
    ],
  },
};

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function words(value: string) {
  return clean(value).split(/\s+/).filter(Boolean);
}

function sentences(value: string, limit = 8) {
  return clean(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, limit);
}

function unique(values: string[], limit = 20) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw, 280);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function detectCompanyKey(input: BuildInput) {
  const raw = [input.companyName, input.companyStyle, input.jobDescription, input.targetRole].map((v) => clean(v, 600).toLowerCase()).join(" ");
  if (/amazon|aws|bar raiser/.test(raw)) return "amazon";
  if (/google|alphabet|googleyness/.test(raw)) return "google";
  if (/meta|facebook|instagram|whatsapp/.test(raw)) return "meta";
  if (/microsoft|azure|linkedin/.test(raw)) return "microsoft";
  if (/mckinsey|bcg|bain|consulting|consultant|case interview|strategy/.test(raw)) return "consulting";
  if (/startup|founder|early-stage|early stage|scaleup|scale-up|seed|series a/.test(raw)) return "startup";
  return "enterprise";
}

function buildCompanyDNA(input: BuildInput) {
  const key = detectCompanyKey(input);
  const template = COMPANY_DNA_LIBRARY[key] || COMPANY_DNA_LIBRARY.enterprise;
  const answer = clean(input.answer, 5000);
  const context = `${answer} ${input.jobDescription || ""} ${input.cvText || ""}`;

  const signals: CompanyDnaSignal[] = template.principles.map((principle) => {
    const matched = principle.keywords.test(context);
    const answerMatched = principle.keywords.test(answer);
    const score = clamp((answerMatched ? 74 : 48) + (matched ? 8 : 0) + (METRIC_RE.test(answer) ? 6 : 0) + (ACTION_RE.test(answer) ? 4 : 0), 32, 94);
    return {
      id: principle.id,
      label: principle.label,
      score,
      target: principle.target,
      comment: score >= principle.target - 4 ? "Strong signal for this company style." : principle.comment,
    };
  });

  const alignmentScore = clamp(signals.reduce((sum, item) => sum + item.score, 0) / Math.max(1, signals.length));
  const weakest = [...signals].sort((a, b) => a.score - b.score)[0];

  return {
    key,
    label: template.label,
    description: template.description,
    challengeIntensity: template.challengeIntensity,
    alignmentScore,
    weakestPrinciple: weakest,
    signals,
    preferredFollowups: template.preferredFollowups,
    systemDecorator: [
      `Company DNA: ${template.label}.`,
      template.description,
      `When evaluating, prioritize: ${template.principles.map((item) => item.label).join(", ")}.`,
      `If the candidate lacks evidence, challenge with: ${template.preferredFollowups[0]}`,
    ].join(" "),
  };
}

function extractRubric(answer: string, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  const wc = words(answer).length;
  const rubric: RubricFlag[] = [
    { id: "direct_answer", label: "Answered the question directly", passed: wc >= 18, weight: 12, evidence: wc >= 18 ? "Answer contains enough substance to evaluate." : "Answer is too short to evaluate confidently." },
    { id: "personal_ownership", label: "Personal ownership is clear", passed: ACTION_RE.test(answer) && !NO_OWNERSHIP_RE.test(answer), weight: 16, evidence: ACTION_RE.test(answer) ? "Candidate used ownership/action language." : "Personal contribution is not clear enough." },
    { id: "metric_present", label: "Measurable evidence is present", passed: METRIC_RE.test(answer), weight: 18, evidence: METRIC_RE.test(answer) ? "Answer includes a number, KPI, or measurable improvement signal." : "No clear metric or measurable outcome detected." },
    { id: "outcome_present", label: "Outcome/result is explained", passed: OUTCOME_RE.test(answer), weight: 16, evidence: OUTCOME_RE.test(answer) ? "Answer mentions impact/result/customer/business change." : "Outcome is not explicit." },
    { id: "structured_delivery", label: "Answer has a clear structure", passed: STRUCTURE_RE.test(answer) || wc >= 45, weight: 14, evidence: STRUCTURE_RE.test(answer) ? "Structured flow words detected." : wc >= 45 ? "Answer has enough detail, but structure could still improve." : "Answer needs stronger STAR-style structure." },
    { id: "professional_signal", label: "Professional communication", passed: !BLAME_RE.test(answer), weight: 10, evidence: BLAME_RE.test(answer) ? "Blame-shifting or unprofessional wording detected." : "No major blame-shifting detected." },
    { id: "company_alignment", label: `${companyDNA.label} alignment`, passed: companyDNA.alignmentScore >= 65, weight: 14, evidence: companyDNA.weakestPrinciple?.comment || "Company alignment evaluated." },
  ];

  const weighted = rubric.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0);
  const total = rubric.reduce((sum, item) => sum + item.weight, 0);
  return { rubric, score: clamp((weighted / total) * 100) };
}

function extractMemory(answer: string, transcript: WorkZoTranscriptItem[] = []) {
  const text = clean(answer, 5000);
  const allText = `${transcript.map((item) => clean(item.text, 500)).join(" ")} ${text}`;
  const skillMatches = unique(Array.from(allText.matchAll(SKILL_RE)).map((m) => m[0]), 12);
  const metricMatches = unique(Array.from(text.matchAll(/\b\d+(?:\.\d+)?\s*(?:%|percent|years?|months?|customers?|users?|tickets?|projects?|people|hours?|minutes?)\b/gi)).map((m) => m[0]), 8);
  const projectCandidates = unique(Array.from(text.matchAll(/\b(?:project|initiative|migration|implementation|dashboard|pipeline|automation|support case|escalation|incident)\b[^.!?]{0,90}/gi)).map((m) => clean(m[0], 120)), 6);
  const customerStories = /customer|client|stakeholder|user|support|ticket|escalation/i.test(text) ? sentences(text, 2) : [];

  const facts: RecruiterMemoryFact[] = [
    ...skillMatches.map((value) => ({ label: "Skill mentioned", value, importance: "medium" as const })),
    ...metricMatches.map((value) => ({ label: "Metric mentioned", value, importance: "high" as const })),
    ...projectCandidates.map((value) => ({ label: "Project/story signal", value, importance: "high" as const })),
    ...customerStories.map((value) => ({ label: "Customer/stakeholder story", value, importance: "high" as const })),
  ];

  const strongestFact = facts.find((item) => item.importance === "high") || facts[0] || null;
  const callbackQuestion = strongestFact
    ? `Earlier you mentioned ${strongestFact.value}. What was your personal contribution and what measurable result came from it?`
    : "Earlier you gave useful background. Can you now give one specific example with your action and result?";

  return {
    facts: unique(facts.map((item) => `${item.label}: ${item.value}`), 14),
    structuredFacts: facts.slice(0, 14),
    strongestFact,
    callbackQuestion,
    summary: strongestFact
      ? `Remember and reuse this thread: ${strongestFact.value}`
      : "No strong reusable memory thread detected yet.",
  };
}

function detectContradictions(answer: string, transcript: WorkZoTranscriptItem[] = []): ContradictionFinding[] {
  const previous = clean(transcript.map((item) => item.text || "").join(" "), 6000);
  const current = clean(answer, 2000);
  const findings: ContradictionFinding[] = [];

  if (LEADERSHIP_RE.test(previous) && NO_LEADERSHIP_RE.test(current)) {
    findings.push({
      type: "leadership",
      severity: 5,
      earlierClaim: "Earlier answer suggested leadership or team ownership.",
      currentClaim: "Current answer says there was no management or leadership responsibility.",
      challenge: "Earlier you mentioned leadership or ownership, but now you are saying you did not manage or lead. Can you clarify your exact role and responsibility?",
    });
  }

  if (/\b(\d+)\+?\s+years?\b/i.test(previous) && /\b(no experience|beginner|never worked|no professional experience)\b/i.test(current)) {
    findings.push({
      type: "experience",
      severity: 4,
      earlierClaim: "Earlier answer included years of experience.",
      currentClaim: "Current answer suggests no or very little experience.",
      challenge: "I want to clarify the experience level. Earlier you mentioned years of experience, but now it sounds like you may not have professional experience in this area. Which is accurate?",
    });
  }

  if (/\b(i owned|i led|I was responsible|personally)\b/i.test(previous) && NO_OWNERSHIP_RE.test(current)) {
    findings.push({
      type: "ownership",
      severity: 4,
      earlierClaim: "Earlier answer suggested personal ownership.",
      currentClaim: "Current answer shifts ownership to the team or someone else.",
      challenge: "Earlier it sounded like you personally owned this, but now it sounds more team-owned. What exactly did you personally do?",
    });
  }

  return findings.slice(0, 3);
}

function buildEvidenceRequests(answer: string, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  const requests: string[] = [];
  if (!METRIC_RE.test(answer)) requests.push("Can you quantify the impact with a number, percentage, time saved, SLA, revenue, or customer metric?");
  if (!ACTION_RE.test(answer) || NO_OWNERSHIP_RE.test(answer)) requests.push("What exactly was your personal contribution, separate from the wider team?");
  if (!OUTCOME_RE.test(answer)) requests.push("What changed after your action, and how did the business/customer/team benefit?");
  if (!STRUCTURE_RE.test(answer) && words(answer).length > 55) requests.push("Can you restate that in a tighter STAR structure: situation, action, result?");
  const weakest = companyDNA.weakestPrinciple;
  if (weakest && weakest.score < weakest.target) requests.push(companyDNA.preferredFollowups[0] || weakest.comment);
  return unique(requests, 5);
}

function buildChallenge(answer: string, evidenceRequests: string[], contradictions: ContradictionFinding[], companyDNA: ReturnType<typeof buildCompanyDNA>): ChallengeDecision {
  if (contradictions.length) {
    const top = [...contradictions].sort((a, b) => b.severity - a.severity)[0];
    return { shouldChallenge: true, severity: top.severity as 1 | 2 | 3 | 4 | 5, reason: `${top.type} contradiction detected`, challengeQuestion: top.challenge, challengeType: "contradiction" };
  }

  const wc = words(answer).length;
  const missingMetric = !METRIC_RE.test(answer);
  const weakOwnership = !ACTION_RE.test(answer) || NO_OWNERSHIP_RE.test(answer);
  const weakOutcome = !OUTCOME_RE.test(answer);
  const vague = VAGUE_RE.test(answer);
  const companyGap = companyDNA.weakestPrinciple && companyDNA.weakestPrinciple.score < companyDNA.weakestPrinciple.target - 12;

  let severity = 1;
  if (wc < 22) severity += 2;
  if (missingMetric) severity += 1;
  if (weakOwnership) severity += 1;
  if (weakOutcome) severity += 1;
  if (vague) severity += 1;
  if (companyGap) severity += 1;
  severity = Math.min(5, severity) as 1 | 2 | 3 | 4 | 5;

  if (severity >= 4) {
    const question = evidenceRequests[0] || "Can you give me one concrete example with your action and result?";
    const type: ChallengeDecision["challengeType"] = weakOwnership ? "ownership" : missingMetric ? "evidence" : companyGap ? "company_dna" : "structure";
    return { shouldChallenge: true, severity: severity as 1 | 2 | 3 | 4 | 5, reason: "Answer needs recruiter follow-up before moving on", challengeQuestion: question, challengeType: type };
  }

  return { shouldChallenge: false, severity: severity as 1 | 2 | 3 | 4 | 5, reason: "Answer can be accepted with light follow-up.", challengeQuestion: "", challengeType: "none" };
}

function buildScores(answer: string, rubricScore: number, companyDNA: ReturnType<typeof buildCompanyDNA>, contradictions: ContradictionFinding[]) {
  const wc = words(answer).length;
  const metric = METRIC_RE.test(answer);
  const action = ACTION_RE.test(answer) && !NO_OWNERSHIP_RE.test(answer);
  const outcome = OUTCOME_RE.test(answer);
  const structure = STRUCTURE_RE.test(answer) || (wc >= 45 && wc <= 190);
  const vaguePenalty = VAGUE_RE.test(answer) ? 10 : 0;
  const blamePenalty = BLAME_RE.test(answer) ? 14 : 0;
  const contradictionPenalty = contradictions.reduce((sum, item) => sum + item.severity * 5, 0);

  const clarity = clamp(54 + (structure ? 18 : -8) + (wc >= 25 ? 8 : -14) - vaguePenalty);
  const relevance = clamp(56 + (companyDNA.alignmentScore - 55) * 0.35 + (outcome ? 8 : -4));
  const evidence = clamp(42 + (metric ? 30 : -12) + (outcome ? 14 : -8));
  const ownership = clamp(46 + (action ? 32 : -14));
  const confidence = clamp(54 + (wc >= 30 ? 10 : -8) + (metric ? 6 : 0) - (vaguePenalty / 2) - blamePenalty);
  const roleFit = clamp(54 + companyDNA.alignmentScore * 0.28 + (metric ? 7 : 0) + (action ? 6 : 0));
  const companyFit = clamp(companyDNA.alignmentScore);
  const trust = clamp(58 + (metric ? 10 : -10) + (action ? 12 : -10) + (outcome ? 8 : -6) - blamePenalty - contradictionPenalty);
  const overall = clamp((clarity * 0.14) + (relevance * 0.14) + (evidence * 0.18) + (ownership * 0.16) + (confidence * 0.12) + (roleFit * 0.12) + (companyFit * 0.06) + (trust * 0.08));

  return {
    overall,
    rubricScore,
    clarity,
    relevance,
    evidence,
    ownership,
    confidence,
    structure: clamp(clarity - 2),
    roleFit,
    companyFit,
    trust,
    hiringConfidence: clamp((overall * 0.55) + (trust * 0.25) + (evidence * 0.2)),
    confidenceLabel: overall >= 82 ? "Strong next-round signal" : overall >= 68 ? "Promising but needs sharper proof" : overall >= 52 ? "Borderline without stronger evidence" : "High recruiter concern",
  };
}

function buildWhatRecruiterHeard(answer: string, scores: ReturnType<typeof buildScores>, evidenceRequests: string[]) {
  if (scores.evidence < 55 && scores.ownership < 60) {
    return "The recruiter hears useful background, but cannot yet separate your personal contribution from the team outcome or verify impact with evidence.";
  }
  if (scores.evidence < 55) {
    return "The recruiter hears a relevant story, but still lacks measurable proof to judge the strength of the outcome.";
  }
  if (scores.ownership < 60) {
    return "The recruiter hears a team effort, but your exact personal ownership is not yet clear enough.";
  }
  if (evidenceRequests.length) {
    return "The recruiter hears potential, but would still probe for sharper structure and more specific proof.";
  }
  return "The recruiter hears a credible, role-relevant answer with enough ownership and evidence to continue positively.";
}

function buildRewrite(answer: string, targetRole: string, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  const role = clean(targetRole, 80) || "the target role";
  const companyFocus = companyDNA.weakestPrinciple?.label || "measurable impact";
  const firstSentence = sentences(answer, 1)[0] || "In my previous role, I handled a relevant challenge.";
  return [
    `In a ${role} context, I would frame it more clearly: ${firstSentence}`,
    "My responsibility was to identify the issue, take ownership of the next action, and coordinate the right people or data needed to solve it.",
    `To make this stronger for a ${companyDNA.label} interviewer, I would add one measurable result and explicitly connect it to ${companyFocus}.`,
  ].join(" ");
}

function buildBenchmark(scores: ReturnType<typeof buildScores>, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  const benchmarks = [
    { label: "Pacing", you: clamp(scores.clarity - 8), top10: 86, advice: "Top candidates stay concise without sounding rushed." },
    { label: "Metric usage", you: scores.evidence, top10: 88, advice: "Top candidates quantify impact in most major answers." },
    { label: "Ownership", you: scores.ownership, top10: 90, advice: "Top candidates make personal contribution obvious." },
    { label: "Structure", you: scores.structure, top10: 87, advice: "Top candidates use clear STAR-style flow." },
    { label: "Trust", you: scores.trust, top10: 90, advice: "Top candidates sound consistent and evidence-backed." },
    { label: companyDNA.weakestPrinciple?.label || "Company DNA", you: companyDNA.weakestPrinciple?.score || companyDNA.alignmentScore, top10: companyDNA.weakestPrinciple?.target || 86, advice: companyDNA.weakestPrinciple?.comment || "Top candidates match company-specific expectations." },
  ];
  return {
    label: `${companyDNA.label} benchmark`,
    top10CandidateGap: clamp(benchmarks.reduce((sum, item) => sum + Math.max(0, item.top10 - item.you), 0) / benchmarks.length),
    benchmarks,
  };
}

function buildLatencyCue(scores: ReturnType<typeof buildScores>, challenge: ChallengeDecision, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  if (challenge.challengeType === "contradiction") return "Let me pause there for a second.";
  if (challenge.severity >= 4) return "Okay, I want to dig into that a bit.";
  if (scores.overall >= 80) return "Good, that gives me useful context.";
  if (companyDNA.key === "consulting") return "Let me structure the next part carefully.";
  return "Got it, that is helpful context.";
}

export function buildInterviewIntelligence95(input: BuildInput) {
  const answer = clean(input.answer, 5000);
  const companyDNA = buildCompanyDNA(input);
  const rubricResult = extractRubric(answer, companyDNA);
  const memory = extractMemory(answer, input.transcript || []);
  const contradictions = detectContradictions(answer, input.transcript || []);
  const evidenceRequests = buildEvidenceRequests(answer, companyDNA);
  const challenge = buildChallenge(answer, evidenceRequests, contradictions, companyDNA);
  const scores = buildScores(answer, rubricResult.score, companyDNA, contradictions);
  const whatRecruiterHeard = buildWhatRecruiterHeard(answer, scores, evidenceRequests);
  const answerRewrites = [buildRewrite(answer, input.targetRole || "", companyDNA)];
  const benchmark = buildBenchmark(scores, companyDNA);
  const latencyCue = buildLatencyCue(scores, challenge, companyDNA);

  const trustDelta = clamp(Math.round((scores.trust - (input.currentTrust || 58)) / 6), -12, 10);
  const redFlags = unique([
    BLAME_RE.test(answer) ? "Possible blame-shifting or unprofessional wording." : "",
    VAGUE_RE.test(answer) ? "Vague wording weakens recruiter confidence." : "",
    !METRIC_RE.test(answer) ? "No measurable outcome provided." : "",
    !ACTION_RE.test(answer) || NO_OWNERSHIP_RE.test(answer) ? "Personal ownership is not clear enough." : "",
    ...contradictions.map((item) => item.challenge),
  ].filter(Boolean), 8);

  return {
    version: "workzo-interview-intelligence-95.2",
    companyDNA,
    rubric: rubricResult.rubric,
    deterministicScore: scores,
    evidenceRequests,
    weakAnswerSignals: evidenceRequests.map((request) => ({ signal: request, severity: challenge.severity })),
    contradictionFindings: contradictions,
    contradictionChallenge: challenge.shouldChallenge && challenge.challengeType === "contradiction"
      ? { shouldChallenge: true, severity: challenge.severity, question: challenge.challengeQuestion, findings: contradictions }
      : null,
    challenge,
    recruiterMemory: memory,
    recruiterConfidence: {
      score: scores.hiringConfidence,
      label: scores.confidenceLabel,
      trustDelta,
      reason: whatRecruiterHeard,
    },
    trustAudit: {
      score: scores.trust,
      deductions: [
        !METRIC_RE.test(answer) ? "-10 missing measurable proof" : "+10 measurable proof present",
        !ACTION_RE.test(answer) || NO_OWNERSHIP_RE.test(answer) ? "-10 weak ownership signal" : "+12 ownership/action language present",
        !OUTCOME_RE.test(answer) ? "-6 missing outcome" : "+8 outcome signal present",
        BLAME_RE.test(answer) ? "-14 blame-shifting risk" : "+4 professional tone maintained",
        contradictions.length ? `-${contradictions.reduce((s, c) => s + c.severity * 5, 0)} contradiction concern` : "+5 no major contradiction detected",
      ],
    },
    whatRecruiterHeard,
    benchmark,
    answerRewrites,
    redFlags,
    latencyCue,
    nextBestAction: challenge.shouldChallenge
      ? challenge.challengeQuestion
      : (memory.callbackQuestion || evidenceRequests[0] || "Give one example with action, result, and measurable proof."),
  };
}

export function decorateJobContextWithCompanyDNA(jobDescription: string, companyDNA: ReturnType<typeof buildCompanyDNA>) {
  const base = clean(jobDescription, 1600);
  const decorator = [
    "",
    "--- WorkZo Company DNA Decorator ---",
    companyDNA.systemDecorator,
    `Weakest current company-DNA signal to probe: ${companyDNA.weakestPrinciple?.label || "Evidence"}.`,
    `Preferred recruiter follow-ups: ${companyDNA.preferredFollowups.join(" | ")}.`,
  ].join("\n");
  return `${base}${decorator}`.trim();
}

export function applyInterviewIntelligence95ToDecision<T extends Record<string, any>>(decision: T, intelligence: ReturnType<typeof buildInterviewIntelligence95>): T {
  const challenge = intelligence.challenge;
  const shouldChallenge = challenge.shouldChallenge && challenge.severity >= 4;
  const spokenReply = shouldChallenge
    ? `${intelligence.latencyCue} ${challenge.challengeQuestion}`.replace(/\s+/g, " ").trim()
    : decision.spokenReply;

  const trustDelta = typeof decision.trustDelta === "number"
    ? clamp(Math.round((decision.trustDelta + intelligence.recruiterConfidence.trustDelta) / 2), -12, 10)
    : intelligence.recruiterConfidence.trustDelta;

  return {
    ...decision,
    spokenReply,
    displayQuestion: shouldChallenge ? challenge.challengeQuestion : decision.displayQuestion,
    feedback: shouldChallenge
      ? `Recruiter challenge triggered: ${challenge.reason}`
      : (decision.feedback || intelligence.whatRecruiterHeard),
    intent: shouldChallenge
      ? (challenge.challengeType === "contradiction" ? "contradiction" : "interview_answer")
      : decision.intent,
    shouldAdvanceQuestion: shouldChallenge ? false : decision.shouldAdvanceQuestion,
    shouldCountAsAnswer: shouldChallenge ? false : decision.shouldCountAsAnswer,
    shouldStayOnCurrentQuestion: shouldChallenge ? true : decision.shouldStayOnCurrentQuestion,
    trustDelta,
    recruiterState: shouldChallenge ? "skeptical" : (decision.recruiterState || "engaged"),
    concern: shouldChallenge ? challenge.reason : (decision.concern || intelligence.whatRecruiterHeard),
    correction: shouldChallenge ? challenge.challengeQuestion : (decision.correction || intelligence.nextBestAction),
    psychology: {
      ...(decision.psychology || {}),
      trust: intelligence.deterministicScore.trust,
      interest: intelligence.deterministicScore.roleFit,
      skepticism: clamp(100 - intelligence.deterministicScore.trust + (challenge.severity * 5)),
      patience: intelligence.deterministicScore.structure,
      engagement: intelligence.deterministicScore.clarity,
      confidenceInCandidate: intelligence.deterministicScore.hiringConfidence,
    },
    recruiterMemory: {
      ...(decision.recruiterMemory || {}),
      summary: intelligence.recruiterMemory.summary,
      strongMoments: [
        ...(decision.recruiterMemory?.strongMoments || []),
        intelligence.deterministicScore.evidence >= 70 ? "Provided measurable evidence." : "Provided some role-relevant context.",
      ].filter(Boolean),
      weakMoments: [
        ...(decision.recruiterMemory?.weakMoments || []),
        ...intelligence.evidenceRequests.slice(0, 3),
      ].filter(Boolean),
      openDoubts: [
        ...(decision.recruiterMemory?.openDoubts || []),
        ...intelligence.redFlags.slice(0, 3),
      ].filter(Boolean),
      roleFitSignals: [
        ...(decision.recruiterMemory?.roleFitSignals || []),
        ...intelligence.recruiterMemory.facts.slice(0, 4),
      ].filter(Boolean),
    },
    memoryEvents: [
      ...(decision.memoryEvents || []),
      ...intelligence.recruiterMemory.structuredFacts.slice(0, 5).map((fact) => ({
        type: "recruiter_memory_fact",
        severity: fact.importance === "high" ? "medium" : "low",
        detail: `${fact.label}: ${fact.value}`,
      })),
      ...intelligence.contradictionFindings.map((item) => ({
        type: "contradiction_signal",
        severity: item.severity >= 4 ? "high" : "medium",
        detail: item.challenge,
      })),
    ],
    pressure: {
      level: shouldChallenge ? clamp(55 + challenge.severity * 8) : clamp(38 + Math.max(0, 75 - intelligence.deterministicScore.evidence) / 2),
      label: shouldChallenge ? "challenge" : "adaptive",
      reason: shouldChallenge ? challenge.reason : intelligence.whatRecruiterHeard,
      behaviorShift: shouldChallenge ? "Recruiter pauses standard flow and asks for clarification or evidence." : "Recruiter continues but remembers the evidence gaps.",
    },
    honestFeedback: {
      headline: shouldChallenge ? "Recruiter challenge" : "Recruiter read",
      recruiterRead: intelligence.whatRecruiterHeard,
      risk: intelligence.redFlags[0] || "No major red flag detected, but stronger evidence would improve confidence.",
      nextFix: intelligence.nextBestAction,
    },
    workzoInterviewIntelligence95: intelligence,
    companyDNA: intelligence.companyDNA,
    deterministicScore: intelligence.deterministicScore,
    contradictionChallenge: intelligence.contradictionChallenge,
    latencyCue: intelligence.latencyCue,
    whatRecruiterHeard: intelligence.whatRecruiterHeard,
    benchmark: intelligence.benchmark,
    answerRewrites: intelligence.answerRewrites,
  } as T;
}
