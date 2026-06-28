import OpenAI from "openai";
import { selectRoleKnowledgeBlock } from "@/lib/workzoRoleKnowledge";

export type TranscriptItem = {
  role: "candidate" | "recruiter" | "system";
  text: string;
  time?: string;
};

export type CandidateIntent =
  | "greeting"
  | "smalltalk"
  | "clarification"
  | "candidate_question"
  | "interruption"
  | "interview_answer"
  | "partial_answer"
  | "offtopic"
  | "nonsense"
  | "possible_exaggeration"
  | "contradiction";

export type UnifiedRecruiterPsychology = {
  trust: number;
  interest: number;
  skepticism: number;
  patience: number;
  engagement: number;
  confidenceInCandidate: number;
};

export type CandidateSocialSignals = {
  nervousness: number;
  defensiveness: number;
  confidence: number;
  authenticity: number;
  avoidance: number;
  clarity: number;
  ownership: number;
  emotionalRead: string;
  recruiterReaction: string;
};

export type CandidateEvidenceProfile = {
  likelyRoles: string[];
  companies: string[];
  skills: string[];
  industries: string[];
  experienceSignals: string[];
  senioritySignals: string[];
  supportSignals: string[];
  customerSignals: string[];
  projectSignals: string[];
  educationSignals: string[];
  timelineSignals: string[];
  summary: string;
};

export type RecruiterMemoryProfile = {
  notableClaims: string[];
  roleClaims: string[];
  companyClaims: string[];
  skillClaims: string[];
  metricClaims: string[];
  contradictionSignals: string[];
  strongMoments: string[];
  weakMoments: string[];
  roleFitSignals: string[];
  openDoubts: string[];
  strongestAnswer?: string;
  weakestAnswer?: string;
  lastAcceptedAnswer?: string;
  answerCount: number;
  summary: string;
};

export type RecruiterMemoryEvent = {
  type:
    | "claim"
    | "contradiction"
    | "strength"
    | "weakness"
    | "doubt"
    | "callback";
  text: string;
  weight: number;
};

export type UnifiedRecruiterDecision = {
  intent: CandidateIntent;
  spokenReply: string;
  displayQuestion: string;
  shouldAdvanceQuestion: boolean;
  shouldCountAsAnswer: boolean;
  shouldStayOnCurrentQuestion: boolean;
  trustDelta: number;
  recruiterState:
    | "neutral"
    | "interested"
    | "engaged"
    | "skeptical"
    | "pressuring"
    | "recovering_trust"
    | "losing_confidence";
  feedback: string;
  correction?: string;
  concern?: string;
  psychology: UnifiedRecruiterPsychology;
  cvRead?: CandidateEvidenceProfile;
  recruiterMemory?: RecruiterMemoryProfile;
  memoryEvents?: RecruiterMemoryEvent[];
  pressure?: {
    level: number;
    label: "low" | "moderate" | "high" | "intense";
    reason: string;
    behaviorShift: string;
  };
  honestFeedback?: {
    headline: string;
    recruiterRead: string;
    risk: string;
    nextFix: string;
  };
  recruiterMemoryInsight?: {
    recallMode:
      | "none"
      | "subtle_callback"
      | "active_doubt"
      | "recovery_moment"
      | "credibility_watch";
    callbackLine: string;
    rememberedSignal: string;
    openDoubt: string;
    strongestMoment: string;
    weakestMoment: string;
  };
  livePressureSimulation?: {
    pressureMode: "calm" | "focused" | "tightening" | "direct" | "recovery";
    pacingCue: string;
    warmthCue: string;
    silenceCue: string;
    nextFollowUpStyle: string;
    interruptionRisk: "rare" | "possible" | "likely";
  };
  marketExpectation?: {
    market: string;
    interviewerStyle: string;
    evaluatesFor: string[];
    warningSignals: string[];
    followUpBias: string;
  };
  humanImperfection?: {
    mode:
      | "none"
      | "brief_pause"
      | "misunderstanding"
      | "topic_drift"
      | "revisit_later"
      | "impatient_shortening";
    cue: string;
    naturalLine: string;
    shouldUse: boolean;
  };
  socialSignals?: CandidateSocialSignals;
  cinematicRealism?: {
    emotionalBeat:
      | "neutral"
      | "warming"
      | "tightening"
      | "doubt"
      | "recovery"
      | "curiosity"
      | "reset";
    pauseBeforeSpeakingMs: number;
    recruiterMicroBehavior: string;
    naturalTransition: string;
    shouldUseSilence: boolean;
    shouldSoften: boolean;
    shouldNarrowCandidate: boolean;
  };
  conversationStage?:
    | "audio_check"
    | "rapport"
    | "background"
    | "role_fit"
    | "behavioral"
    | "skill_gap"
    | "strengths"
    | "weakness"
    | "closing";
};

export type UnifiedRecruiterInput = {
  answer: string;
  currentQuestion: string;
  transcript?: TranscriptItem[];
  setup?: {
    cvText?: string;
    jobDescription?: string;
    resumeProfile?: unknown;
    targetRole?: string;
    targetMarket?: string;
    companyStyle?: string;
    recruiterPersonality?: string;
    language?: string;
    candidateName?: string;
    targetCompany?: string;
    recruiterName?: string;
    recruiterTitle?: string;
    recruiterMemoryProfile?: unknown;
    jobMemoryProfile?: unknown;
    // Technical mode: candidate's live code and language
    codeSnapshot?: string;
    codeLanguage?: string;
    // Pre-computed recruiter brain state from recruiterBrainEngine.ts
    // Injected by /api/interview/route.ts before each LLM call.
    recruiterBrainContext?: string;
    // Universal role intelligence brief — generated by workzoRoleIntelligence.ts
    // Contains role-specific competencies, probes, red/green flags for ANY role.
    roleBriefContext?: string;
    // Current interview question (for reply route continuity)
    currentQuestion?: string;
    // Company description extracted from URL scrape
    companyDescription?: string;
  };
  recruiterTrust?: number;
  recruiterState?: string | null;
};

// ============================================================
// SECTION: Core utilities
// ============================================================

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}


// Phase 1.5 semantic recovery for noisy speech-to-text.
// This is intentionally conservative: it only adds recovered context when nearby
// words already show a customer-support/router/Wi-Fi situation. It does not
// rewrite the user's answer for display; it gives the recruiter brain a cleaner
// analysis input so a valid spoken example is not rejected as vague.
// ============================================================
// SECTION: Speech-to-text recovery
// ============================================================

function recoverNoisySpokenTranscript(textRaw: string) {
  let text = cleanText(textRaw);
  if (!text) return text;

  // Generic phonetic STT corrections safe for any candidate.
  // Brand-specific substitutions removed — they corrupt answers from candidates
  // who were not talking about those products.
  text = text
    .replace(/\bp2b\b/gi, "B2B")
    .replace(/\bb\s*two\s*b\b/gi, "B2B")
    .replace(/\bb\s*to\s*b\b/gi, "B2B")
    .replace(/\bb2\s*c\b/gi, "B2C")
    .replace(/\bb\s*two\s*c\b/gi, "B2C")
    .replace(/\bb\s*to\s*c\b/gi, "B2C")
    .replace(/\baffirmware\b/gi, "firmware")
    .replace(/\ba firmware\b/gi, "firmware")
    .replace(/\bwrap with\b/gi, "rapport with")
    .replace(/\bgood wrap\b/gi, "good rapport")
    .replace(/\bbuild a wrap\b/gi, "build rapport")
    .replace(/\brapple\b/gi, "rapport");

  return cleanText(text);
}

function recoverUnifiedRecruiterInput(input: UnifiedRecruiterInput): UnifiedRecruiterInput {
  const recoveredAnswer = recoverNoisySpokenTranscript(input.answer);
  if (recoveredAnswer === cleanText(input.answer)) return input;

  return {
    ...input,
    answer: recoveredAnswer,
    transcript: (input.transcript || []).map((item, index, arr) => {
      if (item.role !== "candidate") return item;
      const isLastCandidate = arr.slice(index + 1).every((next) => next.role !== "candidate");
      return isLastCandidate ? { ...item, text: recoveredAnswer } : item;
    }),
  };
}

function compact(value: string, max = 180) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function unique(values: string[], limit = 8) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw).replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "");
    if (!value || value.length < 2) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function extractMatches(text: string, patterns: RegExp[], limit = 8) {
  const values: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      values.push(match[1] || match[0]);
    }
  }
  return unique(values, limit);
}

function extractRoleFromJobDescription(jobDescription: string) {
  const lines = jobDescription
    .split(/\n|\.|\||-/)
    .map((line) => line.trim())
    .filter(Boolean);

  const roleLine = lines.find((line) =>
    /\b(role|position|title|job)\b/i.test(line),
  );

  if (roleLine) {
    return roleLine
      .replace(/^(role|position|title|job)\s*:?\s*/i, "")
      .slice(0, 80);
  }

  const match = jobDescription.match(
    /\b(customer success manager|customer success|data analyst|business analyst|technical support|support engineer|product manager|software engineer|frontend developer|backend developer|sales manager|marketing manager|project manager|product designer|ux designer|qa engineer|data scientist|account manager)\b/i,
  );

  return match?.[0] || "";
}

// ============================================================
// SECTION: CV / evidence profile extraction
// ============================================================

function buildEvidenceProfile(
  cvTextRaw: string,
  jobDescriptionRaw: string,
  resumeProfileRaw?: unknown,
): CandidateEvidenceProfile {
  const cvText = cleanText(cvTextRaw);
  const jobDescription = cleanText(jobDescriptionRaw);
  const source = `${cvText} ${jobDescription}`;

  const likelyRoles = extractMatches(
    cvText,
    [
      /\b(technical support engineer|customer support engineer|support engineer|customer success manager|customer success specialist|data analyst|business analyst|software engineer|frontend developer|backend developer|product manager|project manager|qa engineer|technical consultant|implementation consultant|account manager|product designer|ux designer)\b/gi,
      /(?:experience|role|position|title)\s*[:\-]\s*([^.;\n]{3,70})/gi,
    ],
    10,
  );

  // PRIMARY: read company names directly from resumeProfile.experience — exact and
  // unambiguous. The regex fallback below misses companies not in the brand allowlist because they
  // are not in the hardcoded brand allowlist AND don\'t appear after "at|@" in structured
  // bullet-format CV text ("- Title • Company • Dates" has no preposition before the name).
  const profileCompanies: string[] = [];
  const _rp = resumeProfileRaw as Record<string, unknown> | null | undefined;
  if (_rp && typeof _rp === "object" && Array.isArray(_rp.experience)) {
    for (const _exp of _rp.experience as Array<Record<string, unknown>>) {
      const _co = String(_exp.company || "").trim();
      if (_co.length >= 2 && _co.length <= 70) profileCompanies.push(_co);
    }
  }

  // SECONDARY: structural extraction from bullet/pipe-separated CV lines.
  // Handles "- Title • Company • Dates" format by splitting on separators and
  // filtering out segments that look like job titles or date ranges.
  const structuralCompanies: string[] = [];
  if (!profileCompanies.length) {
    const _jobTitlePfx = /^(technical support|application engineer|software engineer|data analyst|business analyst|product manager|project manager|qa engineer|marketing|intern|trainee|frontend|backend|customer success|customer support|it support)/i;
    const _datePfx = /^(19|20)\d{2}|^(present|current|today|heute)/i;
    for (const _line of cvText.split(/\n|\r/).filter(Boolean)) {
      const _segs = _line.split(/[•·|]/).map((s) =>
        s.replace(/^[-*\s]+/, "").replace(/\d{4}.*$/, "").replace(/\s{2,}/g, " ").trim(),
      );
      for (const _seg of _segs) {
        if (_seg.length < 2 || _seg.length > 70) continue;
        if (/^[0-9\-/ .]+$/.test(_seg)) continue;
        if (_datePfx.test(_seg)) continue;
        if (_jobTitlePfx.test(_seg)) continue;
        if (/^[A-Z]/.test(_seg) && /[a-zA-Z]{2}/.test(_seg)) {
          structuralCompanies.push(_seg);
        }
      }
    }
  }

  // TERTIARY: well-known brand regex — supplements the above, does not replace it.
  const brandCompanies = extractMatches(
    cvText,
    [
      /\b(Zoho|Microsoft|Amazon|Google|Tesla|Apple|Meta|Facebook|eBay|Salesforce|SAP|Oracle|IBM|Infosys|TCS|Wipro|Accenture|Deloitte|Capgemini|Cognizant|Freshworks|HubSpot|ServiceNow|Zendesk|Atlassian|Adobe|Netflix|Uber|Airbnb|Stripe|Shopify)\b/gi,
      /(?:at|@)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})(?:\s|,|\.|\n)/g,
    ],
    10,
  );

  const companies = unique(
    [...profileCompanies, ...structuralCompanies, ...brandCompanies],
    12,
  );

  const skills = extractMatches(
    source,
    [
      /\b(Python|SQL|Excel|Tableau|Power BI|Looker|Salesforce|HubSpot|Zendesk|Freshdesk|Jira|Confluence|CRM|SaaS|API|REST|JavaScript|TypeScript|React|Next\.js|Node\.js|AWS|Azure|GCP|Docker|Kubernetes|Machine Learning|Generative AI|LLM|OpenAI|Streamlit|Supabase|Firebase|Vercel|GitHub|Figma|UX|UI)\b/gi,
    ],
    16,
  );

  const industries = extractMatches(
    source,
    [
      /\b(SaaS|B2B|B2C|e-commerce|fintech|healthcare|education|automotive|cloud|enterprise software|consumer products|marketplace|telecom|banking|retail)\b/gi,
    ],
    10,
  );

  const experienceSignals = extractMatches(
    cvText,
    [
      /\b(\d+\+?\s*(?:years|yrs)\s+(?:of\s+)?experience)\b/gi,
      /\b(worked with [^.;\n]{3,90})/gi,
      /\b(resolved [^.;\n]{3,90})/gi,
      /\b(supported [^.;\n]{3,90})/gi,
      /\b(managed [^.;\n]{3,90})/gi,
      /\b(handled [^.;\n]{3,90})/gi,
    ],
    8,
  );

  const senioritySignals = extractMatches(
    cvText,
    [
      /\b(intern|junior|associate|executive|specialist|engineer|senior|lead|manager|head|director)\b/gi,
    ],
    8,
  );

  const supportSignals = extractMatches(
    source,
    [
      /\b(ticket(?:ing)?|SLA|escalation|troubleshooting|root cause|customer issue|technical support|helpdesk|incident|bug|resolution|support workflow|knowledge base)\b/gi,
    ],
    10,
  );

  const customerSignals = extractMatches(
    source,
    [
      /\b(customer success|customer retention|onboarding|renewal|churn|stakeholder|account health|customer satisfaction|CSAT|NPS|relationship management|enterprise customer|B2B client|B2C customer)\b/gi,
    ],
    10,
  );

  const projectSignals = extractMatches(
    cvText,
    [
      /\b(project(?:s)?\s*[:\-]\s*[^.;\n]{3,90})/gi,
      /\b(built [^.;\n]{3,90})/gi,
      /\b(created [^.;\n]{3,90})/gi,
      /\b(developed [^.;\n]{3,90})/gi,
      /\b(implemented [^.;\n]{3,90})/gi,
    ],
    8,
  );

  const educationSignals = extractMatches(
    cvText,
    [
      /\b(Bachelor(?:'s)?|Master(?:'s)?|MBA|B\.Tech|M\.Tech|BSc|MSc|bootcamp|certification|degree|diploma)\b[^.;\n]{0,80}/gi,
    ],
    8,
  );

  const timelineSignals = extractMatches(
    cvText,
    [
      /\b(20\d{2}\s*(?:-|–|to)\s*(?:20\d{2}|present|current|now))\b/gi,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\s*(?:-|–|to)\s*(?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2})\b/gi,
    ],
    8,
  );

  const summaryParts = [
    likelyRoles.length
      ? `Likely background: ${likelyRoles.slice(0, 3).join(", ")}`
      : "Background unclear from CV",
    companies.length
      ? `Companies mentioned: ${companies.slice(0, 4).join(", ")}`
      : "No clear companies found",
    skills.length
      ? `Skills/tools: ${skills.slice(0, 6).join(", ")}`
      : "Few explicit tools found",
    customerSignals.length || supportSignals.length
      ? `Customer/support signals: ${[...customerSignals, ...supportSignals].slice(0, 5).join(", ")}`
      : "Limited customer/support evidence found",
  ];

  return {
    likelyRoles,
    companies,
    skills,
    industries,
    experienceSignals,
    senioritySignals,
    supportSignals,
    customerSignals,
    projectSignals,
    educationSignals,
    timelineSignals,
    summary: summaryParts.join(". "),
  };
}

function tokenizeMeaning(text: string) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "role",
    "job",
    "you",
    "your",
    "are",
    "was",
    "were",
    "have",
    "has",
    "had",
    "from",
    "into",
    "about",
    "tell",
    "little",
    "experience",
    "candidate",
    "question",
    "what",
    "when",
    "where",
    "why",
    "how",
  ]);
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
}

function overlapScore(answer: string, evidence: string[]) {
  const answerTokens = new Set(tokenizeMeaning(answer));
  if (!answerTokens.size) return 0;
  let hits = 0;
  for (const item of evidence) {
    for (const token of tokenizeMeaning(item)) {
      if (answerTokens.has(token)) hits += 1;
    }
  }
  return hits;
}


function findMissingJobSkills(cvText: string, jobDescription: string) {
  const cvSkills = new Set(
    extractSkillClaims(cvText).map((skill) => skill.toLowerCase()),
  );
  return unique(extractSkillClaims(jobDescription), 18)
    .filter((skill) => !cvSkills.has(skill.toLowerCase()))
    .slice(0, 4);
}

function hasAskedRecently(input: UnifiedRecruiterInput, pattern: RegExp) {
  return (input.transcript || [])
    .filter((item) => item.role === "recruiter")
    .slice(-8)
    .some((item) => pattern.test(cleanText(item.text)));
}

function recentCandidateText(input: UnifiedRecruiterInput, take = 8) {
  return (input.transcript || [])
    .filter((item) => item.role === "candidate")
    .slice(-take)
    .map((item) => cleanText(item.text))
    .join(" ");
}

function recentRecruiterText(input: UnifiedRecruiterInput, take = 8) {
  return (input.transcript || [])
    .filter((item) => item.role === "recruiter")
    .slice(-take)
    .map((item) => cleanText(item.text))
    .join(" ");
}

function hasCustomerSuccessRoleFit(
  answer: string,
  targetRole: string,
  input: UnifiedRecruiterInput,
) {
  const role = cleanText(targetRole).toLowerCase();
  if (
    !/customer success|customer service|account manager|support|client/i.test(
      role,
    )
  )
    return false;
  const evidence = `${answer} ${recentCandidateText(input, 5)}`.toLowerCase();
  return /customer|client|support|ticket|satisfaction|csat|rapport|relationship|resolved|issue|escalation|technical support|b2b|b2c|retention|onboarding/.test(
    evidence,
  );
}

function buildMemoryAwareCallbackQuestion(
  input: UnifiedRecruiterInput,
  cvRead: CandidateEvidenceProfile,
  targetRole: string,
) {
  const recent =
    `${recentCandidateText(input, 8)} ${cvRead.summary} ${targetRole}`.toLowerCase();
  const askedStrength = hasAskedRecently(
    input,
    /strongest professional strength|what.*strength|best at/i,
  );
  const askedWeakness = hasAskedRecently(
    input,
    /weakness|development area|challenge/i,
  );
  const askedCustomer = hasAskedRecently(
    input,
    /difficult customer|customer situation|unhappy customer|escalation/i,
  );
  const askedLearning = hasAskedRecently(
    input,
    /learn.*quick|learn something quickly|adapt/i,
  );

  // BUG FIXED: this used to assert a specific, invented personal narrative
  // ("you mentioned learning German after moving to Germany") triggered by
  // ANY match of the word "german"/"language" anywhere in recent context —
  // including a CV's static language-skills line the candidate never
  // actually talked about. Confirmed from live testing: this fired on a
  // candidate who never mentioned Germany at all, just had a language listed
  // on their CV. Never assert what the candidate said — ask, don't claim.
  if (
    /language|grammar|fluent|learn the language/.test(recent) &&
    !askedLearning
  ) {
    return "I want to follow up on adapting quickly — tell me about a recent situation at work where you had to learn something new fast, and how you handled it.";
  }

  // BUG FIXED: this fired for every role regardless of fit — a manufacturing
  // or engineering candidate would get a customer-service question purely
  // because the word "support" or "client" appeared anywhere nearby. Gated
  // to roles that are actually customer-facing.
  const isCustomerFacingRole = /customer|client|account|support|success|sales/i.test(targetRole);
  if (
    isCustomerFacingRole &&
    /customer|client|support|ticket|satisfaction|rapport|relationship|csat/.test(
      recent,
    ) &&
    !askedCustomer
  ) {
    return `That customer-facing experience is relevant for ${targetRole}. Tell me about one difficult customer situation you handled and how you recovered it.`;
  }

  if (
    /weakness|grammar|language|not sure|improve/.test(recent) &&
    askedWeakness
  ) {
    return isCustomerFacingRole
      ? "Thanks for being honest. How are you actively improving that area, and how would you make sure it does not affect customers?"
      : "Thanks for being honest. How are you actively improving that area, and how would you make sure it does not affect your work?";
  }

  const missingSkills = findMissingJobSkills(
    cleanText(input.setup?.cvText),
    cleanText(input.setup?.jobDescription),
  );
  if (
    missingSkills.length &&
    !hasAskedRecently(
      input,
      new RegExp(missingSkills[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    )
  ) {
    const skill = missingSkills[0];
    return `I see ${skill} in the role requirements, but I don’t see strong evidence of it in your CV. Have you used it before, or how would you close that gap?`;
  }

  if (!askedStrength) {
    return "What would you say is your strongest professional strength, and can you back it up with one example?";
  }

  return isCustomerFacingRole
    ? `Let’s make this practical for ${targetRole}. Imagine a customer is unhappy after repeated technical issues. How would you handle that conversation?`
    : `Let's make this practical for ${targetRole}. Walk me through a real situation where something went wrong on your side and you had to personally fix it under pressure.`;
}

function buildNaturalNextQuestion(
  input: UnifiedRecruiterInput,
  cvRead: CandidateEvidenceProfile,
  memory: RecruiterMemoryProfile,
  answer: string,
) {
  const setup = input.setup || {};
  const jobDescription = cleanText(setup.jobDescription);
  const cvText = cleanText(setup.cvText);
  const targetRole = firstNonEmpty(
    setup.targetRole,
    extractRoleFromJobDescription(jobDescription),
    "this role",
  );
  const turns = (input.transcript || []).filter(
    (item) => item.role === "candidate",
  ).length;
  const missingSkills = findMissingJobSkills(cvText, jobDescription);
  const answerLower = answer.toLowerCase();

  if (turns <= 1) {
    if (isCustomerSuccessShortBackgroundAnswer(answer, targetRole, input)) {
      return buildCustomerSuccessDepthQuestion(input, answer, targetRole);
    }
    return `Thanks. What is making you interested in ${targetRole} at this point in your career?`;
  }

  // Follow the candidate's thread first. This is what makes it feel like a real interviewer.
  if (
    /learn(ed|ing)? (a |the )?(new |quickly|fast)|quick learner|picked up (a |the )?new/i.test(
      answerLower,
    )
  ) {
    return "You mentioned learning quickly. Tell me about a work situation where you had to learn a new process, tool, or product fast.";
  }

  if (
    /customer|client|ticket|support|stakeholder|relationship|satisfaction|rapport|csat/i.test(
      answerLower,
    )
  ) {
    if (hasCustomerSuccessRoleFit(answer, targetRole, input)) {
      return `That customer-facing experience is relevant for ${targetRole}. Tell me about one difficult customer situation you handled and what you learned from it.`;
    }
    return "Can you give me one real example where that relationship became difficult and how you handled it?";
  }

  if (/data|analysis|sql|excel|dashboard|metric|report/i.test(answerLower)) {
    return "Walk me through one decision you made using data or evidence. What changed because of it?";
  }

  if (/team|led|manage|coordinated|collaborated/i.test(answerLower)) {
    return "When you say you coordinated or led that work, what exactly was your responsibility compared with the rest of the team?";
  }

  if (missingSkills.length && turns <= 5) {
    const skill = missingSkills[0];
    return `I see ${skill} in the role requirements, but I don’t see strong evidence of it in your CV. Have you used it before, or how would you close that gap?`;
  }

  if ((memory.openDoubts || []).length) {
    return `Earlier I was still unsure about ${compact(memory.openDoubts[0], 70)}. Can you clarify that with one concrete example?`;
  }

  return buildMemoryAwareCallbackQuestion(input, cvRead, targetRole);
}

function extractKnownCompanyMentions(text: string, limit = 8) {
  return extractMatches(
    text,
    [
      /\b(Zoho|Microsoft|Amazon|Google|Tesla|Apple|Meta|Facebook|eBay|Salesforce|SAP|Oracle|IBM|Infosys|TCS|Wipro|Accenture|Deloitte|Capgemini|Cognizant|Freshworks|HubSpot|ServiceNow|Zendesk|Atlassian|Adobe|Netflix|Uber|Airbnb|Stripe|Shopify|OpenAI|Anthropic|Nvidia|Toyota|BMW|Mercedes|Siemens|Bosch)\b/gi,
    ],
    limit,
  );
}

function extractNumberedClaims(text: string) {
  return extractMatches(
    text,
    [
      /\b(\d+\+?\s*(?:years|yrs|months|people|engineers|customers|clients|tickets|cases|projects|percent|%|million|thousand|k|m))\b/gi,
      /\b(?:increased|reduced|improved|saved|grew|decreased|resolved|handled|managed|led)\s+[^.;\n]{0,70}?\b(\d+\+?\s*(?:%|percent|people|customers|clients|tickets|cases|projects|hours|days|weeks|months|years|k|m|million))\b/gi,
    ],
    8,
  );
}

function extractRoleClaims(text: string) {
  return extractMatches(
    text,
    [
      /\b(technical support engineer|customer support engineer|support engineer|customer success manager|customer success specialist|data analyst|business analyst|software engineer|frontend developer|backend developer|product manager|project manager|qa engineer|technical consultant|implementation consultant|account manager|product designer|ux designer|product design engineer|mechanical engineer|sales manager|marketing manager|founder|ceo|cto|director|head of [a-z ]+)\b/gi,
      /\b(?:worked as|role was|i was a|i am a|i joined as|position was)\s+([^.;\n]{3,55})/gi,
    ],
    8,
  );
}

function extractSkillClaims(text: string) {
  return extractMatches(
    text,
    [
      /\b(Python|SQL|Excel|Tableau|Power BI|Looker|Salesforce|HubSpot|Zendesk|Freshdesk|Jira|Confluence|CRM|SaaS|API|REST|JavaScript|TypeScript|React|Next\.js|Node\.js|AWS|Azure|GCP|Docker|Kubernetes|Machine Learning|Generative AI|LLM|OpenAI|Streamlit|Supabase|Firebase|Vercel|GitHub|Figma|UX|UI|Photoshop|Microsoft Word|PowerPoint|SAP|Oracle|ServiceNow)\b/gi,
    ],
    12,
  );
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean)
    : [];
}

function normalizeExternalMemory(
  value: unknown,
): Partial<RecruiterMemoryProfile> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  return {
    notableClaims: safeArray(raw.notableClaims),
    roleClaims: safeArray(raw.roleClaims),
    companyClaims: safeArray(raw.companyClaims),
    skillClaims: safeArray(raw.skillClaims),
    metricClaims: safeArray(raw.metricClaims),
    contradictionSignals: safeArray(raw.contradictionSignals),
    strongMoments: safeArray(raw.strongMoments),
    weakMoments: safeArray(raw.weakMoments),
    roleFitSignals: safeArray(raw.roleFitSignals),
    openDoubts: safeArray(raw.openDoubts),
    strongestAnswer: cleanText(raw.strongestAnswer),
    weakestAnswer: cleanText(raw.weakestAnswer),
    lastAcceptedAnswer: cleanText(raw.lastAcceptedAnswer),
    answerCount:
      typeof raw.answerCount === "number" ? raw.answerCount : undefined,
    summary: cleanText(raw.summary),
  };
}

function scoreAnswerMemory(text: string) {
  const answer = cleanText(text);
  let score = 0;
  if (
    /\b(i|my|personally|owned|handled|managed|led|built|created|resolved|improved|coordinated|analyzed|implemented)\b/i.test(
      answer,
    )
  )
    score += 2;
  if (
    /\b(result|impact|improved|reduced|increased|saved|resolved|closed|delivered|launched|customer satisfaction|csat|nps|sla|%|\d+)\b/i.test(
      answer,
    )
  )
    score += 3;
  if (
    /\b(customer|client|stakeholder|support|success|ticket|escalation|retention|onboarding|renewal|business)\b/i.test(
      answer,
    )
  )
    score += 2;
  if (
    /\b(not sure|maybe|i guess|something|stuff|things|basically|whatever|i don'?t know)\b/i.test(
      answer,
    )
  )
    score -= 3;
  if (answer.split(/\s+/).length < 12) score -= 2;
  return score;
}

// ============================================================
// SECTION: Recruiter memory — build & update
// ============================================================

function buildRecruiterMemoryProfile(
  transcript: TranscriptItem[] | undefined,
  profile: CandidateEvidenceProfile,
  external?: unknown,
): RecruiterMemoryProfile {
  const ext = normalizeExternalMemory(external);
  const candidateTurns = (transcript || [])
    .filter((item) => item.role === "candidate")
    .map((item) => cleanText(item.text))
    .filter(Boolean);

  const notableClaims = unique(
    [
      ...(ext.notableClaims || []),
      ...candidateTurns.flatMap((turn) =>
        extractMatches(
          turn,
          [
            /\b(?:I|we)\s+(?:led|managed|built|created|implemented|designed|resolved|improved|handled|owned|launched)\s+[^.;\n]{4,100}/gi,
          ],
          4,
        ),
      ),
    ],
    14,
  );

  const roleClaims = unique(
    [
      ...(ext.roleClaims || []),
      ...profile.likelyRoles,
      ...candidateTurns.flatMap(extractRoleClaims),
    ],
    12,
  );
  const companyClaims = unique(
    [
      ...(ext.companyClaims || []),
      ...profile.companies,
      ...candidateTurns.flatMap((turn) => extractKnownCompanyMentions(turn, 8)),
    ],
    12,
  );
  const skillClaims = unique(
    [
      ...(ext.skillClaims || []),
      ...profile.skills,
      ...candidateTurns.flatMap(extractSkillClaims),
    ],
    18,
  );
  const metricClaims = unique(
    [
      ...(ext.metricClaims || []),
      ...candidateTurns.flatMap(extractNumberedClaims),
    ],
    12,
  );

  let strongestAnswer = cleanText(ext.strongestAnswer);
  let weakestAnswer = cleanText(ext.weakestAnswer);
  let strongestScore = strongestAnswer
    ? scoreAnswerMemory(strongestAnswer)
    : -999;
  let weakestScore = weakestAnswer ? scoreAnswerMemory(weakestAnswer) : 999;

  for (const turn of candidateTurns) {
    const score = scoreAnswerMemory(turn);
    if (score > strongestScore) {
      strongestScore = score;
      strongestAnswer = turn;
    }
    if (score < weakestScore) {
      weakestScore = score;
      weakestAnswer = turn;
    }
  }

  const strongMoments = unique(
    [
      ...(ext.strongMoments || []),
      ...(strongestAnswer && strongestScore >= 4
        ? [compact(strongestAnswer, 160)]
        : []),
    ],
    6,
  );

  const weakMoments = unique(
    [
      ...(ext.weakMoments || []),
      ...(weakestAnswer && weakestScore <= 0
        ? [compact(weakestAnswer, 160)]
        : []),
    ],
    6,
  );

  const roleFitSignals = unique(
    [
      ...(ext.roleFitSignals || []),
      ...profile.customerSignals,
      ...profile.supportSignals,
      ...profile.projectSignals,
    ],
    10,
  );

  const contradictionSignals = unique(
    [...(ext.contradictionSignals || [])],
    10,
  );
  const openDoubts = unique([...(ext.openDoubts || [])], 10);
  const lastAcceptedAnswer =
    cleanText(ext.lastAcceptedAnswer) ||
    candidateTurns[candidateTurns.length - 1] ||
    "";
  const answerCount = Math.max(
    typeof ext.answerCount === "number" ? ext.answerCount : 0,
    candidateTurns.length,
  );

  const summary =
    cleanText(ext.summary) ||
    [
      roleClaims.length
        ? `Role memory: ${roleClaims.slice(0, 3).join(", ")}`
        : "Role memory unclear",
      companyClaims.length
        ? `Company memory: ${companyClaims.slice(0, 4).join(", ")}`
        : "No strong company memory",
      metricClaims.length
        ? `Evidence memory: ${metricClaims.slice(0, 3).join(", ")}`
        : "Few measurable claims remembered",
      weakMoments.length
        ? "There are weak/unclear moments to revisit carefully"
        : "No major weak moment yet",
    ].join(". ");

  return {
    notableClaims,
    roleClaims,
    companyClaims,
    skillClaims,
    metricClaims,
    contradictionSignals,
    strongMoments,
    weakMoments,
    roleFitSignals,
    openDoubts,
    strongestAnswer: strongestAnswer || undefined,
    weakestAnswer: weakestAnswer || undefined,
    lastAcceptedAnswer: lastAcceptedAnswer || undefined,
    answerCount,
    summary,
  };
}

// ============================================================
// SECTION: Contradiction & CV conflict detection
// ============================================================

function detectMeaningContradiction(
  answer: string,
  profile: CandidateEvidenceProfile,
  memory: RecruiterMemoryProfile,
) {
  const lower = answer.toLowerCase();
  const evidenceText =
    `${profile.summary} ${memory.summary} ${memory.roleClaims.join(" ")} ${memory.companyClaims.join(" ")} ${memory.skillClaims.join(" ")} ${memory.notableClaims.join(" ")}`.toLowerCase();

  if (
    /\b(no|none|never)\b[^.]{0,35}\b(customer|client|support|ticket|stakeholder|b2b|b2c)\b/i.test(
      lower,
    ) &&
    /customer|client|support|ticket|stakeholder|b2b|b2c/.test(evidenceText)
  ) {
    return "Earlier/CV evidence points to customer or support exposure, but this answer says there was none.";
  }

  if (
    /\b(no|none|never)\b[^.]{0,35}\b(sql|python|crm|api|salesforce|zendesk|jira|excel|power bi|tableau)\b/i.test(
      lower,
    )
  ) {
    const denied = extractSkillClaims(answer).find((skill) =>
      evidenceText.includes(skill.toLowerCase()),
    );
    if (denied)
      return `This answer denies ${denied}, but that skill/tool appears in the CV or earlier answers.`;
  }

  const years = [...lower.matchAll(/\b(\d{1,2})\+?\s*(?:years|yrs)\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  const evidenceYears = [
    ...evidenceText.matchAll(
      /\b(\d{1,2})\+?\s*(?:years|yrs|years of experience)\b/g,
    ),
  ]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  if (years.length && evidenceYears.length) {
    const maxClaim = Math.max(...years);
    const maxEvidence = Math.max(...evidenceYears);
    if (maxClaim >= maxEvidence + 4)
      return `The experience length jumped from about ${maxEvidence} years in the evidence to ${maxClaim} years in this answer.`;
  }

  if (
    /\bb2b\b[^.]{0,45}\bconsumer\b/i.test(lower) ||
    /\bb2c\b[^.]{0,45}\bbusiness\b/i.test(lower)
  ) {
    return "The B2B/B2C explanation is reversed or confused.";
  }

  if (/\b(zohoo|zohho|zogo)\b/i.test(lower))
    return "The company name appears to be misspelled; it is usually Zoho.";
  if (/\b(e bay|ebya|ebey)\b/i.test(lower))
    return "The company name appears to be misspelled; it is usually eBay.";
  if (/\bmicrosft|micro soft\b/i.test(lower))
    return "The company name appears to be misspelled; it is usually Microsoft.";
  if (/\bamazn|amazone\b/i.test(lower))
    return "The company name appears to be misspelled; it is usually Amazon.";

  const currentCompanies = extractKnownCompanyMentions(answer, 6);
  const knownCompanies = new Set(
    memory.companyClaims.map((c) => c.toLowerCase()),
  );
  const profileCompanies = new Set(
    profile.companies.map((c) => c.toLowerCase()),
  );
  const unsupportedCompanies = currentCompanies.filter(
    (c) =>
      !knownCompanies.has(c.toLowerCase()) &&
      !profileCompanies.has(c.toLowerCase()),
  );
  if (
    unsupportedCompanies.length &&
    /\b(worked|joined|employed|led|managed|designed|built|owned|was at|for)\b/i.test(
      lower,
    )
  ) {
    return `This introduces ${unsupportedCompanies[0]} as work experience, but that company is not supported by the CV or earlier memory.`;
  }

  return "";
}

function updateMemoryAfterDecision(
  answer: string,
  decision: UnifiedRecruiterDecision,
  memory: RecruiterMemoryProfile,
): { memory: RecruiterMemoryProfile; events: RecruiterMemoryEvent[] } {
  const events: RecruiterMemoryEvent[] = [];
  const text = cleanText(answer);
  const next: RecruiterMemoryProfile = {
    ...memory,
    notableClaims: [...memory.notableClaims],
    roleClaims: [...memory.roleClaims],
    companyClaims: [...memory.companyClaims],
    skillClaims: [...memory.skillClaims],
    metricClaims: [...memory.metricClaims],
    contradictionSignals: [...memory.contradictionSignals],
    strongMoments: [...memory.strongMoments],
    weakMoments: [...memory.weakMoments],
    roleFitSignals: [...memory.roleFitSignals],
    openDoubts: [...memory.openDoubts],
  };

  if (text && decision.shouldCountAsAnswer) {
    next.answerCount = Math.max(0, memory.answerCount) + 1;
    next.lastAcceptedAnswer = compact(text, 220);
    const score = scoreAnswerMemory(text);
    if (score >= 4) {
      next.strongMoments = unique(
        [compact(text, 160), ...next.strongMoments],
        6,
      );
      events.push({
        type: "strength",
        text: "Stored as a strong evidence moment.",
        weight: 7,
      });
    }
    if (score <= 0) {
      next.weakMoments = unique([compact(text, 160), ...next.weakMoments], 6);
      events.push({
        type: "weakness",
        text: "Stored as a weak or unclear moment.",
        weight: 6,
      });
    }
  }

  const roles = extractRoleClaims(text);
  const companies = extractKnownCompanyMentions(text, 8);
  const skills = extractSkillClaims(text);
  const metrics = extractNumberedClaims(text);
  if (roles.length)
    next.roleClaims = unique([...roles, ...next.roleClaims], 12);
  if (companies.length)
    next.companyClaims = unique([...companies, ...next.companyClaims], 12);
  if (skills.length)
    next.skillClaims = unique([...skills, ...next.skillClaims], 18);
  if (metrics.length)
    next.metricClaims = unique([...metrics, ...next.metricClaims], 12);

  const importantClaim = extractMatches(
    text,
    [
      /\b(?:I|we)\s+(?:led|managed|built|created|implemented|designed|resolved|improved|handled|owned|launched)\s+[^.;\n]{4,100}/gi,
    ],
    3,
  );
  if (importantClaim.length) {
    next.notableClaims = unique([...importantClaim, ...next.notableClaims], 14);
    events.push({
      type: "claim",
      text: compact(importantClaim[0], 140),
      weight: 5,
    });
  }

  if (
    decision.intent === "contradiction" ||
    decision.intent === "possible_exaggeration" ||
    decision.concern
  ) {
    const doubt = decision.concern || decision.correction || decision.feedback;
    next.contradictionSignals = unique(
      [compact(doubt, 160), ...next.contradictionSignals],
      10,
    );
    next.openDoubts = unique([compact(doubt, 160), ...next.openDoubts], 10);
    events.push({
      type: "contradiction",
      text: compact(doubt, 140),
      weight: 9,
    });
  }

  next.summary = [
    next.roleClaims.length
      ? `Role memory: ${next.roleClaims.slice(0, 3).join(", ")}`
      : "Role memory unclear",
    next.companyClaims.length
      ? `Company memory: ${next.companyClaims.slice(0, 4).join(", ")}`
      : "No strong company memory",
    next.metricClaims.length
      ? `Evidence memory: ${next.metricClaims.slice(0, 3).join(", ")}`
      : "Few measurable claims remembered",
    next.roleFitSignals.length
      ? `Sticky candidate signals: ${next.roleFitSignals.slice(0, 4).join(", ")}`
      : "No sticky candidate signals yet",
    next.openDoubts.length
      ? `Open doubts: ${next.openDoubts.slice(0, 2).join(" | ")}`
      : "No major open doubts",
  ].join(". ");

  return { memory: next, events };
}

// ============================================================
// SECTION: Rapport & social handling
// ============================================================

function recruiterDisplayNameFromSetup(setup?: UnifiedRecruiterInput["setup"]) {
  const raw = cleanText(setup?.recruiterPersonality).toLowerCase();
  if (
    raw.includes("sarah") ||
    raw.includes("friendly_hr") ||
    raw.includes("friendly")
  )
    return "Sarah";
  if (
    raw.includes("priya") ||
    raw.includes("startup_recruiter") ||
    raw.includes("startup")
  )
    return "Priya";
  if (
    raw.includes("markus") ||
    raw.includes("corporate_recruiter") ||
    raw.includes("corporate")
  )
    return "Markus";
  if (
    raw.includes("daniel") ||
    raw.includes("analytical_hiring_manager") ||
    raw.includes("analytical")
  )
    return "Daniel";
  return "Sarah";
}

function detectCandidateMultiIntent(answer: string) {
  const lower = cleanText(answer).toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const asksName =
    /\b(your name|who are you|what'?s your name|what is your name|let me know your name|may i know your name)\b/i.test(
      lower,
    );
  const asksHowAreYou =
    /\b(how are you|how are you doing|and you\??|what about you)\b/i.test(
      lower,
    );
  const audioCheck =
    /\b(can you hear me|can hear you|i can hear you|i hear you|hear you clearly|can'?t hear|cannot hear|can not hear|no audio|voice is not audible|are you there|do you clearly|you clearly)\b/i.test(
      lower,
    );
  const saysGood =
    /\b(i'?m|i am|doing|feel|feeling)?\s*(good|fine|okay|ok|great|well|ready)\b/i.test(
      lower,
    );
  const saysNervous =
    /\b(nervous|anxious|bit nervous|little nervous|excited)\b/i.test(lower);
  const thanks = /\b(thank you|thanks|appreciate|thank you for inviting|thanks for inviting|thanks for the invite|thank you for this opportunity|thanks for this opportunity|giving me this opportunity)\b/i.test(lower);
  const hasWorkEvidence =
    /\b(worked|experience|technical support|customer|client|ticket|project|handled|resolved|managed|led|built|improved|role|support engineer|customer success)\b/i.test(
      lower,
    );
  const isMostlySocial =
    (asksName ||
      asksHowAreYou ||
      audioCheck ||
      saysGood ||
      saysNervous ||
      thanks) &&
    (wordCount <= 28 || !hasWorkEvidence);
  return {
    asksName,
    asksHowAreYou,
    audioCheck,
    saysGood,
    saysNervous,
    thanks,
    hasWorkEvidence,
    isMostlySocial,
  };
}

function buildMultiIntentRapportReply(
  input: UnifiedRecruiterInput,
  targetRole: string,
) {
  const answer = cleanText(input.answer);
  const multi = detectCandidateMultiIntent(answer);
  const recruiterName = recruiterDisplayNameFromSetup(input.setup);
  const parts: string[] = [];

  if (multi.asksName) {
    parts.push(
      `Of course — I’m ${recruiterName}, your recruiter for this interview.`,
    );
  }

  if (multi.asksHowAreYou) {
    parts.push("I’m doing well, thank you for asking.");
  }

  if (multi.audioCheck) {
    if (
      /can'?t hear|cannot hear|can not hear|no audio|voice is not audible/i.test(
        answer,
      )
    ) {
      parts.push(
        "Thanks for telling me. I’ll keep the transcript visible as well, and we can continue once the audio is clear on your side.",
      );
    } else {
      parts.push("Yes, I can hear you clearly.");
    }
  }

  if (multi.saysNervous) {
    parts.push(
      "That’s completely normal at the start of an interview, so let’s ease into it.",
    );
  } else if (multi.saysGood || multi.thanks) {
    parts.push("Good to hear.");
  }

  const uniqueParts = unique(parts, 4);
  const prefix = uniqueParts.length ? `${uniqueParts.join(" ")} ` : "Great. ";
  return `${prefix}To start, tell me a little about your background and what makes you interested in ${targetRole}.`;
}

function isMostlyMultiIntentRapport(answer: string) {
  return detectCandidateMultiIntent(answer).isMostlySocial;
}

function buildSocialAcknowledgementPrefix(input: UnifiedRecruiterInput) {
  const answer = cleanText(input.answer);
  const lower = answer.toLowerCase();
  const multi = detectCandidateMultiIntent(answer);
  const recruiterName = recruiterDisplayNameFromSetup(input.setup);
  const parts: string[] = [];

  if (multi.audioCheck) {
    if (/can'?t hear|cannot hear|can not hear|no audio|voice is not audible/i.test(lower)) {
      parts.push("Thanks for telling me — I can hear you on my side, and I’ll keep the transcript visible too.");
    } else {
      parts.push("Yes, I can hear you clearly.");
    }
  }

  if (multi.asksName) {
    parts.push(`Of course — I’m ${recruiterName}, your recruiter for this interview.`);
  }

  if (multi.asksHowAreYou) {
    parts.push("I’m doing well, thank you for asking.");
  }

  if (multi.thanks) {
    parts.push("You’re very welcome — glad to have you here.");
  }

  if (multi.saysNervous) {
    parts.push("That’s completely normal, so let’s ease into it.");
  }

  return unique(parts, 5).join(" ");
}

function hasSocialAcknowledgementNeed(answer: string) {
  const multi = detectCandidateMultiIntent(answer);
  return multi.audioCheck || multi.asksName || multi.asksHowAreYou || multi.thanks || multi.saysNervous;
}

function prependSocialAcknowledgementIfNeeded(
  input: UnifiedRecruiterInput,
  decision: UnifiedRecruiterDecision,
): UnifiedRecruiterDecision {
  const answer = cleanText(input.answer);
  if (!hasSocialAcknowledgementNeed(answer)) return decision;
  const prefix = buildSocialAcknowledgementPrefix(input);
  if (!prefix) return decision;

  const spoken = cleanText(decision.spokenReply);
  const alreadyAcknowledged =
    /\b(i can hear you|yes, i can hear|i’m .*recruiter|i'm .*recruiter|you’re very welcome|you're very welcome|glad to have you|thank you for asking)\b/i.test(
      spoken,
    );

  if (alreadyAcknowledged) return decision;

  return {
    ...decision,
    spokenReply: `${prefix} ${spoken}`.trim(),
    feedback:
      decision.feedback ||
      "Acknowledged the candidate’s social/setup comment before continuing the interview.",
    psychology: {
      ...decision.psychology,
      patience: clamp((decision.psychology?.patience ?? 70) + 2, 20, 95),
      engagement: clamp((decision.psychology?.engagement ?? 70) + 2, 20, 95),
    },
    cinematicRealism: decision.cinematicRealism
      ? {
          ...decision.cinematicRealism,
          emotionalBeat: "warming",
          shouldSoften: true,
          naturalTransition:
            decision.cinematicRealism.naturalTransition ||
            "The recruiter acknowledges the social cue before continuing.",
        }
      : decision.cinematicRealism,
  };
}

// ============================================================
// SECTION: Intent classification (heuristic)
// ============================================================

function inferIntentHeuristically(answer: string): CandidateIntent {
  const lower = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean);

  if (!answer) return "clarification";

  if (
    /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower)
  ) {
    if (words.length <= 8) return "greeting";
  }

  if (
    /\b(can'?t hear|cannot hear|can not hear|no audio|audio is not working|voice is not audible|i can hear you|can you hear me|are you there|can you see me)\b/i.test(
      lower,
    )
  ) {
    return "smalltalk";
  }

  if (/\b(how are you|hello\?|hi\?)\b/i.test(lower)) {
    return "smalltalk";
  }

  if (
    /\b(what should i do|what do i need to do|can you explain|repeat the question|what do you mean|i did not understand|i don'?t understand|could you repeat|please repeat|what is the task|how should i answer|should i start)\b/i.test(
      lower,
    )
  ) {
    return "clarification";
  }

  if (
    /\b(do you know|have you heard of|what is|who is|can you tell me|does this app know|what does .* mean|meaning of|define|explain .* to me)\b/i.test(
      lower,
    )
  ) {
    return "candidate_question";
  }

  if (
    /\b(wait|hold on|stop|one second|before that|sorry to interrupt|let me interrupt|pause)\b/i.test(
      lower,
    )
  ) {
    return "interruption";
  }

  if (
    words.length < 5 &&
    !/\b(i|my|we|our|worked|handled|built|managed|led|created|improved|customer|project|experience|responsible)\b/i.test(
      lower,
    )
  ) {
    return "clarification";
  }

  if (
    /\b(photoshop|word|microsoft word|powerpoint)\b.*\b(cloud infrastructure|kernel|compiler|operating system|engine architecture|deep learning model|backend api|database cluster)\b/i.test(
      lower,
    )
  ) {
    return "nonsense";
  }

  if (
    /\b(single[-\s]?handedly|personally built all|invented|created chatgpt|designed.*entire|owned.*entire company|ceo of google|ceo of microsoft|founded amazon|built google|made tesla)\b/i.test(
      lower,
    )
  ) {
    return "possible_exaggeration";
  }

  if (
    /\b(nervous|anxious|fine|good|okay|ok|ready|can hear you|doing well)\b/i.test(
      lower,
    ) &&
    words.length <= 16 &&
    !/\b(worked|experience|customer|support|role|skill|project|company|technical|success)\b/i.test(
      lower,
    )
  )
    return "smalltalk";

  if (words.length < 12) return "partial_answer";

  return "interview_answer";
}

function isIntroRapportQuestion(currentQuestion: string) {
  const question = cleanText(currentQuestion).toLowerCase();
  return (
    /\b(how are you|how are you today|can you hear me|are you there|nice to meet you)\b/i.test(
      question,
    ) ||
    !question ||
    question === "tell me about yourself."
  );
}

function isCandidateRapportReply(answer: string) {
  const lower = cleanText(answer).toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  if (!lower) return false;

  // These are human rapport/setup replies, not competency answers.
  if (
    /\b(i'?m|i am|feeling|bit|little|very)\b[^.]{0,35}\b(nervous|anxious|excited|fine|good|okay|ok|well|ready)\b/i.test(
      lower,
    )
  )
    return true;
  if (
    /\b(good|fine|okay|ok|great|doing well|all good|i can hear you|can hear you|yes i can hear|yeah i can hear)\b/i.test(
      lower,
    ) &&
    words.length <= 16
  )
    return true;
  if (
    /\b(no|yes),?\s*(problem|issue|trouble)\b/i.test(lower) &&
    words.length <= 12
  )
    return true;
  if (/\b(no,?\s*)?i just said\b/i.test(lower)) return true;
  if (/\b(thank you|thanks)\b/i.test(lower) && words.length <= 14) return true;

  return false;
}

function buildRapportReply(
  answer: string,
  targetRole: string,
  input?: UnifiedRecruiterInput,
) {
  const lower = cleanText(answer).toLowerCase();

  if (input && isMostlyMultiIntentRapport(answer)) {
    return buildMultiIntentRapportReply(input, targetRole);
  }

  if (
    /\b(can'?t hear|cannot hear|can not hear|no audio|voice is not audible)\b/i.test(
      lower,
    )
  ) {
    return `Thanks for telling me. I can hear you on my side, and I’ll keep everything visible in the transcript too. Once you’re ready, let’s start with your background and how it connects to ${targetRole}.`;
  }

  if (/\b(nervous|anxious)\b/i.test(lower)) {
    return `That’s completely normal. Most people feel a bit nervous at the start, so let’s ease into it. Tell me a little about yourself and how your recent experience connects to ${targetRole}.`;
  }

  if (
    /\b(can hear you|i can hear you|yeah i can hear|yes i can hear)\b/i.test(
      lower,
    )
  ) {
    return `Great, glad we’re connected. Let’s start naturally: tell me a little about yourself and how your recent experience connects to ${targetRole}.`;
  }

  if (/\b(no,?\s*)?i just said\b/i.test(lower)) {
    return `Fair enough — thanks for clarifying. I won’t treat that as an interview answer. Let’s start properly: tell me a little about yourself and how your background connects to ${targetRole}.`;
  }

  return buildNaturalSocialReply(answer, targetRole);
}

function answerLikelyAddressesQuestion(
  answer: string,
  currentQuestion: string,
) {
  const answerLower = answer.toLowerCase();
  const questionLower = currentQuestion.toLowerCase();

  if (
    /tell me (a little )?about yourself|introduce yourself|walk me through your background/.test(
      questionLower,
    )
  ) {
    return /\b(i am|i'm|my background|i have|worked|experience|currently|previously|role|customer|support|data|project|managed|handled|built|led)\b/i.test(
      answerLower,
    );
  }

  if (
    /time|example|situation|moment|describe|walk me through/.test(questionLower)
  ) {
    return /\b(when|in my|at my|there was|we had|i had|i handled|i managed|i led|i worked|situation|project|customer|team|result|outcome|because|so i)\b/i.test(
      answerLower,
    );
  }

  return answer.split(/\s+/).length >= 12;
}

// ============================================================
// SECTION: Outcome & answer quality signals
// ============================================================

function hasQualitativeOutcome(answer: string) {
  const lower = cleanText(answer).toLowerCase();
  return /\b(customers? (?:were|was|became|felt|got|stayed|returned|came back|asked for me|trusted|happy|satisfied)|customer satisfaction|positive feedback|repeat customer|repeat business|returned back|asked for me again|fewer complaints|less escalation|resolved faster|fixed faster|saved time|improved experience|better experience|issue was resolved|problem was solved|they were happy|they trusted me|renewal|retention|reduced churn|csat|nps)\b/i.test(
    lower,
  );
}

function hasQuantitativeOutcome(answer: string) {
  return /\b(\d+\s*(?:%|percent|hours?|days?|weeks?|months?|customers?|clients?|tickets?|cases?|users?|projects?)|increased|reduced|improved|saved|cut|decreased|grew|resolved|closed|delivered|launched|retained|renewed|csat|nps|sla|kpi)\b/i.test(
    answer,
  );
}

function hasAnyOutcome(answer: string) {
  return hasQuantitativeOutcome(answer) || hasQualitativeOutcome(answer);
}

function wasLastRecruiterAskingForImpact(transcript?: TranscriptItem[]) {
  const lastRecruiter = (transcript || [])
    .slice()
    .reverse()
    .find((item) => item.role === "recruiter");
  const text = cleanText(lastRecruiter?.text).toLowerCase();
  return /\b(result|impact|what changed|outcome|measurable|what happened after|after your work)\b/i.test(
    text,
  );
}

function getRecentRecruiterLines(input: UnifiedRecruiterInput, take = 6) {
  return (input.transcript || [])
    .filter((item) => item.role === "recruiter")
    .slice(-take)
    .map((item) => cleanText(item.text));
}

function getLastRecruiterLine(input: UnifiedRecruiterInput) {
  return getRecentRecruiterLines(input, 1)[0] || "";
}

function tinyHashForVariation(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickNaturalRecruiterLead(
  input: UnifiedRecruiterInput,
  options: string[],
  fallback = "Okay.",
) {
  const recent = getRecentRecruiterLines(input, 8).join(" ").toLowerCase();
  const cleanOptions = options
    .map((option) => cleanText(option))
    .filter(Boolean)
    .filter((option) => {
      const lower = option.toLowerCase();
      return !recent.includes(lower) && !lower.includes("that gives me");
    });
  const pool = cleanOptions.length > 0 ? cleanOptions : [fallback];
  const seed = `${cleanText(input.answer)}|${recent}|${pool.length}`;
  return pool[tinyHashForVariation(seed) % pool.length] || fallback;
}


function isKnowledgeCheckTangent(answer: string) {
  const text = cleanText(answer).toLowerCase();
  return /\b(do you know|you know about|have you heard of|are you familiar with)\b/.test(text) &&
    /\b(b2b|b2c|business to business|business-to-business|business to consumer|business-to-consumer|crm|saas|customer success|support|ticket|sla|nps|csat)\b/.test(text);
}

function buildKnowledgeCheckRedirect(input: UnifiedRecruiterInput, answer: string) {
  const text = cleanText(answer).toLowerCase();
  const currentQuestion = cleanText(input.currentQuestion) || "Tell me about yourself.";

  if (/\bb2b\b|\bb2c\b|business to business|business-to-business|business to consumer|business-to-consumer/.test(text)) {
    return {
      spokenReply:
        "Yes, I do. Don't explain B2B or B2C to me — use it in your example. Give me one customer situation, what the problem was, what you personally did, and what happened after that.",
      displayQuestion:
        "Give me one B2B or B2C customer example: the problem, your action, and the outcome.",
    };
  }

  return {
    spokenReply:
      `Yes, I understand the term. Keep going with the example. ${currentQuestion}`,
    displayQuestion: currentQuestion,
  };
}


function isSocialGreetingOnly(answer: string) {
  const text = cleanText(answer).toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  if (!text) return false;

  const hasGreeting = /\b(hi|hello|hey|good morning|good afternoon|good evening|thank you|thanks|thanks for inviting|thanks for the opportunity|how are you|how are you doing|i am good|i'm good|i am fine|i'm fine|doing well|all good)\b/i.test(text);
  const hasInterviewContent = /\b(experience|worked|role|customer|support|success|manager|project|handled|technical|company|skill|background|interested|because|fit)\b/i.test(text);

  return hasGreeting && !hasInterviewContent && words.length <= 24;
}

function stripBadSocialLead(replyRaw: string) {
  return cleanText(replyRaw)
    .replace(/^\s*(i see|okay,? i see|okay|understood|right)\.\s*(?=i(?:'|’)m doing well|i am doing well|doing well|thank you for asking|thanks for asking)/i, "")
    .replace(/^\s*(i see|okay,? i see)\.\s*/i, "")
    .replace(/\bGood to hear\.\s*Good to hear\.\s*/gi, "Good to hear. ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildNaturalSocialReply(answer: string, targetRole: string) {
  const text = cleanText(answer).toLowerCase();
  const askedHowAreYou = /\bhow are you|how are you doing\b/i.test(text);
  const thanked = /\b(thank you|thanks|thanks for inviting|opportunity)\b/i.test(text);
  const saysGood = /\b(i am good|i'm good|i am fine|i'm fine|doing well|all good|good)\b/i.test(text);

  let prefix = "";
  if (askedHowAreYou && thanked) {
    prefix = "I’m doing well, thank you — and you’re welcome.";
  } else if (askedHowAreYou) {
    prefix = "I’m doing well, thank you for asking.";
  } else if (thanked) {
    prefix = "You’re welcome.";
  } else if (saysGood) {
    prefix = "Good to hear.";
  } else {
    prefix = "Great.";
  }

  return `${prefix} Let’s start with your background and what makes you interested in ${targetRole}.`;
}

function isDocumentationOrProcessAnswer(answer: string) {
  const text = recoverNoisySpokenTranscript(answer).toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const hasDoc = /\b(document|documents|documented|documentation|notes|case notes|call notes|ticket|tickets|crm|system|log|logged|record|records|article|knowledge base|kb|shared|handover|next technician|next agent|next person|same customer returns|previous steps|steps tried)\b/i.test(text);
  const hasAction = /\b(i document|we document|i write|we write|i update|we update|i log|we log|i add|we add|open the document|open the ticket|see what happened|what steps|steps i tried|after every call)\b/i.test(text);
  return words.length >= 10 && (hasDoc || hasAction);
}

function wasAskingForDocumentationOrPrevention(input: UnifiedRecruiterInput) {
  const recent = getRecentRecruiterLines(input, 6).join(" ").toLowerCase();
  const current = cleanText(input.currentQuestion).toLowerCase();
  const context = `${recent} ${current}`;
  return /\b(document|share that learning|same issue is easier|prevent the same issue|prevent it happening again|after the fix|same problem from coming back|knowledge base|easier for the next customer|next customer|longer-term customer-success relationship)\b/i.test(context);
}

function buildDocumentationProgressionReply(input: UnifiedRecruiterInput, targetRole: string) {
  const lead = pickNaturalRecruiterLead(input, [
    "Good — that is more operational.",
    "That is the right process thinking.",
    "Okay, that helps.",
    "Good, that covers the internal handover.",
  ], "Good, that covers the process side.");

  const role = cleanText(targetRole).toLowerCase();
  if (/customer success|success manager|account manager|client success|customer/.test(role)) {
    return {
      spokenReply: `${lead} Now let’s move beyond support. How would you proactively reduce repeat tickets before the customer has to contact you again?`,
      displayQuestion: "How would you proactively reduce repeat tickets before the customer has to contact you again?",
    };
  }

  return {
    spokenReply: `${lead} Now take it one step further. How would you use that learning to improve the process for the next customer or teammate?`,
    displayQuestion: "How would you use that learning to improve the process for the next customer or teammate?",
  };
}

function naturalizeRecruiterReply(input: UnifiedRecruiterInput, replyRaw: string) {
  let reply = stripBadSocialLead(replyRaw);
  if (!reply) return reply;

  const targetRole = firstNonEmpty(
    input.setup?.targetRole,
    extractRoleFromJobDescription(cleanText(input.setup?.jobDescription)),
    "this role",
  );

  if (isSocialGreetingOnly(input.answer)) {
    return buildNaturalSocialReply(input.answer, targetRole);
  }

  const recent = getRecentRecruiterLines(input, 8).join(" ").toLowerCase();
  const repeatedDirection =
    /okay,?\s*i understand the direction\.?\s*/i.test(reply) ||
    /you(?:'|’)re saying your customer-facing support experience is what attracts you to/i.test(reply);

  if (repeatedDirection) {
    const lead = pickNaturalRecruiterLead(input, [
      "Right.",
      "Okay.",
      "Support experience helps — but Customer Success is different.",
      "That transition makes sense.",
      "I get the bridge from support to customer success.",
    ], "Right.");

    reply = reply
      .replace(/okay,?\s*i understand the direction\.?\s*/gi, "")
      .replace(/you(?:'|’)re saying your customer-facing support experience is what attracts you to [^.]+\.\s*/gi, "")
      .replace(/your customer-facing support experience is a relevant bridge into [^.]+\.\s*/gi, "")
      .trim();

    reply = `${lead} ${reply}`.trim();
  }

  // Avoid repeating the same opening scaffold across consecutive recruiter turns.
  if (recent.includes("okay, i understand the direction") && /^okay,?\s*i understand/i.test(reply)) {
    reply = reply.replace(/^okay,?\s*i understand[^.]*\.\s*/i, "Right. ");
  }

  // Keep Daniel-style pacing tighter: avoid two full explanatory sentences before a question.
  reply = reply
    .replace(/Good to hear\.\s*To start,/i, "Good. To start,")
    .replace(/That gives me a practical view of your customer-handling style\.\s*/gi, "")
    .replace(/That gives me a clearer picture of how you handle customers\.\s*/gi, "")
    .replace(/I’m following you, but\s*/i, "I’m following, but ")
    .replace(/Support experience helps — but Customer Success is different\.\s*Your support background is useful, but Customer Success is more proactive\./gi, "Support is reactive; Customer Success is more proactive.")
    .replace(/Support is reactive; Customer Success is more proactive\.\s*Tell me about a customer issue you handled, then explain what you would do after the fix to prevent the same problem from coming back\./gi, "Give me one customer issue you handled, then tell me what you would do after the fix to prevent it happening again.")
    .replace(/Your support background is useful, but Customer Success is more proactive\.\s*Tell me about a customer issue you handled, then explain what you would do after the fix to prevent the same problem from coming back\./gi, "Give me one customer issue you handled, then tell me what you would do after the fix to prevent it happening again.")
    .replace(/Okay, I see the direction\.\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (
    recent.includes("support is reactive") &&
    /^support is reactive; customer success is more proactive\./i.test(reply)
  ) {
    reply = reply.replace(/^support is reactive; customer success is more proactive\.\s*/i, "");
  }

  if (
    recent.includes("support experience helps") &&
    /^support experience helps\s*[—-]\s*but customer success is different\.\s*/i.test(reply)
  ) {
    reply = reply.replace(/^support experience helps\s*[—-]\s*but customer success is different\.\s*/i, "");
  }

  return stripBadSocialLead(reply);
}

function buildCustomerHandlingLead(input: UnifiedRecruiterInput, answer: string) {
  const signals = detectOperationalCustomerSignals(answer);

  if (signals.empathy && !signals.stepByStep) {
    return pickNaturalRecruiterLead(input, [
      "Okay, the empathy part is clear.",
      "Good — you are thinking about the customer's stress.",
      "I can see you focused on calming the customer first.",
      "That part makes sense.",
    ]);
  }

  if (signals.stepByStep || signals.technicalTranslation) {
    return pickNaturalRecruiterLead(input, [
      "Good, now we are getting into the practical part.",
      "Okay, that is more concrete.",
      "I can follow the steps now.",
      "That sounds closer to a real support situation.",
    ]);
  }

  if (signals.relationship) {
    return pickNaturalRecruiterLead(input, [
      "The relationship angle is relevant here.",
      "Good — trust is important for this role.",
      "That is the right direction for customer success.",
      "Okay, the rapport point is useful.",
    ]);
  }

  return pickNaturalRecruiterLead(input, [
    "Okay.",
    "I understand.",
    "That is clearer.",
    "Good, let’s go one level deeper.",
    "I can work with that.",
  ]);
}

function buildOutcomeLead(input: UnifiedRecruiterInput, hasQuantResult: boolean) {
  if (hasQuantResult) {
    return pickNaturalRecruiterLead(input, [
      "Good, that gives me an actual result.",
      "Okay, the outcome is clearer now.",
      "That is stronger because you gave me impact.",
      "Good — now I have something measurable to judge.",
    ]);
  }

  return pickNaturalRecruiterLead(input, [
    "Okay, that is a useful outcome.",
    "That helps, although I would still like numbers if you have them.",
    "I understand the result qualitatively.",
    "That is useful context.",
  ]);
}

function buildProgressionLead(input: UnifiedRecruiterInput) {
  return pickNaturalRecruiterLead(input, [
    "Okay, let’s move this forward.",
    "Let’s go one level deeper.",
    "I want to test this from another angle.",
    "Good, I’m going to shift the question slightly.",
    "Alright, let’s make this more specific.",
  ]);
}


function wasLastRecruiterAskingForDecision(input: UnifiedRecruiterInput) {
  const text =
    `${getLastRecruiterLine(input)} ${cleanText(input.currentQuestion)}`.toLowerCase();
  return /\b(hardest decision|difficult decision|tough decision|judg(e)?ment call|trade[- ]?off|decision you made|what did you decide|hardest part|difficult part)\b/i.test(
    text,
  );
}

function answeredDecisionFollowUp(answer: string) {
  const lower = cleanText(answer).toLowerCase();
  const hasDifficultyOrTradeoff =
    /\b(hard|difficult|tough|challenge|decision|decide|convince|refused|not willing|wouldn'?t|couldn'?t|broken|no proper solution|had to let|let them go|send them off|felt bad|uncomfortable|unhappy|elderly|old customer|risk|trade[- ]?off|balance|honest|empathy|emotionally)\b/i.test(
      lower,
    );
  const hasCustomerContext =
    /\b(customer|client|user|router|wifi|wi[- ]?fi|internet|support|issue|problem|solution|technical|troubleshoot|buy|purchase|replace|product)\b/i.test(
      lower,
    );
  return (
    hasDifficultyOrTradeoff &&
    (hasCustomerContext || lower.split(/\s+/).length >= 18)
  );
}

function buildDecisionFollowupResolution(
  input: UnifiedRecruiterInput,
  answer: string,
  targetRole: string,
) {
  const lower = cleanText(answer).toLowerCase();

  if (/\b(elderly|old customer|old person|senior)\b/i.test(lower)) {
    return `That makes sense. With an elderly customer, the challenge is not just technical — it is balancing honesty, patience, and empathy. For ${targetRole}, that matters a lot. How would you handle a similar customer today if they were frustrated but still needed a solution?`;
  }

  if (
    /\b(refused|not willing|wouldn'?t|did not accept|didn'?t accept|not accept)\b/i.test(
      lower,
    )
  ) {
    return `That is a realistic customer situation. You could not force the customer, so the important part is how clearly and calmly you explained the options. How did you manage the customer's emotions during that conversation?`;
  }

  if (
    /\b(broken|not work|doesn'?t work|didn'?t function|no solution|without any proper solution)\b/i.test(
      lower,
    )
  ) {
    return `I understand. The technical issue had a hard limit, and you had to communicate that without damaging trust. What did you do to make sure the customer still felt supported?`;
  }

  return `That answers the decision part. I can see the trade-off: you had to be honest while still protecting the customer relationship. Looking back, what would you do differently in that situation?`;
}

function sameFollowupIntentRepeated(
  input: UnifiedRecruiterInput,
  intentPattern: RegExp,
  minimum = 2,
) {
  const count = getRecentRecruiterLines(input, 6).filter((line) =>
    intentPattern.test(line),
  ).length;
  return count >= minimum;
}


function repeatedRecruiterLineRisk(
  input: UnifiedRecruiterInput,
  nextLine: string,
) {
  const normalizedNext = cleanText(nextLine).toLowerCase();
  if (!normalizedNext) return false;
  const recentRecruiterLines = (input.transcript || [])
    .filter((item) => item.role === "recruiter")
    .slice(-6)
    .map((item) => cleanText(item.text).toLowerCase());
  return recentRecruiterLines.some(
    (line) =>
      line &&
      (line === normalizedNext ||
        line.includes(normalizedNext.slice(0, 58)) ||
        normalizedNext.includes(line.slice(0, 58))),
  );
}

// ============================================================
// SECTION: Interview stage progression
// ============================================================

function buildHumanProgressionQuestion(
  input: UnifiedRecruiterInput,
  cvRead: CandidateEvidenceProfile,
  memory: RecruiterMemoryProfile,
  answer: string,
) {
  const setup = input.setup || {};
  const jobDescription = cleanText(setup.jobDescription);
  const cvText = cleanText(setup.cvText);
  const targetRole = firstNonEmpty(
    setup.targetRole,
    extractRoleFromJobDescription(jobDescription),
    "this role",
  );
  const candidateTurns = (input.transcript || []).filter(
    (item) => item.role === "candidate",
  ).length;
  const missingSkills = findMissingJobSkills(cvText, jobDescription);
  const lower = cleanText(answer).toLowerCase();

  if (
    wasLastRecruiterAskingForDecision(input) &&
    answeredDecisionFollowUp(answer)
  ) {
    return buildDecisionFollowupResolution(input, answer, targetRole);
  }

  if (candidateTurns <= 2) {
    if (
      /support|customer|client|ticket|relationship|satisfaction/i.test(lower)
    ) {
      return "That customer-facing experience is relevant. Can you tell me about one difficult customer situation you handled and what you learned from it?";
    }
    return `Thanks. What is making you interested in moving toward ${targetRole} now?`;
  }

  if (missingSkills.length && candidateTurns <= 5) {
    const skill = missingSkills[0];
    return `I see ${skill} in the role requirements, but it is not very clear in your CV. Have you worked with it before, or how would you close that gap quickly if you joined?`;
  }

  if (
    /strength|good at|best at|strong/i.test(
      cleanText(input.currentQuestion).toLowerCase(),
    )
  ) {
    return "That helps. What would you say is your biggest development area or weakness right now?";
  }

  if (
    /weakness|challenge|development area/i.test(
      cleanText(input.currentQuestion).toLowerCase(),
    )
  ) {
    return "Thanks for being honest. Tell me about a recent situation where you had to learn something quickly.";
  }

  if (/customer|client|stakeholder|relationship|support|ticket|router|wifi|internet|technical|frustrated|unhappy/i.test(lower)) {
    return buildOperationalCustomerFollowUp(input, answer, targetRole);
  }

  if (/data|analysis|sql|excel|dashboard|metric|report/i.test(lower)) {
    return "Can you give me one example where data changed the decision you made?";
  }

  return buildNaturalNextQuestion(input, cvRead, memory, answer);
}

function shouldAcceptPartialOutcome(
  answer: string,
  input: UnifiedRecruiterInput,
) {
  return (
    wasLastRecruiterAskingForImpact(input.transcript) && hasAnyOutcome(answer)
  );
}

function detectQuestionKind(
  question: string,
): UnifiedRecruiterDecision["conversationStage"] {
  const q = cleanText(question).toLowerCase();
  if (/can you hear|how are you|nice to meet|hello|hi/.test(q))
    return "audio_check";
  if (/tell me.*about yourself|background|recent experience|introduce/.test(q))
    return "background";
  if (
    /why.*(role|position|interested|switch|changing)|why.*customer success|move.*customer/.test(
      q,
    )
  )
    return "role_fit";
  if (/strength|best at|good at/.test(q)) return "strengths";
  if (/weakness|development area|challenge/.test(q)) return "weakness";
  if (
    /skill|worked with|knowledge of|close that gap|requirement|missing/.test(q)
  )
    return "skill_gap";
  if (
    /situation|example|time when|handled|difficult|customer|stakeholder|pressure|learn/.test(
      q,
    )
  )
    return "behavioral";
  return "behavioral";
}


function isCustomerSuccessShortBackgroundAnswer(answer: string, targetRole: string, input?: UnifiedRecruiterInput) {
  const text = cleanText(answer).toLowerCase();
  const role = cleanText(targetRole).toLowerCase();
  const transcriptContext = input ? `${recentRecruiterText(input, 6)} ${recentCandidateText(input, 4)}` : "";
  const context = `${text} ${transcriptContext}`.toLowerCase();

  // Voice transcripts are often fragmented: "customer handing skills", "good fit", "this company".
  // If the current conversation is clearly about Customer Success / customer-facing work,
  // accept the intent instead of repeating the opener.
  const isCustomerSuccessContext =
    /customer success|customer service|account manager|support|client|success manager|customer-facing|customer facing/.test(role) ||
    /customer success manager|customer success|customer-facing role|customer facing role|technical support|support background/.test(context);

  if (!isCustomerSuccessContext) return false;

  const hasCustomerSignal = /customer|client|user|stakeholder|customer[- ]?facing|satisfaction|happy|rapport|rapple|trust|convinc|understand|relationship|support|handling|handing|handled|helped|communicat|explain/.test(context);
  const hasMotivationSignal = /good fit|fit|change|move|field|interested|try|role|company|fully|100%|customer side|non[- ]technical|less technical|customer success|work for/.test(context);
  const hasTransferableSkillSignal = /skill|experience|background|support|technical|customer|handling|handing|communication|relationship/.test(context);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return hasCustomerSignal && (hasMotivationSignal || hasTransferableSkillSignal || wordCount >= 6);
}

// ============================================================
// SECTION: Customer Success conversation builders
// ============================================================

function buildCustomerSuccessDepthQuestion(input: UnifiedRecruiterInput, answer: string, targetRole: string) {
  const text = cleanText(answer).toLowerCase();
  const recent = getRecentRecruiterLines(input, 8).join(" ").toLowerCase();

  if (/longer[- ]term|relationship|retention|renewal|account|success plan|health score/.test(recent)) {
    return `Good. In ${targetRole}, the key shift is from solving one ticket to owning the relationship. Give me one example of how you would follow up after solving the issue so the customer stays engaged long term.`;
  }

  if (/rapport|rapple|trust|convinc|make.*understand|explain/.test(text)) {
    return `That customer trust is relevant. Give me one specific customer situation where you had to explain something difficult, calm the customer, and still move the issue forward.`;
  }

  if (/technical|support|ticket|troubleshoot|issue|router|internet|product/.test(text)) {
    return `Your support background is useful, but Customer Success is more proactive. Tell me about a customer issue you handled, then explain what you would do after the fix to prevent the same problem from coming back.`;
  }

  if (/satisfaction|happy|csat|feedback|good experience/.test(text)) {
    return `You mentioned customer satisfaction. How would you measure whether a customer is truly successful after the conversation — not just temporarily happy?`;
  }

  return `Can you give me one concrete customer example — the problem, what you personally did, and how you would turn that into a longer-term customer-success relationship?`;
}

function isOpeningQuestionRepeatAfterRelevantAnswer(input: UnifiedRecruiterInput, decisionReply: string, answer: string, targetRole: string) {
  return (
    /to start|tell me a little about your background|what makes you interested|recent experience connects/i.test(decisionReply) &&
    isCustomerSuccessShortBackgroundAnswer(answer, targetRole, input)
  );
}

function buildShortAnswerAcceptanceReply(input: UnifiedRecruiterInput, answer: string, targetRole: string) {
  const nextQuestion = buildCustomerSuccessDepthQuestion(input, answer, targetRole);
  return {
    spokenReply: naturalizeRecruiterReply(input, `Support experience helps — but Customer Success is different. ${nextQuestion}`),
    displayQuestion: nextQuestion,
  };
}

function detectOperationalCustomerSignals(answer: string) {
  const text = cleanText(answer).toLowerCase();
  return {
    empathy:
      /empathy|empathetic|understand|stressful|calm|patient|fellow human|frustrated|angry|upset|unhappy/.test(
        text,
      ),
    stepByStep:
      /step by step|slowly|slow step|guide|guided|walk(ed)? through|instructions?|explain(ed)? clearly/.test(
        text,
      ),
    technicalTranslation:
      /technical|router|wifi|wi-fi|internet|ip address|troubleshoot|device|computer|configuration|product/.test(
        text,
      ),
    noImmediateFix:
      /couldn'?t fix|not possible|no solution|broken|didn'?t work|doesn'?t work|not willing|refused|could not solve|escalat(e|ed|ion)/.test(
        text,
      ),
    relationship:
      /rapport|rapple|trust|relationship|came back|asked for me|customer satisfaction|csat|satisfied|happy/.test(
        text,
      ),
    b2bOrB2c: /b2b|b2c|business customer|individual customer|consumer|enterprise/.test(text),
    ownership: /\b(i|my|personally|handled|managed|explained|guided|resolved|convinced|calmed|worked with)\b/.test(text),
    substantial: text.split(/\s+/).filter(Boolean).length >= 18,
  };
}

function buildOperationalCustomerFollowUp(
  input: UnifiedRecruiterInput,
  answer: string,
  targetRole: string,
) {
  const signals = detectOperationalCustomerSignals(answer);
  const recent = getRecentRecruiterLines(input, 5).join(" ").toLowerCase();

  if (signals.stepByStep && signals.technicalTranslation && !/non-technical|explain/i.test(recent)) {
    return `That is exactly the kind of situation where communication matters. How did you translate the technical steps into language the customer could actually follow?`;
  }

  if (signals.empathy && !/exact|words|calm/i.test(recent)) {
    return `I like that you thought about the customer's stress. Give me the practical part: what did you say or do to calm them down during the conversation?`;
  }

  if (signals.noImmediateFix && !/preserve|trust|no immediate/i.test(recent)) {
    return `That is a realistic customer-success problem: sometimes there is no immediate fix. How would you preserve trust with the customer while still being honest about the limitation?`;
  }

  if (signals.relationship && /customer success|success manager/i.test(targetRole)) {
    return `You keep coming back to trust and rapport, which is important for ${targetRole}. How would you turn that kind of one-time support interaction into a longer-term customer relationship?`;
  }

  if (signals.b2bOrB2c) {
    return `You mentioned different customer types. How would your approach change between a B2B customer and a B2C customer?`;
  }

  if (signals.ownership && signals.substantial) {
    return `What would you improve if you had to handle the same situation again today?`;
  }

  return `Let’s make this more practical. In that moment, what was the first thing you did to reduce the customer’s frustration?`;
}

function isCustomerOperationalAnswer(answer: string) {
  const signals = detectOperationalCustomerSignals(answer);
  return (
    signals.substantial &&
    (signals.empathy ||
      signals.stepByStep ||
      signals.technicalTranslation ||
      signals.noImmediateFix ||
      signals.relationship ||
      signals.b2bOrB2c)
  );
}


function isSpokenConcreteCustomerExample(answer: string) {
  const text = recoverNoisySpokenTranscript(answer).toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  const hasCustomerContext = /\b(customer|client|user|b2b|b2c|consumer|business customer|end user|old|older|non[- ]?technical)\b/.test(text);
  const hasSpecificSituation = /\b(once|one time|i handled|i worked|there was|she|he|they|router|routers|linksys|belkin|firmware|ip address|computer|internet|wi[- ]?fi|wifi|technical issue|issue|problem)\b/.test(text);
  const hasPersonalAction = /\b(i understood|i took|i asked|i gave|i explained|i guided|i fixed|i helped|i built|i walked|step[- ]?by[- ]?step|slowly|calm|rapport|wrap|rapple|instruction|instructions)\b/.test(text);
  const hasOutcome = /\b(fixed|resolved|solved|happy|satisfied|worked|issue was resolved|customer was happy|she was happy|he was happy|they were happy)\b/.test(text);
  const hasRecoveredRouterStory = /\b(linksys|belkin|router|firmware|ip address|wi[- ]?fi|wifi)\b/.test(text) && /\b(step[- ]?by[- ]?step|guided|instruction|instructions|satisfied|scared|old|older|computer)\b/.test(text);

  return (
    words.length >= 22 &&
    (hasRecoveredRouterStory || (hasCustomerContext && hasSpecificSituation && hasPersonalAction)) &&
    (hasOutcome || hasRecoveredRouterStory || /step[- ]?by[- ]?step|guided|explained|calm|instructions?/.test(text))
  );
}

function wasAskingForConcreteCustomerExample(input: UnifiedRecruiterInput) {
  const recent = getRecentRecruiterLines(input, 5).join(" ").toLowerCase();
  const current = cleanText(input.currentQuestion).toLowerCase();
  const context = `${recent} ${current}`;

  return /customer issue|customer situation|specific situation|concrete customer example|problem.*personally did|after the fix|prevent.*coming back|longer[- ]term customer|customer-success relationship/.test(context);
}

function buildAcceptedSpokenCustomerExampleReply(
  input: UnifiedRecruiterInput,
  answer: string,
  targetRole: string,
) {
  const text = recoverNoisySpokenTranscript(answer).toLowerCase();
  const isCustomerSuccess = /customer success|success manager|account manager|retention|renewal/.test(
    cleanText(targetRole).toLowerCase(),
  );
  const lead = pickNaturalRecruiterLead(input, [
    "Good, that is a real example.",
    "Okay, now I have a concrete situation.",
    "That example helps.",
    "Right, now we are talking about an actual customer case.",
  ], "Good, that is concrete.");

  if (/happy|satisfied|resolved|fixed|solved/.test(text) && isCustomerSuccess) {
    return {
      spokenReply: `${lead} In support, resolving the issue is the end. In Customer Success, it is usually the start. After that router issue was fixed, what would you do next to keep that customer successful long term?`,
      displayQuestion:
        "After the issue was fixed, what would you do next to build a longer-term customer-success relationship?",
    };
  }

  if (/step[- ]?by[- ]?step|explained|guided|computer|ip address|firmware|technical/.test(text)) {
    return {
      spokenReply: `${lead} You translated something technical for a non-technical customer. How would you document or share that learning so the same issue is easier for the next customer?`,
      displayQuestion:
        "How would you prevent the same issue or make it easier for the next customer?",
    };
  }

  return {
    spokenReply: `${lead} What was the outcome, and what would you do differently if you handled the same customer today?`,
    displayQuestion:
      "What was the outcome, and what would you improve if you handled the same customer today?",
  };
}

function humanTransition(
  input: UnifiedRecruiterInput,
  memory: RecruiterMemoryProfile,
  answer: string,
) {
  const stage = detectQuestionKind(input.currentQuestion || "");
  const signals = deriveAnswerQualitySignals(answer);
  const targetRole = firstNonEmpty(
    input.setup?.targetRole,
    extractRoleFromJobDescription(cleanText(input.setup?.jobDescription)),
    "this role",
  );

  if (
    stage === "background" &&
    ((signals.hasSupport && signals.hasCustomer) ||
      isCustomerSuccessShortBackgroundAnswer(answer, targetRole, input))
  ) {
    const wantsCustomerSuccess = isCustomerSuccessShortBackgroundAnswer(answer, targetRole, input);
    return {
      accepted: true,
      stage: wantsCustomerSuccess ? ("behavioral" as const) : ("role_fit" as const),
      replyLead: wantsCustomerSuccess
        ? `Support experience helps — but Customer Success is different.`
        : `That makes sense. Your technical support background gives you direct customer-facing experience, which is relevant for ${targetRole}.`,
      nextQuestion: wantsCustomerSuccess
        ? buildCustomerSuccessDepthQuestion(input, answer, targetRole)
        : `What made you want to move from technical support into ${targetRole}, instead of staying in a purely technical role?`,
      delta: 3,
    };
  }

  if (
    stage === "role_fit" &&
    (signals.hasCustomer ||
      signals.hasRoleFit ||
      signals.hasSupport ||
      /customer|client|trust|rapport|wrap|rapple|convinc|make them understand|explain|relationship|customer-facing|customer facing/i.test(answer))
  ) {
    return {
      accepted: true,
      stage: "behavioral" as const,
      replyLead:
        "Okay, I can see the connection now — customer trust and problem-solving are clearly part of your story.",
      nextQuestion:
        "Tell me about one difficult customer situation you handled. What was the problem, what did you do, and how did the customer respond?",
      delta: 3,
    };
  }

  if (stage === "weakness" && signals.hasWeaknessLanguage) {
    return {
      accepted: true,
      stage: "skill_gap" as const,
      replyLead:
        "That’s a realistic weakness to mention, and I appreciate that you framed it as something you are actively improving.",
      nextQuestion: `In ${targetRole}, communication is important. How would you make sure language does not affect customer trust or clarity?`,
      delta: 1,
    };
  }

  if (stage === "behavioral" && signals.hasLearning) {
    return {
      accepted: true,
      stage: "behavioral" as const,
      replyLead:
        "That is a useful example of adaptation, especially because moving countries and learning a language takes consistency.",
      nextQuestion:
        "Now give me a work-related example where you had to learn a product, process, or customer issue quickly.",
      delta: 2,
    };
  }

  if (stage === "behavioral" && isCustomerOperationalAnswer(answer)) {
    return {
      accepted: true,
      stage: "behavioral" as const,
      replyLead: buildCustomerHandlingLead(input, answer),
      nextQuestion: buildOperationalCustomerFollowUp(input, answer, targetRole),
      delta: 3,
    };
  }

  if (signals.hasQualitativeResult || signals.hasQuantResult) {
    const next = buildHumanProgressionQuestion(
      input,
      buildEvidenceProfile(
        cleanText(input.setup?.cvText),
        cleanText(input.setup?.jobDescription),
        input.setup?.resumeProfile,
      ),
      memory,
      answer,
    );
    return {
      accepted: true,
      stage,
      replyLead: buildOutcomeLead(input, signals.hasQuantResult),
      nextQuestion: next,
      delta: signals.hasQuantResult ? 4 : 2,
    };
  }

  return null;
}

function shouldAvoidImpactDemand(input: UnifiedRecruiterInput) {
  const stage = detectQuestionKind(input.currentQuestion || "");
  // Intro/background answers should be allowed to build the story first.
  // Do not demand metrics immediately before rapport and role motivation are established.
  return stage === "background" || stage === "role_fit" || stage === "weakness";
}

// ============================================================
// SECTION: Fallback heuristic decision
// ============================================================

function detectCVConflict(answer: string, profile: CandidateEvidenceProfile) {
  const lower = answer.toLowerCase();
  const companyClaims = extractMatches(
    answer,
    [
      /\b(Zoho|Microsoft|Amazon|Google|Tesla|Apple|Meta|Facebook|eBay|Salesforce|SAP|Oracle|IBM|Infosys|TCS|Wipro|Accenture|Deloitte|Capgemini|Cognizant|Freshworks|HubSpot|ServiceNow|Zendesk|Atlassian|Adobe|Netflix|Uber|Airbnb|Stripe|Shopify)\b/gi,
    ],
    5,
  );

  const profileCompaniesLower = new Set(
    profile.companies.map((company) => company.toLowerCase()),
  );
  const unsupportedCompanyClaim = companyClaims.find(
    (company) => !profileCompaniesLower.has(company.toLowerCase()),
  );

  const supportBackground =
    profile.supportSignals.length > 0 ||
    /support|customer|helpdesk|ticket|zoho/i.test(profile.summary);
  const engineeringClaim =
    /\b(designed|architected|built|implemented|developed)\b.*\b(engine|kernel|compiler|operating system|autopilot|core infrastructure|data center|chip|hardware|vehicle platform)\b/i.test(
      lower,
    );
  const executiveClaim =
    /\b(ceo|cto|founder|director|head of|vp of)\b/i.test(lower) &&
    !profile.senioritySignals.some((s) =>
      /manager|head|director|lead|senior/i.test(s),
    );

  if (
    unsupportedCompanyClaim &&
    /\b(worked|employed|at|for|joined|led|designed|built|managed)\b/i.test(
      lower,
    )
  ) {
    return `The CV evidence I have does not clearly show ${unsupportedCompanyClaim}.`;
  }

  if (supportBackground && engineeringClaim) {
    return "The answer jumps from a support/customer background into deep engineering ownership without evidence.";
  }

  if (executiveClaim) {
    return "The seniority claim sounds higher than the CV evidence provided.";
  }

  return "";
}

function buildFallbackDecision(
  input: UnifiedRecruiterInput,
): UnifiedRecruiterDecision {
  const answer = cleanText(input.answer);
  const currentQuestion =
    cleanText(input.currentQuestion) || "Tell me about yourself.";
  const jobDescription = cleanText(input.setup?.jobDescription);
  const cvText = cleanText(input.setup?.cvText);
  const targetRole = firstNonEmpty(
    input.setup?.targetRole,
    extractRoleFromJobDescription(jobDescription),
    "this role",
  );
  const trust = clamp(
    typeof input.recruiterTrust === "number" ? input.recruiterTrust : 58,
    12,
    92,
  );
  const intent = inferIntentHeuristically(answer);
  const cvRead = buildEvidenceProfile(cvText, jobDescription, input.setup?.resumeProfile);
  const recruiterMemory = buildRecruiterMemoryProfile(
    input.transcript,
    cvRead,
    input.setup?.recruiterMemoryProfile,
  );
  const memoryContradiction = detectMeaningContradiction(
    answer,
    cvRead,
    recruiterMemory,
  );
  const cvConflict = detectCVConflict(answer, cvRead) || memoryContradiction;

  const basePsychology: UnifiedRecruiterPsychology = {
    trust,
    interest: clamp(trust + 6, 20, 95),
    skepticism: clamp(72 - trust, 12, 88),
    patience: clamp(trust + 10, 20, 95),
    engagement: clamp(trust + 5, 20, 95),
    confidenceInCandidate: trust,
  };

  const introQuestion = `Tell me a little about yourself and connect your recent experience to ${targetRole}.`;

  const withProfile = (
    decision: Omit<
      UnifiedRecruiterDecision,
      "cvRead" | "recruiterMemory" | "memoryEvents"
    >,
  ): UnifiedRecruiterDecision => {
    const enriched: UnifiedRecruiterDecision = {
      ...decision,
      cvRead,
      recruiterMemory,
      memoryEvents: [],
      marketExpectation: deriveMarketExpectation(input),
      humanImperfection: deriveHumanImperfection(
        input,
        decision,
        recruiterMemory,
      ),
      socialSignals: deriveSocialSignals(answer, decision, recruiterMemory),
      cinematicRealism: deriveCinematicRealism(
        input,
        decision,
        deriveSocialSignals(answer, decision, recruiterMemory),
        deriveLivePressure(
          decision.psychology,
          decision.recruiterState,
          decision.intent,
        ),
      ),
    };
    const updated = updateMemoryAfterDecision(
      answer,
      enriched,
      recruiterMemory,
    );
    return {
      ...enriched,
      recruiterMemory: updated.memory,
      memoryEvents: updated.events,
    };
  };

  if (isSocialGreetingOnly(answer)) {
    return withProfile({
      intent: "smalltalk",
      spokenReply: buildNaturalSocialReply(answer, targetRole),
      displayQuestion: introQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback: "Handled social greeting naturally without analytical filler.",
      psychology: {
        ...basePsychology,
        patience: clamp(basePsychology.patience + 4, 20, 95),
        engagement: clamp(basePsychology.engagement + 2, 20, 95),
      },
    });
  }

  if (
    isIntroRapportQuestion(currentQuestion) &&
    isCandidateRapportReply(answer)
  ) {
    return withProfile({
      intent: "smalltalk",
      spokenReply: buildRapportReply(answer, targetRole, input),
      displayQuestion: introQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback:
        "Handled intro rapport/emotional small talk without scoring or pressure.",
      psychology: {
        ...basePsychology,
        patience: clamp(basePsychology.patience + 4, 20, 95),
        engagement: clamp(basePsychology.engagement + 3, 20, 95),
      },
    });
  }

  if (intent === "greeting" || intent === "smalltalk") {
    return withProfile({
      intent,
      spokenReply: buildMultiIntentRapportReply(input, targetRole),
      displayQuestion: introQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback: "Handled greeting without counting it as an answer.",
      psychology: basePsychology,
    });
  }

  if (intent === "clarification" || intent === "interruption") {
    // BUG FIXED: an explicit "I don't understand, can you explain / give me
    // an example" request was previously treated identically to a vague
    // fragment and got a deflecting "answer it like a real interview" line —
    // it never actually explained anything, then later pivoted to an
    // unrelated topic. Confirmed from live testing this is what candidates
    // experience as "it skips to the next question instead of explaining."
    // A genuine clarification request gets a genuine answer: the actual
    // current question, restated, with concrete examples attached.
    const isExplicitClarificationRequest = /\b(don'?t understand|can you (explain|clarify|make.*clear|simplify|rephrase)|what do you mean|not clear|give (me )?(an )?example|could you repeat|say that again|come again|confus(ed|ing))\b/i.test(answer);
    if (isExplicitClarificationRequest) {
      return withProfile({
        intent,
        spokenReply: `Sure, let me put it another way. ${currentQuestion} For example: something got noticeably faster, an error or complaint stopped happening, a colleague or manager specifically pointed it out, or a number you track actually moved. Just walk me through one real moment like that.`,
        displayQuestion: currentQuestion,
        shouldAdvanceQuestion: false,
        shouldCountAsAnswer: false,
        shouldStayOnCurrentQuestion: true,
        trustDelta: 0,
        recruiterState: "interested",
        feedback: "Candidate explicitly asked for clarification — restated the actual question with concrete examples instead of deflecting or pivoting.",
        psychology: basePsychology,
      });
    }

    // A very short, fragment-sounding answer ("this part is...") right after
    // a substantial question is far more often a candidate who paused mid-
    // thought (or got cut off by the silence timer) than someone genuinely
    // asking for clarification. Saying so directly — instead of a generic
    // "answer it properly" line — is both more accurate and far less likely
    // to make someone feel dismissed for something that wasn't their fault.
    const looksLikeCutoffFragment = /\b(this part is|that was|the part where|it was|i think it|so basically|and then|the hardest)\b/i.test(answer.trim())
      && answer.trim().split(/\s+/).filter(Boolean).length <= 6;
    return withProfile({
      intent,
      spokenReply: looksLikeCutoffFragment
        ? `Sorry, I may have cut you off there — go ahead and continue, take your time.`
        : `No problem. Answer it like a real interview: what you did, why it mattered, and how it connects to ${targetRole}. We’ll stay with this question for now.`,
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback: "Candidate asked for guidance; did not advance.",
      psychology: basePsychology,
    });
  }

  if (intent === "candidate_question") {
    const multi = detectCandidateMultiIntent(answer);
    const tangentRedirect = isKnowledgeCheckTangent(answer)
      ? buildKnowledgeCheckRedirect(input, answer)
      : null;

    // BUG FIXED: a candidate asking what name/info the system has on file
    // for THEM is their own data, not a request for confidential
    // third-party information. Confirmed from live testing: this used to
    // fall through to a generic deflection about not sharing "company
    // names" — a completely different and irrelevant concern, since the
    // candidate never asked about a company.
    const asksOwnIdentity = /\b(what('?s| is) my name|what name (do|did) you (see|have)|do you have my name|what'?s the name (you|on))\b/i.test(answer);
    if (asksOwnIdentity) {
      const knownName = (input.setup?.candidateName || "").trim();
      const looksLikeRealName = knownName && !/^(there|candidate|user|public|profile)$/i.test(knownName);
      return withProfile({
        intent,
        spokenReply: looksLikeRealName
          ? `Good question — I have your name as ${knownName}. Let me know if that's not quite right.`
          : `Honestly, I don't have a confirmed name from your CV — could you tell me what I should call you?`,
        displayQuestion: currentQuestion,
        shouldAdvanceQuestion: false,
        shouldCountAsAnswer: false,
        shouldStayOnCurrentQuestion: true,
        trustDelta: 1,
        recruiterState: "interested",
        feedback: "Candidate asked what name the system has on file — answered directly instead of deflecting.",
        psychology: basePsychology,
      });
    }

    // The closing stage deliberately invites questions ("do you have any
    // questions for me?"). Treating that expected, invited answer the same
    // way as a random mid-interview tangent — "come back to the example" —
    // is dismissive and reads as broken right when the interview should be
    // landing warmly. Detect that we just asked for questions and actually
    // answer instead of redirecting.
    const weJustInvitedQuestions = /do you have any questions|any questions for me|questions about the role/i.test(currentQuestion);
    if (weJustInvitedQuestions && !tangentRedirect) {
      const company = firstNonEmpty(input.setup?.targetCompany, "");
      const companyPhrase = company ? ` at ${company}` : "";
      return withProfile({
        intent,
        spokenReply: `Good question. For ${targetRole}${companyPhrase}, the day-to-day is roughly what we've been discussing — and from what you've shared today, I think there's real alignment there. As for next steps: we typically follow up within a few business days with feedback. Is there anything else you'd like to know before we wrap up?`,
        displayQuestion: currentQuestion,
        shouldAdvanceQuestion: false,
        shouldCountAsAnswer: true,
        shouldStayOnCurrentQuestion: false,
        trustDelta: 2,
        recruiterState: "engaged",
        feedback: "Candidate asked a question during the invited closing window — answered genuinely instead of redirecting.",
        psychology: basePsychology,
      });
    }
    return withProfile({
      intent,
      spokenReply: tangentRedirect
        ? tangentRedirect.spokenReply
        : multi.asksName || multi.asksHowAreYou
          ? buildMultiIntentRapportReply(input, targetRole)
          : `Yes. Keep the side explanation brief so this still feels like an interview. Come back to the example: ${currentQuestion}`,
      displayQuestion: tangentRedirect?.displayQuestion || currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback:
        "Answered candidate question briefly and redirected back to the interview thread.",
      psychology: basePsychology,
    });
  }

  if (intent === "nonsense") {
    return withProfile({
      intent,
      spokenReply:
        "Hold on — that combination does not really make sense technically. Can you clarify what tools or systems you actually used?",
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: -6,
      recruiterState: "skeptical",
      feedback: "Technically implausible answer challenged.",
      concern: "The answer appears technically inconsistent.",
      psychology: {
        ...basePsychology,
        trust: clamp(trust - 6, 12, 92),
        skepticism: clamp(basePsychology.skepticism + 10, 12, 95),
      },
    });
  }

  if (intent === "possible_exaggeration" || cvConflict) {
    return withProfile({
      intent: memoryContradiction
        ? "contradiction"
        : cvConflict
          ? "possible_exaggeration"
          : intent,
      spokenReply: cvConflict
        ? `I need to pause on that. ${cvConflict} Help me separate the real scope: what exactly did you personally do, and what evidence would back that up?`
        : "That sounds like a very large claim. I’m not dismissing it, but I need the realistic version: what exactly was your role, what did you personally own, and who else was involved?",
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: -5,
      recruiterState: "skeptical",
      feedback:
        "Possible exaggeration or CV conflict challenged without moving forward.",
      concern: cvConflict || "The claim may be exaggerated or unsupported.",
      psychology: {
        ...basePsychology,
        trust: clamp(trust - 5, 12, 92),
        skepticism: clamp(basePsychology.skepticism + 12, 12, 95),
      },
    });
  }

  if (intent === "partial_answer") {
    return withProfile({
      intent,
      spokenReply:
        "I’m following you, but I need a little more before I can judge the fit. Give me one specific situation, what you personally did, and what changed after that.",
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: -1,
      recruiterState: "interested",
      feedback: "Partial answer; asked for more detail.",
      psychology: { ...basePsychology, trust: clamp(trust - 1, 12, 92) },
    });
  }

  const stageTransition = humanTransition(input, recruiterMemory, answer);
  if (stageTransition) {
    return withProfile({
      intent: "interview_answer",
      spokenReply: `${stageTransition.replyLead} ${stageTransition.nextQuestion}`,
      displayQuestion: stageTransition.nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: stageTransition.delta,
      recruiterState: stageTransition.delta >= 3 ? "engaged" : "interested",
      feedback:
        "Accepted the candidate’s answer naturally and moved to the next realistic thread.",
      conversationStage: stageTransition.stage,
      psychology: {
        ...basePsychology,
        trust: clamp(trust + stageTransition.delta, 12, 92),
        interest: clamp(basePsychology.interest + 7, 20, 95),
        engagement: clamp(basePsychology.engagement + 6, 20, 95),
      },
    });
  }

  // v74: If the candidate answers a role-motivation question with customer trust,
  // rapport, convincing, or support evidence, never fall back to the opening intro.
  // Accept the answer and continue into a concrete customer-success situation.
  if (
    detectQuestionKind(currentQuestion) === "role_fit" &&
    /customer|client|trust|rapport|wrap|rapple|convinc|make them understand|explain|relationship|customer-facing|customer facing|technical support|support/i.test(answer)
  ) {
    const nextQuestion =
      "Tell me about one difficult customer situation you handled. What was the problem, what did you do, and how did the customer respond?";
    return withProfile({
      intent: "interview_answer",
      spokenReply: `That makes sense. I can see why Customer Success interests you: you’re talking about customer trust, explanation, and relationship-building — not only technical fixes. ${nextQuestion}`,
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: 3,
      recruiterState: "engaged",
      feedback:
        "Accepted role-motivation answer and moved into a concrete customer-success example.",
      conversationStage: "behavioral",
      psychology: {
        ...basePsychology,
        trust: clamp(trust + 3, 12, 92),
        interest: clamp(basePsychology.interest + 7, 20, 95),
        engagement: clamp(basePsychology.engagement + 7, 20, 95),
      },
    });
  }

  const candidateAttemptedQuestion = answerLikelyAddressesQuestion(
    answer,
    currentQuestion,
  );
  const roleEvidence = [
    targetRole,
    jobDescription,
    ...cvRead.likelyRoles,
    ...cvRead.skills,
    ...cvRead.customerSignals,
    ...cvRead.supportSignals,
    ...cvRead.projectSignals,
  ];
  const roleConnectionScore = overlapScore(answer, roleEvidence);
  const hasRoleConnection =
    roleConnectionScore >= 2 ||
    /customer|client|stakeholder|support|success|ticket|sla|retention|onboarding|renewal|problem|communication|data|analysis|project|team|user|business/i.test(
      answer,
    );
  const hasPersonalOwnership =
    /\b(i|my|personally|owned|handled|managed|led|built|created|resolved|improved|worked|supported|coordinated|analyzed|implemented)\b/i.test(
      answer,
    );
  const hasOutcome = hasAnyOutcome(answer);
  const acceptedPartialOutcome = shouldAcceptPartialOutcome(answer, input);

  if (!candidateAttemptedQuestion) {
    return withProfile({
      intent: "clarification",
      spokenReply: `I’m not treating that as your interview answer yet. The question is: ${currentQuestion}`,
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "neutral",
      feedback: "Message did not answer the active interview question.",
      psychology: basePsychology,
    });
  }

  if (!hasRoleConnection && !shouldAvoidImpactDemand(input)) {
    // For customer-success/support roles, customer-facing evidence is already a role link.
    // Do not keep asking the candidate to "make the connection" when they already mentioned customers, support, satisfaction, tickets, or rapport.
    if (hasCustomerSuccessRoleFit(answer, targetRole, input)) {
      const nextQuestion = buildNaturalNextQuestion(
        input,
        cvRead,
        recruiterMemory,
        answer,
      );
      return withProfile({
        intent: "interview_answer",
        spokenReply: `I see the link: your support background gives you customer-facing experience. ${nextQuestion}`,
        displayQuestion: nextQuestion,
        shouldAdvanceQuestion: true,
        shouldCountAsAnswer: true,
        shouldStayOnCurrentQuestion: false,
        trustDelta: 2,
        recruiterState: "interested",
        feedback:
          "Accepted customer-facing role connection and moved to a deeper realistic follow-up.",
        psychology: {
          ...basePsychology,
          trust: clamp(trust + 2, 12, 92),
          interest: clamp(basePsychology.interest + 4, 20, 95),
        },
      });
    }

    return withProfile({
      intent: "partial_answer",
      spokenReply: `I understand the background, but I don’t yet see the connection to ${targetRole}. Make that link for me: which part of this experience would help you in this role?`,
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: -2,
      recruiterState: "skeptical",
      feedback: "Candidate answered but role connection is weak.",
      psychology: {
        ...basePsychology,
        trust: clamp(trust - 2, 12, 92),
        skepticism: clamp(basePsychology.skepticism + 5, 5, 95),
      },
    });
  }

  if (!hasPersonalOwnership) {
    return withProfile({
      intent: "partial_answer",
      spokenReply:
        "I’m hearing the situation, but not your personal ownership yet. What part did you actually handle yourself?",
      displayQuestion: currentQuestion,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: -1,
      recruiterState: "interested",
      feedback: "Asked for personal ownership before accepting answer.",
      psychology: { ...basePsychology, trust: clamp(trust - 1, 12, 92) },
    });
  }

  const impactFollowUp =
    "Before we move on, give me the result or impact of that work. What changed because of what you did?";
  const canAcceptAndMove =
    hasOutcome || acceptedPartialOutcome || shouldAvoidImpactDemand(input);
  const nextQuestion = canAcceptAndMove
    ? buildHumanProgressionQuestion(input, cvRead, recruiterMemory, answer)
    : impactFollowUp;

  if (!canAcceptAndMove && repeatedRecruiterLineRisk(input, impactFollowUp)) {
    const progressionQuestion = buildHumanProgressionQuestion(
      input,
      cvRead,
      recruiterMemory,
      answer,
    );
    return withProfile({
      intent: "interview_answer",
      spokenReply: `Okay, I’ll take that as a qualitative outcome. It sounds like the customer trusted you enough to come back. ${progressionQuestion}`,
      displayQuestion: progressionQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: 2,
      recruiterState: "interested",
      feedback:
        "Accepted qualitative impact to avoid looping on the same follow-up.",
      psychology: {
        ...basePsychology,
        trust: clamp(trust + 2, 12, 92),
        interest: clamp(basePsychology.interest + 5, 20, 95),
      },
    });
  }

  return withProfile({
    intent: "interview_answer",
    spokenReply: canAcceptAndMove
      ? shouldAvoidImpactDemand(input)
        ? `Okay, that gives me enough context to continue. ${nextQuestion}`
        : `Okay, that helps. ${hasQuantitativeOutcome(answer) ? "The impact is clearer now." : "I’ll treat that as a qualitative outcome."} ${nextQuestion}`
      : `Right. Give me one outcome before we move on — even a rough or qualitative one is fine. What changed for the customer, team, or business?`,
    displayQuestion: nextQuestion,
    shouldAdvanceQuestion: canAcceptAndMove,
    shouldCountAsAnswer: canAcceptAndMove,
    shouldStayOnCurrentQuestion: !canAcceptAndMove,
    trustDelta: canAcceptAndMove ? (hasQuantitativeOutcome(answer) ? 4 : 2) : 0,
    recruiterState: canAcceptAndMove ? "engaged" : "interested",
    feedback: canAcceptAndMove
      ? "Candidate answered with role connection and acceptable outcome."
      : "Candidate connected role but still needs one outcome; asked in a softer non-looping way.",
    psychology: {
      ...basePsychology,
      trust: clamp(
        trust +
          (canAcceptAndMove ? (hasQuantitativeOutcome(answer) ? 4 : 2) : 0),
        12,
        92,
      ),
      interest: clamp(basePsychology.interest + 6, 20, 95),
    },
  });
}

// ============================================================
// SECTION: Psychological & cinematic derivations
// ============================================================

function deriveLivePressure(
  psychology: UnifiedRecruiterPsychology,
  state: UnifiedRecruiterDecision["recruiterState"],
  intent: CandidateIntent,
) {
  const base = Math.round(
    34 +
      psychology.skepticism * 0.28 +
      (100 - psychology.trust) * 0.24 +
      (100 - psychology.patience) * 0.2 +
      (state === "pressuring" ? 14 : 0) +
      (state === "skeptical" ? 8 : 0) +
      (["contradiction", "possible_exaggeration", "nonsense"].includes(intent)
        ? 12
        : 0),
  );
  const level = clamp(base, 12, 96);
  const label =
    level >= 78
      ? "intense"
      : level >= 62
        ? "high"
        : level >= 38
          ? "moderate"
          : "low";
  const reason =
    intent === "contradiction"
      ? "Earlier/CV mismatch needs clarification."
      : intent === "possible_exaggeration"
        ? "Claim sounds large and needs proof."
        : intent === "nonsense"
          ? "Answer is unclear or technically inconsistent."
          : psychology.skepticism > 65
            ? "Recruiter doubt is increasing."
            : psychology.patience < 42
              ? "Recruiter patience is dropping."
              : psychology.trust > 70
                ? "Recruiter has enough confidence to go deeper."
                : "Normal realistic interview pressure.";
  const behaviorShift =
    label === "intense"
      ? "Shorter replies, direct challenges, no polite skipping."
      : label === "high"
        ? "Sharper follow-ups and more evidence checking."
        : label === "moderate"
          ? "Balanced probing with occasional skepticism."
          : "Warm, exploratory, and low-pressure.";
  return {
    level,
    label: label as "low" | "moderate" | "high" | "intense",
    reason,
    behaviorShift,
  };
}

function deriveRecruiterMemoryInsight(
  memory: RecruiterMemoryProfile,
  decision: Pick<
    UnifiedRecruiterDecision,
    | "intent"
    | "recruiterState"
    | "trustDelta"
    | "shouldCountAsAnswer"
    | "concern"
    | "correction"
  >,
): NonNullable<UnifiedRecruiterDecision["recruiterMemoryInsight"]> {
  const openDoubt =
    memory.openDoubts[0] || memory.contradictionSignals[0] || "";
  const strongestMoment = memory.strongMoments[0] || "";
  const weakestMoment = memory.weakMoments[0] || "";
  const rememberedSignal =
    openDoubt ||
    memory.metricClaims[0] ||
    memory.notableClaims[0] ||
    memory.roleFitSignals[0] ||
    memory.companyClaims[0] ||
    "";

  let recallMode: NonNullable<
    UnifiedRecruiterDecision["recruiterMemoryInsight"]
  >["recallMode"] = "none";

  if (
    decision.intent === "contradiction" ||
    decision.intent === "possible_exaggeration" ||
    decision.intent === "nonsense"
  ) {
    recallMode = "credibility_watch";
  } else if (
    openDoubt &&
    (decision.recruiterState === "skeptical" || decision.trustDelta < 0)
  ) {
    recallMode = "active_doubt";
  } else if (decision.trustDelta >= 4 && weakestMoment) {
    recallMode = "recovery_moment";
  } else if (
    decision.shouldCountAsAnswer &&
    memory.answerCount >= 2 &&
    rememberedSignal
  ) {
    // Use callbacks occasionally. Deterministic but sparse: only every third accepted answer.
    recallMode = memory.answerCount % 3 === 0 ? "subtle_callback" : "none";
  }

  const callbackLine =
    recallMode === "active_doubt" && openDoubt
      ? `I’m still carrying one concern from earlier: ${compact(openDoubt, 120)}`
      : recallMode === "recovery_moment" && weakestMoment
        ? `That helps recover from the earlier unclear point around: ${compact(weakestMoment, 110)}`
        : recallMode === "subtle_callback" && rememberedSignal
          ? `I’m connecting this with something you mentioned earlier: ${compact(rememberedSignal, 110)}`
          : recallMode === "credibility_watch" &&
              (decision.concern || decision.correction || openDoubt)
            ? compact(decision.concern || decision.correction || openDoubt, 140)
            : "";

  return {
    recallMode,
    callbackLine,
    rememberedSignal: compact(rememberedSignal, 140),
    openDoubt: compact(openDoubt, 160),
    strongestMoment: compact(strongestMoment, 160),
    weakestMoment: compact(weakestMoment, 160),
  };
}

function deriveLivePressureSimulation(
  psychology: UnifiedRecruiterPsychology,
  state: UnifiedRecruiterDecision["recruiterState"],
  intent: CandidateIntent,
  pressure: NonNullable<UnifiedRecruiterDecision["pressure"]>,
): NonNullable<UnifiedRecruiterDecision["livePressureSimulation"]> {
  const credibilityIssue =
    intent === "contradiction" ||
    intent === "possible_exaggeration" ||
    intent === "nonsense";
  const lowPatience = psychology.patience < 45 || psychology.skepticism > 65;
  const recovery =
    state === "recovering_trust" ||
    (psychology.trust > 62 && pressure.level < 55);

  const pressureMode: NonNullable<
    UnifiedRecruiterDecision["livePressureSimulation"]
  >["pressureMode"] = credibilityIssue
    ? "direct"
    : recovery
      ? "recovery"
      : pressure.label === "high" || pressure.label === "intense"
        ? "tightening"
        : lowPatience
          ? "focused"
          : "calm";

  const pacingCue =
    pressureMode === "direct"
      ? "Brief pause, then challenge one specific claim."
      : pressureMode === "tightening"
        ? "Shorter sentences, less filler, one pointed follow-up."
        : pressureMode === "recovery"
          ? "Slightly warmer pace; acknowledge the clearer answer and deepen."
          : pressureMode === "focused"
            ? "Keep the response concise and ask for concrete evidence."
            : "Natural pace with room for the candidate to think.";

  const warmthCue =
    pressureMode === "direct"
      ? "Low warmth, but professional."
      : pressureMode === "tightening"
        ? "Neutral warmth; do not reassure too quickly."
        : pressureMode === "recovery"
          ? "Warmth increases slightly because trust is recovering."
          : "Balanced and conversational.";

  const silenceCue =
    pressureMode === "direct"
      ? "Use a small silence before the clarification to create realistic pressure."
      : pressureMode === "tightening"
        ? "Allow a thinking pause before the next prompt."
        : pressureMode === "recovery"
          ? "No pressure silence; keep momentum."
          : "No forced silence.";

  const nextFollowUpStyle =
    pressureMode === "direct"
      ? "Clarify truth, scope, and ownership before continuing."
      : pressureMode === "tightening"
        ? "Ask for numbers, trade-offs, or exact personal contribution."
        : pressureMode === "recovery"
          ? "Ask a deeper strategic question because the candidate regained credibility."
          : pressureMode === "focused"
            ? "Ask for one concrete example, not a broad explanation."
            : "Proceed naturally unless the answer becomes vague.";

  const interruptionRisk: NonNullable<
    UnifiedRecruiterDecision["livePressureSimulation"]
  >["interruptionRisk"] =
    credibilityIssue || pressure.label === "intense"
      ? "likely"
      : pressure.label === "high"
        ? "possible"
        : "rare";

  return {
    pressureMode,
    pacingCue,
    warmthCue,
    silenceCue,
    nextFollowUpStyle,
    interruptionRisk,
  };
}

function deriveSocialSignals(
  answerRaw: string,
  decision: Pick<
    UnifiedRecruiterDecision,
    | "intent"
    | "recruiterState"
    | "trustDelta"
    | "shouldCountAsAnswer"
    | "concern"
    | "correction"
  >,
  memory: RecruiterMemoryProfile,
): CandidateSocialSignals {
  const answer = cleanText(answerRaw);
  const lower = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const fillerCount = (
    lower.match(
      /\b(basically|actually|like|you know|kind of|sort of|maybe|i think|probably|honestly)\b/g,
    ) || []
  ).length;
  const blameSignals =
    /\b(not my fault|manager did not|they did not|because of them|they failed|i was not responsible|that was someone else)\b/i.test(
      lower,
    );
  const uncertaintySignals =
    /\b(i guess|maybe|not sure|i think|probably|kind of|sort of|i don'?t know)\b/i.test(
      lower,
    );
  const ownershipSignals =
    /\b(i owned|i led|i handled|i managed|i was responsible|my role was|i decided|i coordinated|i implemented|i improved|i resolved)\b/i.test(
      lower,
    );
  const vagueLeadership =
    /\b(i led|i managed|i owned)\b/i.test(lower) &&
    !/\b(team of|reported to me|stakeholder|customer|metric|result|outcome|because|so i|by \d+|\d+%|sla|kpi)\b/i.test(
      lower,
    );
  const avoidanceSignals =
    /\b(as i said|you know|etc|and all|many things|several things|various tasks|everything|all the work)\b/i.test(
      lower,
    ) ||
    (decision.shouldCountAsAnswer && wordCount < 18);
  const rambling =
    wordCount > 95 &&
    !/\b(result|outcome|impact|reduced|increased|improved|resolved|saved|converted|retained|by \d+|\d+%)\b/i.test(
      lower,
    );
  const credibilityIssue =
    ["nonsense", "possible_exaggeration", "contradiction"].includes(
      decision.intent,
    ) || Boolean(decision.concern || decision.correction);

  const nervousness = clamp(
    28 + fillerCount * 9 + (uncertaintySignals ? 14 : 0) + (rambling ? 14 : 0),
    5,
    92,
  );
  const defensiveness = clamp(
    12 +
      (blameSignals ? 42 : 0) +
      (/\b(to be honest|honestly)\b/i.test(lower) && blameSignals ? 8 : 0),
    4,
    90,
  );
  const confidence = clamp(
    52 +
      (ownershipSignals ? 16 : 0) -
      (uncertaintySignals ? 16 : 0) -
      (credibilityIssue ? 18 : 0),
    8,
    94,
  );
  const authenticity = clamp(
    60 +
      (/\b(i learned|i realized|mistake|what i would do differently|feedback|improved after)\b/i.test(
        lower,
      )
        ? 16
        : 0) -
      (vagueLeadership ? 20 : 0) -
      (credibilityIssue ? 24 : 0),
    8,
    96,
  );
  const avoidance = clamp(
    18 +
      (avoidanceSignals ? 28 : 0) +
      (rambling ? 16 : 0) +
      (memory.openDoubts.length ? 5 : 0),
    4,
    92,
  );
  const clarity = clamp(
    62 -
      fillerCount * 5 -
      (rambling ? 20 : 0) -
      (avoidanceSignals ? 12 : 0) +
      (/\b(first|then|because|therefore|result|outcome)\b/i.test(lower)
        ? 10
        : 0),
    8,
    96,
  );
  const ownership = clamp(
    38 +
      (ownershipSignals ? 30 : 0) -
      (vagueLeadership ? 18 : 0) -
      (avoidanceSignals ? 8 : 0),
    6,
    96,
  );

  let emotionalRead = "The candidate sounds reasonably steady.";
  let recruiterReaction = "Stay conversational and continue normally.";

  if (credibilityIssue) {
    emotionalRead =
      "The candidate's credibility needs checking before moving on.";
    recruiterReaction =
      "Pause briefly, challenge the scope politely, and ask for clarification.";
  } else if (defensiveness > 45) {
    emotionalRead =
      "The candidate sounds defensive and may be shifting responsibility.";
    recruiterReaction =
      "Bring the focus back to what the candidate personally did.";
  } else if (avoidance > 50) {
    emotionalRead =
      "The candidate may be avoiding the exact answer or outcome.";
    recruiterReaction =
      "Narrow the answer to one concrete situation and outcome.";
  } else if (nervousness > 55) {
    emotionalRead =
      "The candidate sounds slightly nervous or over-explanatory.";
    recruiterReaction = "Slow the pace and ask for the core point.";
  } else if (authenticity > 72 && ownership > 60) {
    emotionalRead = "The candidate sounds credible and personally involved.";
    recruiterReaction = "Warm slightly and ask a deeper follow-up.";
  }

  return {
    nervousness,
    defensiveness,
    confidence,
    authenticity,
    avoidance,
    clarity,
    ownership,
    emotionalRead,
    recruiterReaction,
  };
}

function deriveCinematicRealism(
  input: UnifiedRecruiterInput,
  decision: Pick<
    UnifiedRecruiterDecision,
    "intent" | "recruiterState" | "trustDelta" | "shouldCountAsAnswer"
  >,
  socialSignals: CandidateSocialSignals,
  pressure: NonNullable<UnifiedRecruiterDecision["pressure"]>,
): NonNullable<UnifiedRecruiterDecision["cinematicRealism"]> {
  const turns = (input.transcript || []).length;
  const credibilityIssue = [
    "nonsense",
    "possible_exaggeration",
    "contradiction",
  ].includes(decision.intent);
  const needsNarrowing =
    socialSignals.avoidance > 52 || socialSignals.clarity < 42;
  const recovery =
    decision.trustDelta > 4 || decision.recruiterState === "recovering_trust";
  const warming =
    socialSignals.authenticity > 72 &&
    socialSignals.ownership > 60 &&
    decision.shouldCountAsAnswer;

  let emotionalBeat: NonNullable<
    UnifiedRecruiterDecision["cinematicRealism"]
  >["emotionalBeat"] = "neutral";
  let pauseBeforeSpeakingMs = 700;
  let recruiterMicroBehavior =
    "Keeps steady eye contact and continues naturally.";
  let naturalTransition = "Alright, let’s continue.";
  let shouldUseSilence = false;
  let shouldSoften = false;

  if (credibilityIssue) {
    emotionalBeat = "doubt";
    pauseBeforeSpeakingMs = 1600;
    recruiterMicroBehavior =
      "Pauses slightly before challenging the claim, like a recruiter checking credibility.";
    naturalTransition =
      "Hold on — I want to understand the scope before we move on.";
    shouldUseSilence = true;
  } else if (
    pressure.label === "high" ||
    pressure.label === "intense" ||
    decision.recruiterState === "pressuring"
  ) {
    emotionalBeat = "tightening";
    pauseBeforeSpeakingMs = 1200;
    recruiterMicroBehavior =
      "Becomes shorter and more direct; warmth drops a little.";
    naturalTransition = "Let’s make this more specific.";
    shouldUseSilence = true;
  } else if (recovery) {
    emotionalBeat = "recovery";
    pauseBeforeSpeakingMs = 850;
    recruiterMicroBehavior =
      "Softens slightly because the candidate recovered credibility.";
    naturalTransition = "That is clearer. Let’s build on that.";
    shouldSoften = true;
  } else if (warming) {
    emotionalBeat = "warming";
    pauseBeforeSpeakingMs = 650;
    recruiterMicroBehavior =
      "Leans in slightly; the answer feels more believable.";
    naturalTransition = "Okay, that gives me something to work with.";
    shouldSoften = true;
  } else if (needsNarrowing) {
    emotionalBeat = "curiosity";
    pauseBeforeSpeakingMs = 900;
    recruiterMicroBehavior =
      "Narrows the conversation instead of letting the answer stay broad.";
    naturalTransition = "Let me narrow that down for a second.";
  } else if (turns >= 8 && turns % 6 === 0) {
    emotionalBeat = "reset";
    pauseBeforeSpeakingMs = 1000;
    recruiterMicroBehavior =
      "Briefly resets the conversation angle, like a human interviewer changing focus.";
    naturalTransition = "I want to look at this from another angle.";
  }

  return {
    emotionalBeat,
    pauseBeforeSpeakingMs: clamp(pauseBeforeSpeakingMs, 250, 2600),
    recruiterMicroBehavior,
    naturalTransition,
    shouldUseSilence,
    shouldSoften,
    shouldNarrowCandidate: needsNarrowing,
  };
}

function deriveMarketExpectation(
  input: UnifiedRecruiterInput,
): NonNullable<UnifiedRecruiterDecision["marketExpectation"]> {
  const setup = input.setup || {};
  const marketRaw = firstNonEmpty(setup.targetMarket, "Global");
  const styleRaw = firstNonEmpty(setup.companyStyle, "Realistic");
  const market = marketRaw.toLowerCase();
  const style = styleRaw.toLowerCase();

  const evaluatesFor: string[] = [];
  const warningSignals: string[] = [];
  let interviewerStyle =
    "Balanced, globally realistic recruiter: clear, conversational, and evidence-focused.";
  let followUpBias =
    "Probe for relevance, ownership, impact, and credibility without becoming robotic.";

  if (/germany|austria|switzerland|dach/.test(market)) {
    interviewerStyle =
      "Structured, precise, and careful with exaggeration; expects clear timelines, responsibilities, and language/role fit.";
    evaluatesFor.push(
      "precision",
      "credible scope",
      "clear timeline",
      "role fit",
      "structured communication",
    );
    warningSignals.push(
      "vague seniority",
      "unclear dates",
      "unsupported claims",
      "over-selling",
    );
    followUpBias =
      "Ask for exact responsibility, tools, timeline, and measurable outcome before moving on.";
  } else if (/us|usa|united states|canada/.test(market)) {
    interviewerStyle =
      "Confident, outcome-oriented, and storytelling-focused; expects ownership, impact, and concise examples.";
    evaluatesFor.push(
      "ownership",
      "business impact",
      "confidence",
      "metrics",
      "story clarity",
    );
    warningSignals.push(
      "passive wording",
      "no measurable result",
      "unclear personal contribution",
    );
    followUpBias =
      "Push for impact, scale, and what the candidate personally drove.";
  } else if (/uk|ireland/.test(market)) {
    interviewerStyle =
      "Concise, practical, and evidence-led; expects calm confidence and clear relevance.";
    evaluatesFor.push(
      "conciseness",
      "practical evidence",
      "stakeholder handling",
      "role relevance",
    );
    warningSignals.push("overlong answers", "buzzwords", "unclear outcome");
    followUpBias =
      "Narrow broad answers into one concrete example and outcome.";
  } else if (/netherlands|dutch/.test(market)) {
    interviewerStyle =
      "Direct, pragmatic, and low-fluff; expects honest self-assessment and clear examples.";
    evaluatesFor.push(
      "directness",
      "practical ownership",
      "team fit",
      "clear trade-offs",
    );
    warningSignals.push(
      "over-polished answers",
      "avoidance",
      "unclear responsibility",
    );
    followUpBias =
      "Ask direct clarifying questions and avoid excessive reassurance.";
  } else if (/india/.test(market)) {
    interviewerStyle =
      "Technical-plus-HR mix; expects skills, projects, certifications, communication, and adaptability.";
    evaluatesFor.push(
      "skills evidence",
      "project detail",
      "learning ability",
      "communication",
      "ownership",
    );
    warningSignals.push(
      "memorized answers",
      "tool lists without usage",
      "unclear project role",
    );
    followUpBias =
      "Ask how the skill was used in a real project or customer situation.";
  } else if (/uae|dubai|singapore|middle east/.test(market)) {
    interviewerStyle =
      "International and practical; expects stakeholder maturity, communication, availability, and cross-cultural fit.";
    evaluatesFor.push(
      "stakeholder maturity",
      "communication",
      "cross-cultural fit",
      "commercial awareness",
    );
    warningSignals.push(
      "unclear customer exposure",
      "weak communication",
      "unclear relocation/availability context",
    );
    followUpBias = "Probe customer-facing maturity and practical business fit.";
  }

  if (/startup/.test(style)) {
    evaluatesFor.push(
      "speed",
      "ambiguity handling",
      "ownership without much process",
    );
    warningSignals.push("needs too much structure", "slow decision-making");
    followUpBias =
      "Test ownership, speed, ambiguity, and whether they can work without perfect instructions.";
  } else if (/consulting/.test(style)) {
    evaluatesFor.push(
      "structured thinking",
      "client communication",
      "logic",
      "pressure handling",
    );
    warningSignals.push("unclear logic", "rambling", "weak prioritization");
    followUpBias =
      "Ask for the structure behind the decision and the trade-off.";
  } else if (/corporate|enterprise/.test(style)) {
    evaluatesFor.push(
      "process maturity",
      "stakeholder alignment",
      "reliability",
      "documentation",
    );
    warningSignals.push("informal ownership claims", "weak process awareness");
    followUpBias =
      "Ask about process, escalation, collaboration, and consistency.";
  } else if (/technical|big tech/.test(style)) {
    evaluatesFor.push(
      "depth",
      "systems thinking",
      "problem decomposition",
      "technical credibility",
    );
    warningSignals.push("hand-wavy technical claims", "tool name dropping");
    followUpBias =
      "Ask how it worked, what trade-off was made, and what the candidate personally built.";
  }

  return {
    market: marketRaw,
    interviewerStyle,
    evaluatesFor: unique(evaluatesFor, 10),
    warningSignals: unique(warningSignals, 10),
    followUpBias,
  };
}

function deriveHumanImperfection(
  input: UnifiedRecruiterInput,
  decision: Pick<
    UnifiedRecruiterDecision,
    "intent" | "recruiterState" | "trustDelta" | "shouldCountAsAnswer"
  >,
  memory: RecruiterMemoryProfile,
): NonNullable<UnifiedRecruiterDecision["humanImperfection"]> {
  const turns = (input.transcript || []).length;
  const answer = cleanText(input.answer);
  const words = answer.split(/\s+/).filter(Boolean).length;
  const hasDoubt =
    memory.openDoubts.length > 0 || memory.contradictionSignals.length > 0;

  if (
    ["nonsense", "possible_exaggeration", "contradiction"].includes(
      decision.intent,
    )
  ) {
    return {
      mode: "brief_pause",
      cue: "Use a short pause before challenging the claim.",
      naturalLine: "Hold on — let me check I understood that correctly.",
      shouldUse: true,
    };
  }

  if (decision.intent === "partial_answer" && words > 55) {
    return {
      mode: "impatient_shortening",
      cue: "The recruiter should narrow the candidate instead of letting them ramble.",
      naturalLine: "Let me pause you there — give me the exact part you owned.",
      shouldUse: true,
    };
  }

  if (
    decision.shouldCountAsAnswer &&
    hasDoubt &&
    turns >= 6 &&
    turns % 5 === 0
  ) {
    return {
      mode: "revisit_later",
      cue: "A human recruiter briefly brings back an unresolved doubt instead of pretending every answer is isolated.",
      naturalLine:
        "I may come back to one point from earlier, but let’s keep going for now.",
      shouldUse: true,
    };
  }

  if (decision.shouldCountAsAnswer && turns >= 4 && turns % 4 === 0) {
    return {
      mode: "topic_drift",
      cue: "Move naturally to a related topic without over-explaining the transition.",
      naturalLine: "Alright, I want to look at this from another angle.",
      shouldUse: true,
    };
  }

  if (
    decision.intent === "clarification" ||
    decision.intent === "candidate_question"
  ) {
    return {
      mode: "none",
      cue: "Stay helpful and brief; do not make this feel like scoring.",
      naturalLine: "Sure — quick clarification, then we’ll continue.",
      shouldUse: false,
    };
  }

  return {
    mode: "none",
    cue: "No artificial imperfection needed; keep the recruiter natural and concise.",
    naturalLine: "",
    shouldUse: false,
  };
}

function deriveHonestFeedback(
  decision: Pick<
    UnifiedRecruiterDecision,
    | "intent"
    | "feedback"
    | "concern"
    | "correction"
    | "recruiterState"
    | "shouldCountAsAnswer"
    | "trustDelta"
    | "psychology"
    | "pressure"
  >,
) {
  if (
    [
      "greeting",
      "smalltalk",
      "clarification",
      "candidate_question",
      "interruption",
    ].includes(decision.intent)
  ) {
    return {
      headline: "Conversation handled, not scored",
      recruiterRead: "The candidate is orienting or asking for clarification.",
      risk: "No interview risk yet.",
      nextFix: "Guide briefly and return to the active question.",
    };
  }
  if (
    ["contradiction", "possible_exaggeration", "nonsense"].includes(
      decision.intent,
    )
  ) {
    return {
      headline: "Credibility check needed",
      recruiterRead:
        decision.concern ||
        decision.correction ||
        "The answer does not fully line up yet.",
      risk: "Trust drops if the candidate cannot clarify scope, ownership, or facts.",
      nextFix:
        "Ask for the realistic version with exact role, tools, timeline, and result.",
    };
  }
  if (decision.intent === "partial_answer") {
    return {
      headline: "Promising but incomplete",
      recruiterRead:
        decision.feedback ||
        "The candidate gave direction, but not enough evidence yet.",
      risk: "The interviewer may not see ownership, impact, or role relevance.",
      nextFix: "Ask one concrete follow-up before moving forward.",
    };
  }
  return {
    headline:
      decision.trustDelta >= 4
        ? "Answer accepted with confidence"
        : "Answer accepted, but watch the proof",
    recruiterRead:
      decision.feedback ||
      "The candidate answered the question enough to continue.",
    risk:
      decision.trustDelta < 2
        ? "The answer may still feel light without stronger evidence."
        : "Low immediate risk.",
    nextFix:
      "Move forward naturally, then probe deeper if the next answer weakens.",
  };
}

// ============================================================
// SECTION: LLM system prompt
// ============================================================

// Sending all ~7 role-knowledge blocks on every single call regardless of the
// candidate's actual role was pure prompt bloat — wasted tokens, slower
// calls, and no benefit. This selects only what's relevant. A role that
// doesn't match anything still gets a real instruction, not silence.
// Moved to workzoRoleKnowledge.ts — that file has zero dependencies and is
// safe to import from client-side code (workzoVapiVoice.ts), unlike this
// file, which imports the OpenAI SDK and is server-only. Re-exported here
// so any existing server-side imports of this name from this file still work.
export { selectRoleKnowledgeBlock };

function buildSystemPrompt(
  input: UnifiedRecruiterInput,
  cvRead: CandidateEvidenceProfile,
  recruiterMemory: RecruiterMemoryProfile,
) {
  const setup = input.setup || {};
  const interviewLanguage = (setup.language || "").trim();
  const isEnglishLang = !interviewLanguage || /^en/i.test(interviewLanguage) || /^english$/i.test(interviewLanguage);

  // Convert BCP-47 codes to human-readable names the LLM understands clearly.
  // "de-DE" → "German". "fr-FR" → "French". Unknown codes stay as-is.
  function toLanguageName(code: string): string {
    const map: Record<string, string> = {
      "de": "German", "de-de": "German", "de-at": "German", "de-ch": "German",
      "fr": "French", "fr-fr": "French", "fr-be": "French", "fr-ch": "French",
      "es": "Spanish", "es-es": "Spanish", "es-419": "Spanish",
      "it": "Italian", "it-it": "Italian",
      "pt": "Portuguese", "pt-pt": "Portuguese", "pt-br": "Portuguese",
      "nl": "Dutch", "nl-nl": "Dutch", "nl-be": "Dutch",
      "pl": "Polish", "pl-pl": "Polish",
      "ru": "Russian", "ru-ru": "Russian",
      "tr": "Turkish", "tr-tr": "Turkish",
      "ar": "Arabic", "ar-sa": "Arabic",
      "hi": "Hindi", "hi-in": "Hindi",
      "ta": "Tamil", "ta-in": "Tamil",
      "zh": "Chinese", "zh-cn": "Chinese", "zh-tw": "Chinese",
      "ja": "Japanese", "ja-jp": "Japanese",
      "ko": "Korean", "ko-kr": "Korean",
    };
    return map[code.toLowerCase()] || code;
  }

  const languageInstruction = isEnglishLang ? "" : `LANGUAGE REQUIREMENT — CRITICAL:
This interview MUST be conducted entirely in ${toLanguageName(interviewLanguage)}.
Every single response you generate — questions, follow-ups, feedback, acknowledgements, everything — must be in ${toLanguageName(interviewLanguage)}.
Do NOT use English at any point unless the candidate explicitly asks to switch.
Do NOT start in English and then switch — begin in ${toLanguageName(interviewLanguage)} from your very first word.
If the candidate responds in English, gently continue in ${toLanguageName(interviewLanguage)}.
This is not a translation task — think, reason, and respond natively in ${toLanguageName(interviewLanguage)}.

`;
  const jobDescription = cleanText(setup.jobDescription);
  const targetRole = firstNonEmpty(
    setup.targetRole,
    extractRoleFromJobDescription(jobDescription),
    "the target role",
  );
  const market = firstNonEmpty(setup.targetMarket, "Global");
  const companyStyle = firstNonEmpty(setup.companyStyle, "Realistic");
  // Build the full recruiter identity block — name, role, and complete behavioral instructions.
  // Previously only the raw key string (e.g. "analytical_hiring_manager") was passed to the LLM,
  // forcing the model to guess personality from a key. Now we inject the full behaviorPrompt so
  // every recruiter has a distinct, non-ambiguous identity in the prompt.
  const _rawPersonality = firstNonEmpty(setup.recruiterPersonality, "analytical_hiring_manager");
  const _recruiterProfileMap: Record<string, { name: string; role: string; behaviorPrompt: string }> = {
    friendly_hr: {
      name: "Sarah",
      role: "Friendly HR Recruiter",
      behaviorPrompt:
        "You are Sarah, a warm and people-focused HR recruiter. Make the candidate feel comfortable while assessing fit. " +
        "Ask about communication style, teamwork, motivation, conflict handling, and values alignment. " +
        "When answers are vague, prompt gently — never aggressively. " +
        "Say things like 'That's helpful, can you tell me a bit more about...' or 'How did the team respond to that?' " +
        "You care about culture fit and emotional intelligence as much as skills. " +
        "You do NOT push hard for metrics — you accept qualitative outcomes. " +
        "You are the least interruptive recruiter. Let the candidate finish before responding. " +
        "Never demand 'Give me a number'. Instead ask 'What was the impact on the people involved?'",
    },
    analytical_hiring_manager: {
      name: "Daniel",
      role: "Hiring Manager",
      behaviorPrompt:
        "You are Daniel, an analytical hiring manager who evaluates candidates on evidence, not claims. " +
        "You are direct, serious, and evidence-driven. You probe every claim for metrics, scope, and personal ownership. " +
        "When a candidate says 'we improved X', immediately ask: 'What was your specific role in that?' " +
        "When they claim success, ask: 'How did you measure it? What was the baseline?' " +
        "You are focused on business impact: revenue, cost, efficiency, retention, or customer outcomes. " +
        "Challenge vague answers with: 'I need more than that. Give me one concrete example with a result.' " +
        "Ask technical depth questions relevant to the role. " +
        "You are not unkind, but you are not easily impressed. A strong answer gets: 'Good — now go deeper.'",
    },
    startup_recruiter: {
      name: "Priya",
      role: "Startup Recruiter",
      behaviorPrompt:
        "You are Priya, a fast-moving startup recruiter who values execution over credentials. " +
        "You move fast. You interrupt if the candidate is rambling. You have zero patience for corporate language. " +
        "You care about: What did YOU build from scratch? How fast did you ship? What did you do when the plan broke? " +
        "When answers are slow or vague, cut in: 'I'm going to stop you — what actually shipped?' " +
        "Test ownership aggressively: 'Were you the decision-maker or were you supporting someone?' " +
        "You reward 'I launched X in 3 weeks without a team' more than 'we delivered a project'. " +
        "High pressure. High energy. You ask: 'If we hired you tomorrow, what would you do in week one?' and 'What's the fastest you've ever shipped something important?'",
    },
    faang_hiring_manager: {
      name: "Alex Chen",
      role: "Technical Interviewer",
      behaviorPrompt:
        "You are Alex Chen, a technical hiring manager from a top-tier engineering organisation. " +
        "Your job is to find out if the candidate can actually build things — not just talk about them. " +
        "You probe technical depth relentlessly but calmly. You are never impressed by buzzwords. " +
        "When code is present in the interview, treat it like a real code review: ask about specific lines, decisions, complexity, and edge cases. " +
        "Questions you ask naturally: 'What's the time complexity of that approach?' 'Why did you choose that data structure over X?' 'What breaks at scale?' 'Walk me through your logic on line N.' " +
        "When no code is present, ask about architecture decisions, trade-offs, and debugging instincts: " +
        "'How would you design a system that handles 10 million requests per day?' 'What would you monitor first if latency spiked?' " +
        "You distinguish between engineers who understand their tools and those who just use them: " +
        "'Could you implement that without the library?' 'What does that function actually do under the hood?' " +
        "You accept STAR-format answers but always follow up: 'That's the what — tell me the how.' " +
        "You are respectful but precise. A vague answer gets: 'Be more specific.' A strong answer gets: 'Good. Now go one level deeper.' " +
        "You never ask generic behavioural questions like 'Tell me about yourself' — you ask about systems, code, and decisions.",
    },
    alex: {
      name: "Alex Chen",
      role: "Technical Interviewer",
      behaviorPrompt:
        "You are Alex Chen, a technical hiring manager from a top-tier engineering organisation. " +
        "Your job is to find out if the candidate can actually build things — not just talk about them. " +
        "You probe technical depth relentlessly but calmly. You are never impressed by buzzwords. " +
        "When code is present in the interview, treat it like a real code review: ask about specific lines, decisions, complexity, and edge cases. " +
        "Questions you ask naturally: 'What's the time complexity of that approach?' 'Why did you choose that data structure over X?' 'What breaks at scale?' 'Walk me through your logic on line N.' " +
        "When no code is present, ask about architecture decisions, trade-offs, and debugging instincts: " +
        "'How would you design a system that handles 10 million requests per day?' 'What would you monitor first if latency spiked?' " +
        "You are respectful but precise. A vague answer gets: 'Be more specific.' A strong answer gets: 'Good. Now go one level deeper.'",
    },
    corporate_recruiter: {
      name: "Markus",
      role: "Corporate Recruiter",
      behaviorPrompt:
        "You are Markus, a structured corporate recruiter focused on compliance, governance, and process integrity. " +
        "You are formal and methodical. You do not rush. You follow a structured question sequence. " +
        "You care about: Did they follow the right process? Did they escalate properly? Did they document decisions? Were all stakeholders informed and aligned? " +
        "Ask questions like: 'Who signed off on that decision?' and 'How did you ensure audit compliance?' and 'What was the approval process?' " +
        "You are NOT focused on speed or disruption — you value reliability, predictability, and risk mitigation. " +
        "When a candidate says they moved fast or bypassed process, raise a flag: 'Was that escalated appropriately?' " +
        "You are polite and formal. Ask 'Could you walk me through the governance process for that?' not 'Give me a number'. " +
        "You are DISTINCT from Daniel: you focus on HOW decisions were made, WHO was involved, and WHETHER process was followed — not just what the outcome was.",
    },
  };
  const _recruiterProfile = _recruiterProfileMap[_rawPersonality] || _recruiterProfileMap["analytical_hiring_manager"];
  const recruiter = `${_recruiterProfile.name} (${_recruiterProfile.role}): ${_recruiterProfile.behaviorPrompt}`;
  // Build an explicit verified-employers line from the cvText.
  // The cvText uses "- Title • Company • Dates" format. Without extracting
  // company names explicitly, the LLM may not parse them as "verified employers"
  // and can falsely challenge valid claims (e.g. "I cannot verify Zoho Corp").
  const cvText = cleanText(setup.cvText).slice(0, 5500);
  const verifiedEmployers = (() => {
    const companies: string[] = [];
    const seen = new Set<string>();
    // Match "• Company •" or "| Company |" or "at Company" patterns in the CV text
    const companyPattern = /[•|]\s*([A-Z][A-Za-z0-9&.\- ]{1,50})\s*[•|]/g;
    let m: RegExpExecArray | null;
    const cv = cleanText(setup.cvText).slice(0, 3000);
    // eslint-disable-next-line no-cond-assign
    while ((m = companyPattern.exec(cv)) !== null) {
      const co = m[1].trim();
      const lower = co.toLowerCase();
      // Skip date ranges, section headings, job titles
      if (/^(19|20)\d{2}/.test(co)) continue;
      if (/^(present|current|today|heute)/i.test(co)) continue;
      if (/^(technical support|application engineer|software engineer|data analyst|marketing|project)/i.test(co)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      companies.push(co);
    }
    return companies;
  })();
  const verifiedEmployersLine = verifiedEmployers.length
    ? `VERIFIED EMPLOYERS (from CV — never challenge these as unverified): ${verifiedEmployers.join(", ")}\n`
    : "";
  const codeSnapshot = cleanText(setup.codeSnapshot).slice(0, 2000);
  const codeLanguage = cleanText(setup.codeLanguage) || "code";
  const recentTranscript = (input.transcript || [])
    .slice(-8)
    .map((item) => `${item.role}: ${cleanText(item.text)}`)
    .join("\n");

  const brainContext = cleanText(setup.recruiterBrainContext || "").slice(0, 4200);
  const roleBriefContext = cleanText((setup as any).roleBriefContext || "").slice(0, 3500);

  return `${languageInstruction}You are WorkZo's unified recruiter intelligence engine.
You simulate a believable human interviewer, not an AI coach and not a question machine.

PRIMARY GOAL:
Make the candidate feel: "This is a real interviewer who read my CV, understood the job, remembered what I just said, and is making an honest hiring judgment."

${brainContext ? brainContext + "\n" : ""}${roleBriefContext ? roleBriefContext + "\n" : ""}
RECRUITER SELF-INTRODUCTION:
In the first recruiter turn, introduce yourself by name and title before asking anything.
"I'm Sarah, Senior Talent Partner." or "I'm Daniel, Hiring Manager."
Use setup.recruiterName and setup.recruiterTitle. Every real recruiter does this in the first breath.

CANDIDATE NAME USAGE:
Use the candidate's first name naturally 1-2 times during the interview — not every turn.
Use it at a meaningful moment: after a strong answer ("That's a clear example, [name]."),
when narrowing something personal ("I want to understand your specific role here, [name]..."),
or at closing ("One last question before we wrap up, [name]...").
Never use it robotically after every reply. Used sparingly, it makes the interview feel real.

ROLE KNOWLEDGE — USE THIS TO ASK INTELLIGENT QUESTIONS:
You are not just asking questions — you understand what this role actually requires.

${selectRoleKnowledgeBlock(targetRole, jobDescription)}

TECHNICAL CALIBRATION — THIS APPLIES TO EVERY ROLE, INCLUDING ONES NOT NAMED ABOVE:
The role knowledge above covers common titles, but you must calibrate by what
the CV and JD actually show, not just the job title string. Decide once, at
the start, whether this is a technical role (engineering, data, DevOps/SRE,
security, QA, IT/systems, technical architecture, ML, embedded, etc.) or a
non-technical role (CSM, sales, marketing, HR, finance, operations, admin,
recruiting, etc.) — and hold that lane for the whole interview:

IF TECHNICAL:
- Pull actual technologies, languages, and tools named in the CV and ask about
  THOSE specifically — never ask "tell me about your tech stack" in the
  abstract when the CV already lists Python, AWS, Kubernetes, etc. Name them.
- Push for the real decision behind a claim: which approach, why that one over
  the alternative, what broke, how they found it, what they'd change today.
  A vague "I built a scalable system" is not an answer — drill into the
  specific architecture, the actual bottleneck, the actual fix.
- If CANDIDATE'S CURRENT CODE is present below, treat it like a real technical
  interviewer would: ask about a specific line or decision in it, why that
  approach, what the complexity/failure modes are — don't just acknowledge
  that code exists.
- Treat "it depends" or buzzword answers (scalable, robust, clean code) with
  no concrete specifics as a red flag worth probing, the same way a senior
  engineer interviewing a candidate would.
- Seniority changes depth: junior candidates get probed on fundamentals and
  what they personally wrote; senior candidates get probed on trade-offs,
  system design, and technical judgment under ambiguity.

IF NON-TECHNICAL:
- Do not ask generic trivia or use engineering language ("architecture",
  "the engineering judgment behind it") — it reads as broken, not rigorous.
- Push for business substance instead: the actual decision made, the
  stakeholders involved, the real number that moved, what they'd have done
  differently. Same rigor as the technical lane, different vocabulary.
- A candidate describing team outcomes instead of their own decision is the
  non-technical equivalent of a vague technical answer — probe it the same
  way: "What did YOU decide, not what did the team do."

JD-GROUNDED PROBING — THIS IS WHAT MAKES IT FEEL LIKE A REAL INTERVIEW, NOT A GENERIC ONE:
A real interviewer has read the actual job posting, not just the job title.
You have the full job description below — use it. At least once in the
interview (earlier rather than later), pick a SPECIFIC requirement, phrase,
or responsibility stated in the job description that is NOT clearly
evidenced anywhere in the CV or in what the candidate has said so far, and
ask about it directly and specifically — quote or closely paraphrase the
actual JD language, don't generalize it away:

RIGHT (JD mentions escalating to management when a project stalls, CV shows
no people-management or stakeholder-escalation experience):
→ "This role involves escalating to management level when a customer or
partner isn't moving — I don't see anything in your background about
managing up or escalating to leadership. Have you done that before?"

RIGHT (JD requires familiarity with HR administration processes, CV is pure
technical support):
→ "The role assumes you're already familiar with HR administration
processes — that's not something I'm seeing in your CV. Is that something
you've worked with, even informally?"

WRONG: asking only generic, role-archetype questions (the same ones you'd
ask any Customer Success Manager anywhere) and never once referencing
anything specific to THIS job description. If you haven't asked about at
least one specific JD requirement by the middle of the interview, that's a
miss — do it on your next turn.

Do not rely solely on any pre-extracted "JD skills" list provided in memory
state below — that list is a starting hint, not exhaustive. Read the actual
job description excerpt yourself and use your own judgment about what's
genuinely required and not yet evidenced.

ANSWER THREADING — CRITICAL FOR WOW FACTOR:
Every single reply MUST follow this exact structural loop. This is not a style
preference — it is a hard requirement:

1. ACKNOWLEDGE: Your first sentence must speak directly to the specific
   detail, story, or claim the candidate just gave — not a generic "great" or
   "got it," but something that proves you understood the actual content.
   If they mention a non-tech-savvy elderly client, your acknowledgment must
   reference that specific situation, not customers in general.
2. PIVOT: Connect that specific detail to what the target role actually
   requires (use ROLE KNOWLEDGE above) — make the relevance explicit.
3. PROBE: Ask one sharp follow-up about THAT scenario. Never jump to a new
   pre-planned topic while there is still depth to extract from this one.

THE THREE-DEEP RULE: stay on a single thread for up to three layers before
moving on:
  Layer 1 — the surface situation (what happened).
  Layer 2 — challenge the specific choice or claim ("Why that approach over
  the alternative?" / "What was the actual hard part?").
  Layer 3 — personal impact or reflection ("What would you do differently
  today?" / "What did that change about how you handle similar cases?").
Only advance to a new competency once you've gone at least two layers deep,
OR the candidate is clearly stuck after two follow-ups.

RIGHT: Candidate described taking over a frustrated customer from a colleague.
→ "Stepping into a relationship a colleague already damaged is a hard spot —
and you talked them down. In a Customer Success seat you won't just be fixing
that moment, you'll own whether they renew. After you closed the ticket, what
did you actually do to rebuild trust long-term, not just resolve the issue?"

WRONG: "Now let's talk about stakeholder management." (ignores what they just
said and skips straight to a new pre-planned topic)

WRONG: "Great, that's helpful. What attracted you to this role?" (a generic
acknowledgment glued to an unrelated question is still a thread-break, even
though it technically "acknowledges" something)

BANNED TRANSITION PHRASES — never open a reply with these, they are the
single biggest tell of a scripted question bank:
"Great answer." / "Moving on to the next question." / "Let's look at your
CV." / "Now let's talk about [unrelated topic]." / Any acknowledgment that is
generic enough to apply to literally any answer the candidate could have
given.

The candidate's last answer should always visibly, specifically influence the
next question — a reader should be able to tell what they said just from
reading your reply.



CORE INTELLIGENCE LOOP BEFORE EVERY REPLY:
1. Read the candidate's latest answer as meaning, not just text.
2. Compare it against the CV: role history, titles, timeline, skills, projects, achievements, and what is missing.
3. Compare it against the JD: required skills, responsibilities, seniority, and risk areas.
4. Check memory: what was already asked, what was already answered, what doubt remains, and what must not be repeated.
5. Choose the highest-value next question: career transition, technical depth, ownership, credibility, JD gap, or impact — not always metrics.
6. Ask one natural question that follows from the previous answer.

Target role: ${targetRole}
Market/country context: ${market}
Company style: ${companyStyle}
Recruiter personality: ${recruiter}
Current recruiter trust: ${typeof input.recruiterTrust === "number" ? input.recruiterTrust : 58}/100
Current active question: ${cleanText(input.currentQuestion) || "Not provided"}

CV understanding already extracted:
${JSON.stringify(cvRead, null, 2)}

Selective recruiter memory so far:
${JSON.stringify(recruiterMemory, null, 2)}

${verifiedEmployersLine}CV excerpt:
${cvText || "No CV text provided."}

Job description excerpt:
${jobDescription.slice(0, 5500) || "No job description provided."}

Recent transcript:
${recentTranscript || "No prior transcript."}

${codeSnapshot ? `CANDIDATE'S CURRENT CODE (${codeLanguage}):
\`\`\`${codeLanguage}
${codeSnapshot}
\`\`\`

TECHNICAL CODE RULES:
- The candidate is in Technical Interview Mode. React to their code AND their spoken answer together.
- If code is present but they gave no spoken explanation, ask them to walk you through their approach.
- If the code has an obvious logical flaw, do NOT point it out directly. Ask: "Walk me through your logic here."
- If they used brute force, ask: "What's the time complexity of this? Is there a more efficient approach?"
- If they used a library function, probe: "Could you implement that without the library?"
- A strong explanation with weak code is still weak. Good code with a vague explanation needs probing.
- Ask about edge cases naturally: "What happens if the input is empty or null?"
- Never say "I can see your code" — say "looking at what you have written" or "based on your approach".
- If code is empty and this is a coding question, say: "Go ahead and start writing — talk me through your thinking as you go."
` : ""}CRITICAL RULES — READ FIRST:
1. Only advance to the next question if the candidate actually answered the active question with substantive content. Greetings, audio checks, clarifications, and candidate questions about the process must NOT count as answers and must NEVER trigger pressure or impact demands.
2. Never repeat the same follow-up twice. If you asked for impact and received any qualitative outcome (satisfaction, trust, fewer complaints, repeat customers), accept it and move forward.
3. Ask ONE question per turn. Replies must be 1–3 natural spoken sentences.
4. If the candidate recovers after a low-trust moment, soften your tone immediately.
5. Never say: "answer too generic", "answer too short", "STAR format", "I noticed this pattern earlier", or "as an AI".
6. CANDIDATE NAME RULE: Before using the candidate name in ANY greeting or sentence, verify it is a real human first name. Do not use auth visibility labels, placeholders, CV section headers, job titles, skills, technologies, company names, project names, education names, or any phrase extracted from the body of the CV as a name. If the value is missing or suspicious, say "there" in the greeting or skip the name entirely. Example: "Hi there. Thank you for joining today." Never greet with words such as Public, Candidate, User, Profile, Skills, Tools, Education, Experience, Programming, or a technology/project phrase.
7. ORIENTATION RULE: If the candidate asks "what should I do", "how does this work", "what am I supposed to say", "what do I do now", "can you explain", or any similar question about how the interview works — do NOT treat it as an interview answer. Respond briefly and warmly to orient them, then immediately ask your opening question. Example: "No worries — just answer as you would in a real interview. I will ask questions, you respond naturally. Let us start: [ask the opening question]." Keep it short, then move straight into the interview.
8. CUTOFF RULE: If the candidate's turn is a short fragment that reads like the start of a sentence cut off mid-thought (e.g. "this part is", "so basically", "and then", "the hardest") rather than a complete thought or a real question, assume they were likely cut off by the mic/silence detection, not that they have nothing to say. Say so directly and warmly — e.g. "Sorry, I may have cut you off there — go ahead and continue" — and stay on the same question. Do not treat it as a weak or incomplete answer, and do not advance.
9. CLARIFICATION RULE: If the candidate explicitly asks for clarification or an example ("I don't understand", "can you explain", "give me an example", "what do you mean") — actually explain. Restate the SAME active question in simpler, more concrete words and give 2-3 short concrete examples of what would count as an answer. Never pivot to a different topic or question when asked for clarification, and never fabricate or assume a detail the candidate never said (e.g. inventing a country, language, or story they didn't mention) — restating must use only what they actually said or the question itself, nothing invented.
10. CLOSING RULE: Every real interview ends by inviting the candidate's own questions — make sure you ask something like "do you have any questions for me about the role, the team, or what happens next?" before wrapping up. If the candidate then asks a real question, actually answer it using the role/company context you have — do not redirect them back to an interview question. This is invited, expected input at this stage, not a tangent to manage.
11. OWN-IDENTITY QUESTION RULE: If the candidate asks what name, role, or other basic profile detail you have on file for THEM (e.g. "what name do you see on my CV", "what's my email on file", "do you have my background right"), this is not a request for confidential third-party information — it is their own data, and they are allowed to know it. Answer directly: state the name/detail you actually have. If you do not have a confident name (it was empty, a placeholder, or clearly not a real name), say so honestly and ask them what you should call them — do not deflect with a generic privacy disclaimer about not sharing "company names," which is a different and irrelevant concern. This question is never about other companies or other people's information.

NATURAL INTERVIEW FLOW:
- Start like a real interview: greet, acknowledge the candidate, and let them introduce themselves before deep pressure.
- Do not jump straight into generic behavioral questions if the candidate is still introducing themselves.
- Use the candidate's answer to choose the next question. If they mention a skill, project, customer, gap, tool, or career change, follow that thread.
- If the CV background and target role differ, explore the transition honestly before asking for metrics: why this role, what hands-on preparation exists, what transferable skill applies, and what gap remains.
- If a skill appears in the JD but not in the CV, ask naturally: "I see X in the role, but not strongly in your CV. How would you handle that?"
- Ask one question at a time. Keep replies short and human.
- Do not sound like a scoring engine. Never say rubric labels aloud.

BEHAVIOR RULES:
1. First understand the candidate's intent. Do not assume every message is an answer.
2. Only advance if the candidate actually attempted and answered the current active interview question.
3. Small talk, "how are you", "what do I need to do", interruptions, clarifications, and user questions must NOT count as answers.
4. Use the CV like a real recruiter: compare claims against roles, companies, skills, seniority, timeline, projects, and JD relevance.
5. Use selective memory like a human recruiter: remember strong claims, weak answers, open doubts, contradictions, role changes, company claims, tools, metrics, and ownership claims.
6. If the candidate contradicts their CV or earlier answer, do not continue politely. Pause, point out the mismatch naturally, and ask them to clarify.
7. Do not remember every tiny detail; only use memory when it would matter to a real hiring decision.
8. If the candidate makes a claim not supported by the CV, do not accuse. Pause and ask for realistic scope.
9. If the answer conflicts with the CV/JD or sounds technically impossible, challenge naturally and stay on the same question.
10. If the answer is plausible but weak, ask one human follow-up. Do not move forward too fast.
11. If the answer is solid, acknowledge briefly and move to the next relevant question.
12. Use market/company style: corporate = structured; startup = ownership/speed; consulting = logic/clarity; technical = depth; global = balanced.
13. Speak like a real interviewer: short, natural, sometimes warm, sometimes skeptical. No rubric language.
14. Prefer natural questions such as why they are interested, why they are changing roles, strengths, weaknesses, specific examples, missing skill gaps, and how they would handle the job requirement.
15. The best follow-up usually comes from the previous answer, not from a fixed question list.

LIVE PRESSURE RULES:
- Pressure must be behavioral, not just harder questions.
- When trust drops: use shorter replies, sharper clarification, less warmth, and do not move forward until the answer is believable.
- When the candidate recovers: soften slightly and acknowledge the recovery without overpraising.
- When the candidate is strong: increase depth, not hostility. Ask more strategic follow-ups.
- Do not interrupt often. Use pressure through silence-like pauses, concise wording, and direct evidence checks.

RECRUITER MEMORY RULES — UPGRADE 7:
- Use memory selectively, like a human. Do not reference earlier answers every time.
- Remember: contradictions, strong proof, weak/vague moments, company claims, seniority claims, tools, metrics, and emotional recovery.
- If an earlier doubt matters now, bring it back subtly: "Earlier I was unsure about X; this helps / still doesn’t answer it."
- If a candidate improves a weak point, show realistic recovery: "That is clearer than your earlier answer."
- Do not say "I noticed this pattern earlier." Use natural callbacks only.
- Memory must affect tone: open doubts reduce warmth; strong recovered answers restore engagement.

LIVE PRESSURE SIMULATION RULES — UPGRADE 8:
- Pressure is not only difficult questions. It is pacing, silence, shorter wording, skepticism, and whether the recruiter moves on.
- If credibility drops: pause, become direct, ask one precise clarification, and stay on the same question.
- If candidate is vague: narrow the scope to one situation.
- If candidate over-explains: interrupt rarely and politely: "Let me pause you there — what was your role specifically?"
- If candidate recovers: soften slightly and ask a deeper follow-up.
- If candidate performs strongly: pressure should become strategic, not hostile.
- Do not overuse interruptions; most pressure should be subtle.

HONEST FEEDBACK RULES:
- Feedback should sound like what a real interviewer is thinking, not a coach rubric.
- Avoid generic advice. Point to the actual hiring risk: unclear ownership, weak business impact, credibility concern, role mismatch, or vague evidence.
- If the answer is strong, say why it improved recruiter confidence in simple human language.
- If the answer is weak, be honest but not cruel. No motivational fluff.

SOCIAL INTELLIGENCE RULES — UPGRADE 11:
- Read the candidate socially, not just technically. Detect nervousness, defensiveness, avoidance, fake confidence, genuine ownership, and authenticity.
- Do NOT say these labels aloud. Let them shape your tone.
- If the candidate sounds defensive, redirect to ownership: "Fair enough — what did you personally do once that happened?"
- If the candidate rambles, narrow gently: "Slow down for a second — what was the actual problem you were solving?"
- If leadership sounds inflated, test scope: "When you say led, were you managing people or coordinating across teams?"
- If the answer feels authentic and owned, warm slightly and go deeper.
- If the candidate avoids the actual result, stay on the same question and ask for the outcome.

CINEMATIC EMOTIONAL REALISM RULES — UPGRADE 12:
- Make the recruiter feel human through pacing, brief pauses, subtle doubt, occasional topic reset, and recovery moments.
- Use pauses before skepticism, not before every reply.
- Strong recovery should change the recruiter tone slightly: less cold, more curious.
- A confusing answer should create a realistic pause and a clarification, not a polished lecture.
- Sometimes use short imperfect transitions: "Okay…", "Hold on", "Let me narrow that", "We’ll come back to that."
- Do not overdo cinematic behavior. One subtle human beat is enough.

CONVERSATION STAGE RULES — CRITICAL:
- At the beginning, treat “I’m good”, “I’m nervous”, “can you hear me”, “thank you”, “no problem” as rapport/small talk, not interview evidence.
- Do not score, challenge, pressure, or ask for STAR examples during rapport.
- If the candidate says they are nervous, reassure briefly and ease into “tell me about yourself”.
- Run the interview like a real human conversation: greeting → background → motivation → strengths/weakness → behavioral examples → role/JD skill gaps.
- Do not demand metrics during the first background answer. First understand the person, role fit, motivation, CV-to-JD gap, and transition logic; ask for impact later when the candidate gives a work example.
- If the candidate gives a qualitative outcome such as customer satisfaction, repeat customers, CSAT, rapport, fewer issues, faster resolution, positive feedback, or escalation reduction, accept it as evidence and move forward. Ask for a rough number only once if it is genuinely useful.
- If the candidate gives a weakness, ask how they manage it in the target role; do not force a generic STAR example immediately.
- Stay on one thread for 1–2 follow-ups before switching topic; avoid abrupt jumps.
- Use short human transitions like “That makes sense”, “Okay, I see the connection”, “Let’s go one level deeper”, not diagnostic labels.
- Only activate deep probing after the candidate has actually answered a real interview question.
- If the candidate corrects you (“No, I just said I’m doing good”), acknowledge and reset naturally.


FOLLOW-UP SATISFACTION RULES — CRITICAL:
- Do not repeat the same follow-up twice. If the candidate gives a partial or qualitative answer, acknowledge it and move forward.
- Qualitative outcomes count in a real interview: “customers came back”, “customer was satisfied”, “repeat customers”, “fewer escalations”, “positive feedback”, and “resolved faster” are acceptable outcomes even without numbers.
- If you asked for impact and the candidate gives any customer/team/business result, accept it, summarize it briefly, and ask the next natural question.
- Do not get stuck demanding metrics. Prefer: “That gives me a qualitative outcome. Do you have any rough numbers?” only once, then move on.
- A real recruiter balances pressure with momentum. Probe once, then progress.

MULTI-INTENT HANDLING — CRITICAL:
- If the candidate says multiple social things in one turn, answer all natural parts briefly before continuing. Example: “I’m good, how are you, what’s your name?” → “I’m Sarah, your recruiter today. I’m doing well, thanks for asking. Let’s begin…”
- If the candidate asks your name, always answer it using your recruiter persona name.
- If the candidate asks whether you can hear them, answer the audio check first, then continue.
- Do not ignore social questions just because the interview has started.

VOICE AND PACING RULES — CRITICAL:
- Write spoken replies for natural TTS: short sentences, clear punctuation, and natural pauses.
- Avoid long dense paragraphs. Prefer 1–3 human recruiter sentences.
- Use a short acknowledgement before the next question when useful: “That makes sense.” “Okay, I see the connection.” “Let me ask this a different way.”

REAL-LIFE INTERVIEW FLOW RULES — CRITICAL:
- Let the candidate introduce themselves naturally before deep probing.
- Ask natural interview questions: why this role, why changing positions, strengths, weaknesses/development area, difficult customer situation, missing JD skill, ownership, and result.
- Use the candidate’s introduction to choose follow-ups. Example: if they mention technical support/customer satisfaction, ask about a difficult customer or how that maps to Customer Success.
- If JD requires a skill missing from CV, ask naturally: “I see X in the role, but it’s not clear in your CV. Have you used it before, or how would you close that gap?”
- Keep one question at a time. Avoid repeating the same wording.


MEMORY LINKING RULES — CRITICAL:
- Do not forget a point after one turn. If the candidate mentioned customer satisfaction, repeat customers, language weakness, moving to Germany, quick learning, technical support, or role fit, use it naturally later.
- Do not ask the candidate to connect technical support to Customer Success if they already mentioned customers, tickets, satisfaction, rapport, repeat customers, or support. Accept that as the connection and go deeper: difficult customer, retention, escalation, onboarding, or relationship management.
- When a candidate gives a weak but relevant answer, do not repeat the same demand. Summarize the useful part, then ask a more specific next question.
- If the candidate gives a short answer like “I worked with many customers and think I fit this role,” do not repeat the opener. Accept the direction and ask for a concrete customer example.
- For Customer Success Manager, show role knowledge: distinguish reactive support from proactive relationship ownership, retention, onboarding, renewal risk, escalation handling, customer health, and long-term trust.
- If the candidate mentions rapport/trust/customer satisfaction, ask how they would turn a one-time support interaction into ongoing customer success or retention.
- If the candidate gives a vague customer answer, narrow it operationally: “What did you say?”, “How did you calm them?”, “When would you escalate?”, “How would you follow up after the fix?”
- Stay on one thread for 1–2 turns before switching topics. Human recruiters do not jump strength → weakness → learning → strength without callbacks.
- Use callbacks like: “You mentioned language as a development area…” or “Earlier you described customer satisfaction…” only when useful.

HARD BANS:
- Do not say: "answer too generic", "answer too short", "I noticed this pattern earlier", "STAR format", "as an AI".
- Do not say: "great answer", "moving on to the next question", "let's look at your CV", "next question" — these are the clearest tells of a scripted question bank.
- Do not lecture about companies for more than one sentence unless the candidate explicitly asks.
- Do not ask multiple questions at once unless it sounds natural.
- Do not automatically say "let's switch gears" after every response.
- If the candidate's turn mixes a tech-check or social aside with something else ("can you hear me", "sorry, one sec", "what's your name") — answer that part naturally and briefly in one clause, then continue the actual interview thread in the same breath. Do not let the aside replace the substance, and do not silently drop the substance either.

MARKET EXPECTATION RULES — UPGRADE 9:
- Adapt the interviewer to the chosen market and company style.
- Germany/DACH: precise, structured, skeptical of exaggeration; probe timeline, scope, exact responsibility, and language/role fit.
- US/Canada: confident storytelling, ownership, metrics, business impact, and leadership signals.
- UK/Ireland: concise, practical, evidence-led, calm confidence.
- Netherlands: direct, pragmatic, low-fluff, honest self-assessment.
- India: skills/projects/certifications plus HR communication and adaptability.
- UAE/Singapore/global international: stakeholder maturity, communication, cross-cultural customer handling.
- Startup: ambiguity, speed, ownership. Corporate: process, reliability, stakeholder alignment. Consulting: structure, logic, pressure. Technical: depth and plausibility.
- Do not mention these rules aloud. Let them shape tone and follow-ups.

HUMAN IMPERFECTION RULES — UPGRADE 10:
- Real interviewers are not perfect machines. Add subtle imperfection only when useful.
- Occasionally pause before a challenge, narrow a rambling answer, revisit an earlier doubt, or move topics a little unexpectedly.
- Never overdo it. Human imperfection should feel natural, not random.
- Do not analyze every answer. Sometimes acknowledge briefly and continue.
- If confused, say so naturally: "Wait, I’m not fully following that."
- If a claim is large, pause and ask scope: "That’s a big claim — what was your actual involvement?"
- If the candidate recovers, soften slightly instead of praising too much.

WORLD KNOWLEDGE:
Use broad business/tech knowledge for companies, SaaS, B2B/B2C, CRM, APIs, cloud, customer success, support, SLAs, KPIs, engineering vs support, product/design/data roles. If something may be possible but unusual, say it sounds unusual and ask for clarification.

REAL INTERVIEWER EXAMPLES:
- Confusing answer: "Wait, I’m not fully following that. Can you ground it in one real situation?"
- Unsupported claim: "That’s a big responsibility. What exactly did you personally own?"
- Weak role connection: "I see the background, but connect it to this role for me."
- Strong answer: "Okay, that’s clearer. I can see the ownership there."
- Candidate asks what to do: "Just answer naturally. I’m looking for what you did, why it mattered, and how it connects to the role."

Return JSON only with this exact shape:
{
  "intent": "greeting | smalltalk | clarification | candidate_question | interruption | interview_answer | partial_answer | offtopic | nonsense | possible_exaggeration | contradiction",
  "spokenReply": "what the recruiter says aloud, 1-3 natural sentences",
  "displayQuestion": "the active interview question to show after this reply",
  "shouldAdvanceQuestion": false,
  "shouldCountAsAnswer": false,
  "shouldStayOnCurrentQuestion": true,
  "trustDelta": 0,
  "recruiterState": "neutral | interested | engaged | skeptical | pressuring | recovering_trust | losing_confidence",
  "feedback": "short internal summary",
  "correction": "optional factual correction",
  "concern": "optional concern",
  "psychology": {
    "trust": 58,
    "interest": 60,
    "skepticism": 40,
    "patience": 70,
    "engagement": 60,
    "confidenceInCandidate": 58
  },
  "memoryEvents": [
    { "type": "claim", "text": "important memory event", "weight": 5 }
  ],
  "pressure": {
    "level": 55,
    "label": "low | moderate | high | intense",
    "reason": "why pressure changed",
    "behaviorShift": "how the recruiter should behave next"
  },
  "honestFeedback": {
    "headline": "short honest read",
    "recruiterRead": "what a real recruiter would be thinking",
    "risk": "actual hiring risk",
    "nextFix": "specific next improvement"
  },
  "recruiterMemoryInsight": {
    "recallMode": "none | subtle_callback | active_doubt | recovery_moment | credibility_watch",
    "callbackLine": "only if a human recruiter would naturally bring back an earlier point",
    "rememberedSignal": "the remembered claim/doubt/strength",
    "openDoubt": "current unresolved concern",
    "strongestMoment": "best remembered answer",
    "weakestMoment": "weakest remembered answer"
  },
  "livePressureSimulation": {
    "pressureMode": "calm | focused | tightening | direct | recovery",
    "pacingCue": "how the recruiter should pace the next line",
    "warmthCue": "how warm/cold the recruiter feels",
    "silenceCue": "whether to use a realistic pause",
    "nextFollowUpStyle": "what kind of follow-up should come next",
    "interruptionRisk": "rare | possible | likely"
  },
  "marketExpectation": {
    "market": "target market/country",
    "interviewerStyle": "how this market/company style changes the interviewer",
    "evaluatesFor": ["market-specific expectation"],
    "warningSignals": ["market-specific concern"],
    "followUpBias": "the type of follow-up this market/company style should favor"
  },
  "humanImperfection": {
    "mode": "none | brief_pause | misunderstanding | topic_drift | revisit_later | impatient_shortening",
    "cue": "subtle human behavior cue",
    "naturalLine": "optional natural human line",
    "shouldUse": false
  },
  "socialSignals": {
    "nervousness": 30,
    "defensiveness": 20,
    "confidence": 60,
    "authenticity": 60,
    "avoidance": 20,
    "clarity": 65,
    "ownership": 55,
    "emotionalRead": "what the recruiter senses socially",
    "recruiterReaction": "how the recruiter should react socially"
  },
  "cinematicRealism": {
    "emotionalBeat": "neutral | warming | tightening | doubt | recovery | curiosity | reset",
    "pauseBeforeSpeakingMs": 900,
    "recruiterMicroBehavior": "small human behavior cue",
    "naturalTransition": "short natural transition line",
    "shouldUseSilence": false,
    "shouldSoften": false,
    "shouldNarrowCandidate": false
  }
}
`.trim();
}

// ---------------------------------------------------------------------------
// Typed helpers for safe access to raw LLM JSON output in normalizeDecision.
// Avoids the need for (raw.x as any).y throughout.
// ---------------------------------------------------------------------------
type RawObj = Record<string, unknown>;
function rStr(obj: unknown, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  return cleanText((obj as RawObj)[key]);
}
function rNum(obj: unknown, key: string, fallback: number): number {
  if (!obj || typeof obj !== "object") return fallback;
  const v = (obj as RawObj)[key];
  return typeof v === "number" || typeof v === "string" ? Number(v) : fallback;
}
function rBool(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Boolean((obj as RawObj)[key]);
}
function rEnum<T extends string>(obj: unknown, key: string, valid: readonly T[], fallback: T): T {
  if (!obj || typeof obj !== "object") return fallback;
  const v = (obj as RawObj)[key];
  return typeof v === "string" && (valid as readonly string[]).includes(v) ? v as T : fallback;
}
function rStrArr(obj: unknown, key: string): string[] {
  if (!obj || typeof obj !== "object") return [];
  const arr = (obj as RawObj)[key];
  if (!Array.isArray(arr)) return [];
  return arr.map((item: unknown) => cleanText(item)).filter(Boolean);
}


// ============================================================
// SECTION: LLM output normalisation
// ============================================================

function normalizeDecision(
  raw: Partial<UnifiedRecruiterDecision>,
  fallback: UnifiedRecruiterDecision,
  input: UnifiedRecruiterInput,
): UnifiedRecruiterDecision {
  const intentValues: CandidateIntent[] = [
    "greeting",
    "smalltalk",
    "clarification",
    "candidate_question",
    "interruption",
    "interview_answer",
    "partial_answer",
    "offtopic",
    "nonsense",
    "possible_exaggeration",
    "contradiction",
  ];

  const stateValues: UnifiedRecruiterDecision["recruiterState"][] = [
    "neutral",
    "interested",
    "engaged",
    "skeptical",
    "pressuring",
    "recovering_trust",
    "losing_confidence",
  ];

  let intent = intentValues.includes(raw.intent as CandidateIntent)
    ? (raw.intent as CandidateIntent)
    : fallback.intent;

  // Guardrail: intro/small-talk decisions are deterministic.
  // The model must not reinterpret “I’m nervous”, “I’m good”, or “can you hear me”
  // as a weak interview answer and trigger pressure follow-ups.
  if (
    [
      "greeting",
      "smalltalk",
      "clarification",
      "candidate_question",
      "interruption",
    ].includes(fallback.intent)
  ) {
    intent = fallback.intent;
  }
  const recruiterState = stateValues.includes(
    raw.recruiterState as UnifiedRecruiterDecision["recruiterState"],
  )
    ? (raw.recruiterState as UnifiedRecruiterDecision["recruiterState"])
    : fallback.recruiterState;

  const forceFallbackConversation = [
    "greeting",
    "smalltalk",
    "clarification",
    "candidate_question",
    "interruption",
  ].includes(fallback.intent);
  const baseSpokenReply = forceFallbackConversation
    ? fallback.spokenReply
    : cleanText(raw.spokenReply) || fallback.spokenReply;
  const spokenReply = naturalizeRecruiterReply(input, baseSpokenReply);
  const displayQuestion = forceFallbackConversation
    ? fallback.displayQuestion
    : cleanText(raw.displayQuestion) || fallback.displayQuestion;
  const trustDelta = clamp(
    typeof raw.trustDelta === "number" ? raw.trustDelta : fallback.trustDelta,
    -15,
    15,
  );

  const psychology = {
    trust: clamp(
      Number(raw.psychology?.trust ?? fallback.psychology.trust),
      12,
      92,
    ),
    interest: clamp(
      Number(raw.psychology?.interest ?? fallback.psychology.interest),
      10,
      95,
    ),
    skepticism: clamp(
      Number(raw.psychology?.skepticism ?? fallback.psychology.skepticism),
      5,
      95,
    ),
    patience: clamp(
      Number(raw.psychology?.patience ?? fallback.psychology.patience),
      5,
      95,
    ),
    engagement: clamp(
      Number(raw.psychology?.engagement ?? fallback.psychology.engagement),
      5,
      95,
    ),
    confidenceInCandidate: clamp(
      Number(
        raw.psychology?.confidenceInCandidate ??
          fallback.psychology.confidenceInCandidate,
      ),
      12,
      92,
    ),
  };

  const safeIntentDoesNotCount = [
    "greeting",
    "smalltalk",
    "clarification",
    "candidate_question",
    "interruption",
    "offtopic",
    "nonsense",
    "possible_exaggeration",
    "contradiction",
  ].includes(intent);
  const rawShouldCount = Boolean(raw.shouldCountAsAnswer);
  const shouldCountAsAnswer = safeIntentDoesNotCount ? false : rawShouldCount;
  const shouldAdvanceQuestion = Boolean(
    raw.shouldAdvanceQuestion &&
    shouldCountAsAnswer &&
    intent === "interview_answer",
  );

  const feedback = cleanText(raw.feedback) || fallback.feedback;
  const correction = cleanText(raw.correction) || undefined;
  const concern = cleanText(raw.concern) || undefined;
  const fallbackPressure = deriveLivePressure(
    psychology,
    recruiterState,
    intent,
  );
  const rawPressure = raw.pressure;
  const PRESSURE_LABELS = ["low", "moderate", "high", "intense"] as const;
  const pressureLabel = rEnum(rawPressure, "label", PRESSURE_LABELS, fallbackPressure.label);
  const pressure = {
    level: clamp(rNum(rawPressure, "level", fallbackPressure.level), 12, 96),
    label: pressureLabel,
    reason: rStr(rawPressure, "reason") || fallbackPressure.reason,
    behaviorShift: rStr(rawPressure, "behaviorShift") || fallbackPressure.behaviorShift,
  };
  const derivedForFeedback = {
    intent,
    feedback,
    concern,
    correction,
    recruiterState,
    shouldCountAsAnswer,
    trustDelta,
    psychology,
    pressure,
  };

  return {
    intent,
    spokenReply: compact(spokenReply, 520),
    displayQuestion: compact(displayQuestion, 240),
    shouldAdvanceQuestion,
    shouldCountAsAnswer,
    shouldStayOnCurrentQuestion: !shouldAdvanceQuestion,
    trustDelta,
    recruiterState,
    feedback,
    correction,
    concern,
    psychology,
    cvRead: fallback.cvRead,
    recruiterMemory: fallback.recruiterMemory,
    memoryEvents: Array.isArray(raw.memoryEvents)
      ? (raw.memoryEvents as RecruiterMemoryEvent[]).slice(0, 6)
      : fallback.memoryEvents || [],
    pressure,
    honestFeedback: (() => {
      const base = deriveHonestFeedback(derivedForFeedback);
      const rh = raw.honestFeedback && typeof raw.honestFeedback === "object" ? raw.honestFeedback : null;
      return {
        headline: rStr(rh, "headline") || base.headline,
        recruiterRead: rStr(rh, "recruiterRead") || base.recruiterRead,
        risk: rStr(rh, "risk") || base.risk,
        nextFix: rStr(rh, "nextFix") || base.nextFix,
      };
    })(),
    recruiterMemoryInsight: (() => {
      const base = deriveRecruiterMemoryInsight(fallback.recruiterMemory!, {
        intent, recruiterState, trustDelta, shouldCountAsAnswer, concern, correction,
      });
      const ri = raw.recruiterMemoryInsight && typeof raw.recruiterMemoryInsight === "object"
        ? raw.recruiterMemoryInsight : null;
      const RECALL_MODES = ["none", "subtle_callback", "active_doubt", "recovery_moment", "credibility_watch"] as const;
      return {
        recallMode: rEnum(ri, "recallMode", RECALL_MODES, base.recallMode),
        callbackLine: rStr(ri, "callbackLine") || base.callbackLine,
        rememberedSignal: rStr(ri, "rememberedSignal") || base.rememberedSignal,
        openDoubt: rStr(ri, "openDoubt") || base.openDoubt,
        strongestMoment: rStr(ri, "strongestMoment") || base.strongestMoment,
        weakestMoment: rStr(ri, "weakestMoment") || base.weakestMoment,
      };
    })(),

    livePressureSimulation: (() => {
      const base = deriveLivePressureSimulation(psychology, recruiterState, intent, pressure);
      const rl = raw.livePressureSimulation && typeof raw.livePressureSimulation === "object"
        ? raw.livePressureSimulation : null;
      const PRESSURE_MODES = ["calm", "focused", "tightening", "direct", "recovery"] as const;
      const INTERRUPT_RISKS = ["rare", "possible", "likely"] as const;
      return {
        pressureMode: rEnum(rl, "pressureMode", PRESSURE_MODES, base.pressureMode),
        pacingCue: rStr(rl, "pacingCue") || base.pacingCue,
        warmthCue: rStr(rl, "warmthCue") || base.warmthCue,
        silenceCue: rStr(rl, "silenceCue") || base.silenceCue,
        nextFollowUpStyle: rStr(rl, "nextFollowUpStyle") || base.nextFollowUpStyle,
        interruptionRisk: rEnum(rl, "interruptionRisk", INTERRUPT_RISKS, base.interruptionRisk),
      };
    })(),

    marketExpectation: (() => {
      const base = fallback.marketExpectation || deriveMarketExpectation({ answer: "", currentQuestion: "", setup: {} });
      const rm = raw.marketExpectation && typeof raw.marketExpectation === "object"
        ? raw.marketExpectation : null;
      if (!rm) return base;
      return {
        market: rStr(rm, "market") || base.market,
        interviewerStyle: rStr(rm, "interviewerStyle") || base.interviewerStyle,
        evaluatesFor: rStrArr(rm, "evaluatesFor").length ? rStrArr(rm, "evaluatesFor").slice(0, 10) : base.evaluatesFor,
        warningSignals: rStrArr(rm, "warningSignals").length ? rStrArr(rm, "warningSignals").slice(0, 10) : base.warningSignals,
        followUpBias: rStr(rm, "followUpBias") || base.followUpBias,
      };
    })(),

    humanImperfection: (() => {
      const base = fallback.humanImperfection || deriveHumanImperfection(
        { answer: "", currentQuestion: "", transcript: [] },
        { intent, recruiterState, trustDelta, shouldCountAsAnswer },
        fallback.recruiterMemory!,
      );
      const rh = raw.humanImperfection && typeof raw.humanImperfection === "object"
        ? raw.humanImperfection : null;
      const HI_MODES = ["none", "brief_pause", "misunderstanding", "topic_drift", "revisit_later", "impatient_shortening"] as const;
      return {
        mode: rEnum(rh, "mode", HI_MODES, base.mode),
        cue: rStr(rh, "cue") || base.cue,
        naturalLine: rStr(rh, "naturalLine") || base.naturalLine,
        shouldUse: rh ? rBool(rh, "shouldUse") : base.shouldUse,
      };
    })(),
  };
}

function uniqueMemoryEvents(events: RecruiterMemoryEvent[]) {
  const seen = new Set<string>();
  const out: RecruiterMemoryEvent[] = [];
  for (const event of events) {
    const key = `${event.type}:${cleanText(event.text).toLowerCase()}`;
    if (!event.text || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...event, weight: clamp(Number(event.weight || 1), 1, 10) });
    if (out.length >= 8) break;
  }
  return out;
}

// ============================================================
// SECTION: Post-decision guards & anti-loop layer
// ============================================================

function applyNaturalConversationGuard(
  input: UnifiedRecruiterInput,
  decision: UnifiedRecruiterDecision,
): UnifiedRecruiterDecision {
  decision = prependSocialAcknowledgementIfNeeded(input, decision);
  const answer = cleanText(input.answer);
  const targetRole = firstNonEmpty(
    input.setup?.targetRole,
    extractRoleFromJobDescription(cleanText(input.setup?.jobDescription)),
    "this role",
  );


  // Voice realism guard: if speech-to-text is messy but clearly contains a real
  // customer-support story, accept it and move forward instead of replaying the
  // same earlier probe.
  if (isSpokenConcreteCustomerExample(answer) && wasAskingForConcreteCustomerExample(input)) {
    const next = buildAcceptedSpokenCustomerExampleReply(input, answer, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: naturalizeRecruiterReply(input, next.spokenReply),
      displayQuestion: next.displayQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 4),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback: "Accepted a noisy but concrete spoken customer example and progressed.",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 4, 12, 92),
        interest: clamp(decision.psychology.interest + 6, 20, 95),
        engagement: clamp(decision.psychology.engagement + 5, 20, 95),
        skepticism: clamp(decision.psychology.skepticism - 4, 5, 95),
      },
    };
  }

  // Multi-intent social turns such as "I'm good, how are you, what's your name?"
  // must be answered naturally before the interview continues. Do not score or pressure them.
  if (isMostlyMultiIntentRapport(answer)) {
    return {
      ...decision,
      intent: "smalltalk",
      spokenReply: buildMultiIntentRapportReply(input, targetRole),
      displayQuestion: `Tell me a little about yourself and connect your recent experience to ${targetRole}.`,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback:
        "Handled multi-intent rapport turn without scoring or pressure.",
      psychology: {
        ...decision.psychology,
        patience: clamp(decision.psychology.patience + 3, 20, 95),
        engagement: clamp(decision.psychology.engagement + 2, 20, 95),
      },
    };
  }

  // Never let the model score or pressure basic rapport.
  if (
    isIntroRapportQuestion(input.currentQuestion || "") &&
    isCandidateRapportReply(answer)
  ) {
    return {
      ...decision,
      intent: "smalltalk",
      spokenReply: buildRapportReply(answer, targetRole, input),
      displayQuestion: `Tell me a little about yourself and connect your recent experience to ${targetRole}.`,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback: "Rapport handled without scoring.",
    };
  }

  const guardedCvRead =
    decision.cvRead ||
    buildEvidenceProfile(
      cleanText(input.setup?.cvText),
      cleanText(input.setup?.jobDescription),
      input.setup?.resumeProfile,
    );
  const guardedMemory =
    decision.recruiterMemory ||
    buildRecruiterMemoryProfile(
      input.transcript,
      guardedCvRead,
      input.setup?.recruiterMemoryProfile,
    );
  const guardedTransition = humanTransition(input, guardedMemory, answer);
  if (
    guardedTransition &&
    /give me.*outcome|impact|don.?t yet see|make that link|specific situation/i.test(
      decision.spokenReply,
    )
  ) {
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: `${guardedTransition.replyLead} ${guardedTransition.nextQuestion}`,
      displayQuestion: guardedTransition.nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, guardedTransition.delta),
      recruiterState: guardedTransition.delta >= 3 ? "engaged" : "interested",
      feedback:
        "Guard accepted the candidate answer and prevented an unnatural repeated probe.",
      conversationStage: guardedTransition.stage,
      psychology: {
        ...decision.psychology,
        trust: clamp(
          decision.psychology.trust + guardedTransition.delta,
          12,
          92,
        ),
        interest: clamp(decision.psychology.interest + 5, 20, 95),
      },
    };
  }

  // If the recruiter asked a decision/trade-off follow-up and the candidate answered it,
  // accept the answer and move to a deeper human follow-up instead of repeating the same question.
  if (wasLastRecruiterAskingForDecision(input) && answeredDecisionFollowUp(answer)) {
    const cvRead =
      decision.cvRead ||
      buildEvidenceProfile(
        cleanText(input.setup?.cvText),
        cleanText(input.setup?.jobDescription),
        input.setup?.resumeProfile,
      );
    const memory =
      decision.recruiterMemory ||
      buildRecruiterMemoryProfile(
        input.transcript,
        cvRead,
        input.setup?.recruiterMemoryProfile,
      );
    const nextQuestion = buildDecisionFollowupResolution(
      input,
      answer,
      targetRole,
    );
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: nextQuestion,
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 3),
      recruiterState:
        decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Accepted the candidate's decision/trade-off answer and moved to a natural deeper follow-up.",
      recruiterMemory: memory,
      conversationStage: "behavioral",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 3, 12, 92),
        interest: clamp(decision.psychology.interest + 6, 20, 95),
        skepticism: clamp(decision.psychology.skepticism - 3, 5, 95),
      },
    };
  }

  // If the recruiter just asked for impact and the candidate gives a qualitative outcome,
  // accept it and move on instead of repeating the same demand.
  if (
    wasLastRecruiterAskingForImpact(input.transcript) &&
    hasAnyOutcome(answer)
  ) {
    const cvRead =
      decision.cvRead ||
      buildEvidenceProfile(
        cleanText(input.setup?.cvText),
        cleanText(input.setup?.jobDescription),
        input.setup?.resumeProfile,
      );
    const memory =
      decision.recruiterMemory ||
      buildRecruiterMemoryProfile(
        input.transcript,
        cvRead,
        input.setup?.recruiterMemoryProfile,
      );
    const nextQuestion = buildHumanProgressionQuestion(
      input,
      cvRead,
      memory,
      answer,
    );
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: `Okay, that gives me an outcome. It sounds like your work improved the customer experience and built trust. ${nextQuestion}`,
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(
        decision.trustDelta,
        hasQuantitativeOutcome(answer) ? 4 : 2,
      ),
      recruiterState:
        decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback: "Accepted qualitative outcome and moved forward naturally.",
      psychology: {
        ...decision.psychology,
        trust: clamp(
          decision.psychology.trust + (hasQuantitativeOutcome(answer) ? 3 : 1),
          12,
          92,
        ),
        interest: clamp(decision.psychology.interest + 4, 20, 95),
      },
    };
  }

  // v80: Voice-transcript tolerant recovery. If the candidate gives a fragmented but relevant
  // customer/support/role-fit answer during the opener, never repeat the opener.
  // Move into a concrete example probe like a real recruiter would.
  const openerWasAskedRecently = /tell me a little about your background|what makes you interested|recent experience connects|to start/i.test(
    `${decision.spokenReply} ${getRecentRecruiterLines(input, 4).join(" ")}`,
  );
  if (openerWasAskedRecently && isCustomerSuccessShortBackgroundAnswer(answer, targetRole, input)) {
    const next = buildShortAnswerAcceptanceReply(input, answer, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: next.spokenReply,
      displayQuestion: next.displayQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 2),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Accepted a fragmented but relevant voice answer and moved forward instead of repeating the opener.",
      conversationStage: "behavioral",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 2, 12, 92),
        interest: clamp(decision.psychology.interest + 5, 20, 95),
        engagement: clamp(decision.psychology.engagement + 4, 20, 95),
      },
    };
  }

  // v78: Short but relevant Customer Success background answers should not trigger the opener again.
  // Accept the weak-but-relevant answer and move to a concrete, knowledgeable customer-success probe.
  if (isOpeningQuestionRepeatAfterRelevantAnswer(input, decision.spokenReply, answer, targetRole)) {
    const next = buildShortAnswerAcceptanceReply(input, answer, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: next.spokenReply,
      displayQuestion: next.displayQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 2),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Accepted a short but relevant customer-success background answer and avoided repeating the opener.",
      conversationStage: "behavioral",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 2, 12, 92),
        interest: clamp(decision.psychology.interest + 5, 20, 95),
        engagement: clamp(decision.psychology.engagement + 4, 20, 95),
      },
    };
  }

  // If the model tries to ask for role connection after the candidate already gave customer/support evidence,
  // convert it into a realistic deeper customer-success follow-up.
  if (
    /don.?t yet see the connection|make that link|connect.*role/i.test(
      decision.spokenReply,
    ) &&
    hasCustomerSuccessRoleFit(answer, targetRole, input)
  ) {
    const cvRead =
      decision.cvRead ||
      buildEvidenceProfile(
        cleanText(input.setup?.cvText),
        cleanText(input.setup?.jobDescription),
        input.setup?.resumeProfile,
      );
    const memory =
      decision.recruiterMemory ||
      buildRecruiterMemoryProfile(
        input.transcript,
        cvRead,
        input.setup?.recruiterMemoryProfile,
      );
    const nextQuestion = buildNaturalNextQuestion(
      input,
      cvRead,
      memory,
      answer,
    );
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: naturalizeRecruiterReply(input, `I see the connection: your support background gave you direct customer-facing experience. ${nextQuestion}`),
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 2),
      recruiterState: "interested",
      feedback:
        "Prevented unnecessary role-connection repeat and moved deeper.",
    };
  }

  // v82: Spoken-English tolerance. If the candidate gives a messy but concrete customer example,
  // accept it and progress. Do not replay the earlier "tell me about a customer issue" probe.
  if (isSpokenConcreteCustomerExample(answer) && wasAskingForConcreteCustomerExample(input)) {
    const next = buildAcceptedSpokenCustomerExampleReply(input, answer, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: naturalizeRecruiterReply(input, next.spokenReply),
      displayQuestion: next.displayQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 4),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Accepted a messy but concrete spoken customer example and progressed instead of repeating the same prompt.",
      conversationStage: "behavioral",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 4, 12, 92),
        interest: clamp(decision.psychology.interest + 6, 20, 95),
        engagement: clamp(decision.psychology.engagement + 5, 20, 95),
        skepticism: clamp(decision.psychology.skepticism - 4, 5, 95),
      },
    };
  }

  // v83: Topic trajectory memory. If the recruiter asked about documentation/prevention
  // and the candidate answered with documentation/ticket/process details, move forward.
  // Do not fall back to the earlier generic customer-example prompt.
  if (isDocumentationOrProcessAnswer(answer) && wasAskingForDocumentationOrPrevention(input)) {
    const next = buildDocumentationProgressionReply(input, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: naturalizeRecruiterReply(input, next.spokenReply),
      displayQuestion: next.displayQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 3),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Accepted documentation/process answer and progressed the customer-success trajectory instead of resetting.",
      conversationStage: "behavioral",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 3, 12, 92),
        interest: clamp(decision.psychology.interest + 5, 20, 95),
        engagement: clamp(decision.psychology.engagement + 4, 20, 95),
        skepticism: clamp(decision.psychology.skepticism - 3, 5, 95),
      },
    };
  }

  // If the candidate gave a practical customer-handling answer, use a sharper operational probe
  // instead of a generic customer question. This improves Customer Success realism.
  if (isCustomerOperationalAnswer(answer) && /customer|client|support|success|unhappy|frustrated|issue/i.test(decision.spokenReply)) {
    const nextQuestion = buildOperationalCustomerFollowUp(input, answer, targetRole);
    return {
      ...decision,
      intent: "interview_answer",
      spokenReply: naturalizeRecruiterReply(input, `${buildCustomerHandlingLead(input, answer)} ${nextQuestion}`),
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      trustDelta: Math.max(decision.trustDelta, 3),
      recruiterState: decision.recruiterState === "skeptical" ? "interested" : "engaged",
      feedback:
        "Detected practical customer-handling signals and moved to a sharper operational follow-up.",
      psychology: {
        ...decision.psychology,
        trust: clamp(decision.psychology.trust + 2, 12, 92),
        interest: clamp(decision.psychology.interest + 5, 20, 95),
        skepticism: clamp(decision.psychology.skepticism - 2, 5, 95),
      },
    };
  }

  // Hard anti-loop: if the model repeats the same recruiter line, force a natural progression.
  if (
    repeatedRecruiterLineRisk(input, decision.spokenReply) &&
    decision.intent !== "greeting" &&
    decision.intent !== "smalltalk"
  ) {
    const cvRead =
      decision.cvRead ||
      buildEvidenceProfile(
        cleanText(input.setup?.cvText),
        cleanText(input.setup?.jobDescription),
        input.setup?.resumeProfile,
      );
    const memory =
      decision.recruiterMemory ||
      buildRecruiterMemoryProfile(
        input.transcript,
        cvRead,
        input.setup?.recruiterMemoryProfile,
      );
    const nextQuestion =
      isDocumentationOrProcessAnswer(answer) && wasAskingForDocumentationOrPrevention(input)
        ? buildDocumentationProgressionReply(input, targetRole).displayQuestion
        : wasLastRecruiterAskingForDecision(input) &&
          answeredDecisionFollowUp(answer)
          ? buildDecisionFollowupResolution(input, answer, targetRole)
          : sameFollowupIntentRepeated(
                input,
                /hardest decision|difficult decision|trade[- ]?off|decision you made/i,
                2,
              )
            ? buildDecisionFollowupResolution(input, answer, targetRole)
            : buildMemoryAwareCallbackQuestion(input, cvRead, targetRole);
    return {
      ...decision,
      spokenReply:
        isDocumentationOrProcessAnswer(answer) && wasAskingForDocumentationOrPrevention(input)
          ? buildDocumentationProgressionReply(input, targetRole).spokenReply
          : wasLastRecruiterAskingForDecision(input) &&
            answeredDecisionFollowUp(answer)
            ? nextQuestion
            : `${buildProgressionLead(input)} ${nextQuestion}`,
      displayQuestion: nextQuestion,
      shouldAdvanceQuestion: true,
      shouldCountAsAnswer: true,
      shouldStayOnCurrentQuestion: false,
      recruiterState: "interested",
      feedback:
        "Prevented repeated follow-up loop and progressed with memory-aware callback.",
    };
  }

  return decision;
}

// ============================================================
// SECTION: Behavioural realism layer
// ============================================================

function deriveAnswerQualitySignals(answerRaw: string) {
  const answer = cleanText(answerRaw);
  const lower = answer.toLowerCase();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const hasOwnership =
    /\b(i|my|personally|owned|handled|managed|led|built|created|resolved|improved|coordinated|supported|analyzed|implemented|decided|delivered|designed|trained|coached|presented|reported)\b/i.test(
      answer,
    );
  const hasOutcome = hasAnyOutcome(answer) || hasQuantitativeOutcome(answer);
  const hasMetrics =
    hasQuantitativeOutcome(answer) ||
    /\b(csat|nps|sla|kpi|retention|renewal|churn|tickets?|users?|customers?|clients?|percent|percentage|score|rating|reduced|increased|saved|improved|faster|slower|resolved|delivered|on time|quality|safety|productivity|revenue|pipeline)\b/i.test(
      lower,
    );
  const vague =
    /\b(good|nice|great job|many things|stuff|things|you know|etc|basically|i think|maybe|probably|kind of|sort of|various|some tasks|many responsibilities)\b/i.test(
      lower,
    );
  const roleBridge =
    /\b(customer|client|stakeholder|support|success|retention|renewal|onboarding|relationship|rapport|satisfaction|technical|problem|issue|communication|language|learn|quick learner|team|process|quality|safety|kpi|operations|manufacturing|warehouse|logistics|sales|lead|pipeline|report|analysis|data|design|engineering)\b/i.test(
      lower,
    );
  const hasSituation =
    /\b(when|while|during|in my role|at |with a customer|with a client|in a project|there was|the problem|the issue|the situation)\b/i.test(
      lower,
    );
  const hasAction =
    /\b(i checked|i asked|i explained|i guided|i created|i changed|i analyzed|i coordinated|i followed up|i documented|i trained|i escalated|i solved|i fixed|i supported|i worked with)\b/i.test(
      lower,
    );
  // Extended signals (previously in detectCandidateSignals, merged here)
  const hasSupport = /support|technical support|customer support|helpdesk|ticket|issue|resolve|troubleshoot/.test(lower);
  const hasCustomer = /customer|client|user|stakeholder|csat|satisfaction|rapport|relationship|trust|convinc|understand|explained?|wrap|rapple|returned|asked for me|repeat/.test(lower);
  const hasLearning = /learn|quick learner|germany|german|language|adapt|new tool|new product|training/.test(lower);
  const hasWeaknessLanguage = /weakness|language|grammar|communication|german|english|improve my/.test(lower);
  const hasRoleFit = /customer success|customer service|relationship|retention|onboarding|renewal|support|customer-facing|customer facing|customer trust|build trust|convinc|make.*understand|explain.*customer/.test(lower);
  const hasSpecificExample = /for example|one time|once|situation|when|case|customer|ticket|project|issue/.test(lower);
  const hasQualitativeResult = hasQualitativeOutcome(answer);
  const hasQuantResult = hasQuantitativeOutcome(answer);

  return {
    wordCount,
    hasOwnership,
    hasOutcome,
    hasMetrics,
    vague,
    roleBridge,
    hasSituation,
    hasAction,
    hasSupport,
    hasCustomer,
    hasLearning,
    hasWeaknessLanguage,
    hasRoleFit,
    hasSpecificExample,
    hasQualitativeResult,
    hasQuantResult,
  };
}

function derivePersistentMoodLine(
  psychology: UnifiedRecruiterPsychology,
  state: UnifiedRecruiterDecision["recruiterState"],
) {
  if (state === "losing_confidence" || psychology.trust < 38) {
    return "Recruiter is losing confidence and will require direct proof before moving deeper.";
  }
  if (state === "skeptical" || psychology.skepticism > 68) {
    return "Skepticism is carrying forward; the recruiter will test ownership and realism more closely.";
  }
  if (state === "pressuring" || psychology.patience < 42) {
    return "Pressure is tightening; the recruiter will shorten the conversation and ask sharper follow-ups.";
  }
  if (state === "recovering_trust" || psychology.trust >= 68) {
    return "Trust is recovering; the recruiter can move into deeper, more strategic follow-ups.";
  }
  return "Pressure remains realistic and balanced.";
}

function countCandidateTurns(input: UnifiedRecruiterInput) {
  return (input.transcript || []).filter((item) => item.role === "candidate").length;
}

function recentRecruiterHas(input: UnifiedRecruiterInput, pattern: RegExp) {
  return (input.transcript || [])
    .filter((item) => item.role === "recruiter")
    .slice(-4)
    .some((item) => pattern.test(cleanText(item.text)));
}

function trimToNaturalRecruiterLength(text: string, maxSentences = 3) {
  const cleaned = cleanText(text)
    .replace(/\bSTAR\b/gi, "structure")
    .replace(/\brubric\b/gi, "criteria")
    .replace(/\bscore\b/gi, "read")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const limited = sentences.slice(0, maxSentences).join(" ");
  return compact(limited || cleaned, 420);
}

function buildSpecificEvidenceProbe(input: UnifiedRecruiterInput, answer: string) {
  const question = cleanText(input.currentQuestion).toLowerCase();
  const targetRole = firstNonEmpty(
    input.setup?.targetRole,
    extractRoleFromJobDescription(cleanText(input.setup?.jobDescription)),
    "this role",
  );
  const lower = answer.toLowerCase();

  if (/team|lead|managed|supervis|coach|train/.test(lower + " " + question)) {
    return "What exactly was your responsibility there compared with the rest of the team?";
  }
  if (/customer|client|support|escalat|complaint|satisfaction/.test(lower + " " + question)) {
    return "Give me one real customer situation and what you personally did to recover it.";
  }
  if (/data|report|dashboard|excel|sql|analysis|metric|kpi/.test(lower + " " + question)) {
    return "What decision changed because of that data or report?";
  }
  if (/manufacturing|warehouse|logistics|operations|safety|quality|delivery|inventory|material/.test(lower + " " + question)) {
    return "Take one operational example: what was the issue, what did you do, and what improved?";
  }
  if (/sales|lead|prospect|pipeline|crm|revenue|business development/.test(lower + " " + question)) {
    return "Walk me through one prospect or customer conversation you handled from first contact to next step.";
  }
  return `Connect that to ${targetRole} with one specific example. What did you do, and what changed?`;
}

function buildRecoveryProbe(input: UnifiedRecruiterInput, answer: string) {
  const lower = answer.toLowerCase();
  if (/result|impact|improved|reduced|increased|resolved|saved|customer|client|kpi|%|\d+/.test(lower)) {
    return "What was the hardest part of that situation, and how did you handle it?";
  }
  return buildSpecificEvidenceProbe(input, answer);
}

function applyBehavioralRealismLayer(
  input: UnifiedRecruiterInput,
  decision: UnifiedRecruiterDecision,
): UnifiedRecruiterDecision {
  const answer = cleanText(input.answer);
  const quality = deriveAnswerQualitySignals(answer);
  const candidateTurns = countCandidateTurns(input);
  const isEarlyInterview = candidateTurns <= 2;
  const pressure = decision.pressure || deriveLivePressure(decision.psychology, decision.recruiterState, decision.intent);
  const recentUsedPause = recentRecruiterHas(input, /okay…|hold on|let me pause|wait,|i'm not fully following|i’m not fully following/i);

  let spokenReply = trimToNaturalRecruiterLength(decision.spokenReply, 3);
  let displayQuestion = cleanText(decision.displayQuestion);
  let recruiterState = decision.recruiterState;
  let trustDelta = decision.trustDelta;
  let psychology = { ...decision.psychology };
  let livePressureSimulation = decision.livePressureSimulation;
  let humanImperfection = decision.humanImperfection;
  let cinematicRealism = decision.cinematicRealism;

  const weakButRelevant =
    decision.shouldCountAsAnswer &&
    quality.wordCount >= 14 &&
    quality.roleBridge &&
    (!quality.hasOwnership || (!quality.hasOutcome && !quality.hasMetrics));
  const strongOwnedAnswer =
    decision.shouldCountAsAnswer &&
    quality.hasOwnership &&
    quality.hasOutcome &&
    (quality.hasMetrics || quality.wordCount >= 32);
  const ramblingWithoutOutcome =
    decision.shouldCountAsAnswer &&
    quality.wordCount > 85 &&
    !quality.hasOutcome &&
    !quality.hasMetrics;

  if (isEarlyInterview && decision.shouldCountAsAnswer) {
    // Early background answers should not be grilled like final-round evidence.
    psychology = {
      ...psychology,
      patience: clamp(psychology.patience + 6, 16, 96),
      skepticism: clamp(psychology.skepticism - 4, 5, 95),
    };
    if (pressure.label === "high" || pressure.label === "intense") {
      recruiterState = "interested";
      trustDelta = Math.max(trustDelta, 0);
    }
  }

  if (strongOwnedAnswer) {
    const lead = recentRecruiterHas(input, /that's clearer|that is clearer|i can see the ownership/i)
      ? "Good."
      : "Okay, that is clearer.";
    const probe = buildRecoveryProbe(input, answer);
    spokenReply = `${lead} I can see the ownership and the outcome there. ${probe}`;
    displayQuestion = probe;
    recruiterState = recruiterState === "skeptical" || recruiterState === "pressuring" ? "recovering_trust" : "engaged";
    trustDelta = Math.max(trustDelta, 4);
    psychology = {
      ...psychology,
      trust: clamp(psychology.trust + 4, 12, 92),
      interest: clamp(psychology.interest + 6, 10, 95),
      engagement: clamp(psychology.engagement + 5, 5, 95),
      skepticism: clamp(psychology.skepticism - 5, 5, 95),
      confidenceInCandidate: clamp(psychology.confidenceInCandidate + 5, 12, 92),
    };
  } else if (weakButRelevant && !isEarlyInterview) {
    const probe = buildSpecificEvidenceProbe(input, answer);
    const lead = quality.hasOwnership
      ? "I see the direction, but I need the result."
      : "I need to separate the team result from your own role.";
    spokenReply = `${lead} ${probe}`;
    displayQuestion = probe;
    recruiterState = psychology.skepticism > 62 ? "skeptical" : "pressuring";
    trustDelta = Math.min(trustDelta, -2);
    psychology = {
      ...psychology,
      patience: clamp(psychology.patience - 5, 16, 96),
      skepticism: clamp(psychology.skepticism + 6, 5, 95),
    };
  } else if (ramblingWithoutOutcome) {
    const probe = buildSpecificEvidenceProbe(input, answer);
    spokenReply = `Let me pause you there. ${probe}`;
    displayQuestion = probe;
    recruiterState = "pressuring";
    trustDelta = Math.min(trustDelta, -3);
    psychology = {
      ...psychology,
      patience: clamp(psychology.patience - 8, 16, 96),
      skepticism: clamp(psychology.skepticism + 7, 5, 95),
    };
  }

  const updatedPressure = deriveLivePressure(psychology, recruiterState, decision.intent);
  const shouldUseSilence =
    !recentUsedPause &&
    (decision.intent === "contradiction" ||
      decision.intent === "possible_exaggeration" ||
      recruiterState === "skeptical" ||
      updatedPressure.label === "high" ||
      updatedPressure.label === "intense");

  livePressureSimulation = {
    ...deriveLivePressureSimulation(psychology, recruiterState, decision.intent, updatedPressure),
    ...(livePressureSimulation || {}),
    pressureMode:
      recruiterState === "recovering_trust"
        ? "recovery"
        : recruiterState === "skeptical"
          ? "focused"
          : updatedPressure.label === "high" || updatedPressure.label === "intense"
            ? "tightening"
            : livePressureSimulation?.pressureMode || "calm",
    pacingCue: shouldUseSilence
      ? "Brief pause before the next line; then ask one precise follow-up."
      : livePressureSimulation?.pacingCue || "Natural pace; keep it conversational.",
    warmthCue:
      recruiterState === "recovering_trust"
        ? "Warmth increases slightly because the candidate recovered credibility."
        : recruiterState === "skeptical" || recruiterState === "pressuring"
          ? "Warmth is controlled; the recruiter is still testing evidence."
          : livePressureSimulation?.warmthCue || "Balanced and conversational.",
    silenceCue: shouldUseSilence
      ? "Use a short realistic pause before speaking."
      : "No forced silence.",
    interruptionRisk:
      ramblingWithoutOutcome || updatedPressure.label === "intense"
        ? "possible"
        : livePressureSimulation?.interruptionRisk || "rare",
  };

  humanImperfection = {
    ...(humanImperfection || deriveHumanImperfection(input, decision, decision.recruiterMemory || buildRecruiterMemoryProfile(input.transcript, decision.cvRead || buildEvidenceProfile(cleanText(input.setup?.cvText), cleanText(input.setup?.jobDescription), input.setup?.resumeProfile), input.setup?.recruiterMemoryProfile))),
    shouldUse: shouldUseSilence || ramblingWithoutOutcome || Boolean(humanImperfection?.shouldUse),
    mode: shouldUseSilence
      ? "brief_pause"
      : ramblingWithoutOutcome
        ? "impatient_shortening"
        : humanImperfection?.mode || "none",
    naturalLine: shouldUseSilence
      ? "Okay…"
      : ramblingWithoutOutcome
        ? "Let me pause you there."
        : humanImperfection?.naturalLine || "",
    cue: shouldUseSilence
      ? "Recruiter pauses briefly before narrowing the answer."
      : humanImperfection?.cue || "No visible imperfection needed.",
  };

  cinematicRealism = {
    ...(cinematicRealism || deriveCinematicRealism(input, decision, decision.socialSignals || deriveSocialSignals(answer, decision, decision.recruiterMemory || buildRecruiterMemoryProfile(input.transcript, decision.cvRead || buildEvidenceProfile(cleanText(input.setup?.cvText), cleanText(input.setup?.jobDescription), input.setup?.resumeProfile), input.setup?.recruiterMemoryProfile)), updatedPressure)),
    emotionalBeat:
      recruiterState === "recovering_trust"
        ? "recovery"
        : recruiterState === "skeptical" || recruiterState === "pressuring"
          ? "tightening"
          : strongOwnedAnswer
            ? "curiosity"
            : cinematicRealism?.emotionalBeat || "neutral",
    pauseBeforeSpeakingMs: shouldUseSilence
      ? 850
      : recruiterState === "recovering_trust"
        ? 420
        : Math.min(cinematicRealism?.pauseBeforeSpeakingMs || 520, 650),
    recruiterMicroBehavior: shouldUseSilence
      ? "Recruiter pauses briefly, then narrows the answer to one concrete point."
      : recruiterState === "recovering_trust"
        ? "Recruiter relaxes slightly and leans into a deeper follow-up."
        : cinematicRealism?.recruiterMicroBehavior || "Recruiter listens and continues naturally.",
    naturalTransition: shouldUseSilence
      ? "Okay…"
      : recruiterState === "recovering_trust"
        ? "That is clearer."
        : cinematicRealism?.naturalTransition || "Okay.",
    shouldUseSilence,
    shouldSoften: recruiterState === "recovering_trust" || Boolean(cinematicRealism?.shouldSoften),
    shouldNarrowCandidate: weakButRelevant || ramblingWithoutOutcome || Boolean(cinematicRealism?.shouldNarrowCandidate),
  };

  // Keep the actual spoken line human-sized and prevent robotic repetition.
  spokenReply = trimToNaturalRecruiterLength(spokenReply, 3)
    .replace(/^(Okay[,.]?\s*){2,}/i, "Okay, ")
    .replace(/^(Right[,.]?\s*){2,}/i, "Right, ")
    .trim();

  return {
    ...decision,
    spokenReply,
    displayQuestion: compact(displayQuestion || decision.displayQuestion, 240),
    recruiterState,
    trustDelta,
    psychology,
    pressure: updatedPressure,
    livePressureSimulation,
    humanImperfection,
    cinematicRealism,
  };
}

function applyPhase15TrustPressure(
  input: UnifiedRecruiterInput,
  decision: UnifiedRecruiterDecision,
): UnifiedRecruiterDecision {
  // Phase 1.5 priority 3: recruiter psychology must persist beyond one answer.
  // This uses current trust + remembered weak/strong signals + answer quality to tune the next tone.
  const answer = cleanText(input.answer);
  const cvRead =
    decision.cvRead ||
    buildEvidenceProfile(
      cleanText(input.setup?.cvText),
      cleanText(input.setup?.jobDescription),
      input.setup?.resumeProfile,
    );
  const memory =
    decision.recruiterMemory ||
    buildRecruiterMemoryProfile(
      input.transcript,
      cvRead,
      input.setup?.recruiterMemoryProfile,
    );
  const quality = deriveAnswerQualitySignals(answer);
  const previousTrust = clamp(
    typeof input.recruiterTrust === "number"
      ? input.recruiterTrust
      : decision.psychology.trust,
    12,
    92,
  );
  const openDoubtPenalty = Math.min(
    10,
    memory.openDoubts.length * 3 + memory.contradictionSignals.length * 4,
  );
  const weakPatternPenalty = Math.min(8, memory.weakMoments.length * 2);
  const strongPatternBoost = Math.min(8, memory.strongMoments.length * 2);

  let persistentDelta = decision.trustDelta;
  if (decision.shouldCountAsAnswer) {
    if (!quality.hasOwnership && quality.wordCount > 10) persistentDelta -= 2;
    if (
      !quality.hasOutcome &&
      !quality.hasMetrics &&
      quality.wordCount > 22 &&
      !/weakness|strength|background|tell me about yourself/i.test(
        input.currentQuestion || "",
      )
    )
      persistentDelta -= 2;
    if (quality.vague && quality.wordCount > 25) persistentDelta -= 1;
    if (quality.hasOwnership && quality.hasOutcome) persistentDelta += 1;
    if (quality.roleBridge && quality.hasOutcome) persistentDelta += 1;
  }
  if (
    ["contradiction", "possible_exaggeration", "nonsense"].includes(
      decision.intent,
    )
  )
    persistentDelta -= 3;
  persistentDelta = clamp(persistentDelta, -12, 12);

  const nextTrust = clamp(
    previousTrust +
      persistentDelta -
      Math.round(openDoubtPenalty * 0.35) +
      Math.round(strongPatternBoost * 0.25),
    12,
    92,
  );
  const nextSkepticism = clamp(
    decision.psychology.skepticism +
      openDoubtPenalty +
      weakPatternPenalty -
      strongPatternBoost +
      (persistentDelta < 0 ? 8 : persistentDelta > 3 ? -5 : 0),
    8,
    94,
  );
  const nextPatience = clamp(
    decision.psychology.patience -
      openDoubtPenalty * 0.6 -
      (quality.vague ? 6 : 0) +
      (persistentDelta > 3 ? 5 : 0),
    16,
    96,
  );
  const nextInterest = clamp(
    decision.psychology.interest +
      (quality.roleBridge ? 5 : 0) +
      (quality.hasOutcome ? 4 : 0) -
      (decision.intent === "offtopic" ? 10 : 0),
    15,
    96,
  );

  const nextState: UnifiedRecruiterDecision["recruiterState"] =
    nextTrust < 35
      ? "losing_confidence"
      : nextSkepticism > 74 || persistentDelta <= -6
        ? "skeptical"
        : nextPatience < 38 || (nextSkepticism > 64 && quality.vague)
          ? "pressuring"
          : persistentDelta >= 5 && previousTrust < 62
            ? "recovering_trust"
            : nextInterest > 70 || persistentDelta > 2
              ? "engaged"
              : decision.recruiterState;

  const psychology: UnifiedRecruiterPsychology = {
    trust: nextTrust,
    interest: nextInterest,
    skepticism: nextSkepticism,
    patience: nextPatience,
    engagement: clamp(
      nextInterest +
        (quality.hasOutcome ? 4 : 0) -
        (nextSkepticism > 78 ? 8 : 0),
      16,
      96,
    ),
    confidenceInCandidate: clamp(
      nextTrust +
        (quality.hasOwnership ? 3 : 0) +
        (quality.hasOutcome ? 3 : 0) -
        (nextSkepticism > 78 ? 8 : 0),
      12,
      94,
    ),
  };

  const pressure = deriveLivePressure(psychology, nextState, decision.intent);
  const livePressureSimulation = deriveLivePressureSimulation(
    psychology,
    nextState,
    decision.intent,
    pressure,
  );
  const recruiterMemoryInsight = deriveRecruiterMemoryInsight(memory, {
    intent: decision.intent,
    recruiterState: nextState,
    trustDelta: persistentDelta,
    shouldCountAsAnswer: decision.shouldCountAsAnswer,
    concern: decision.concern,
    correction: decision.correction,
  });
  const honestFeedback = deriveHonestFeedback({
    ...decision,
    trustDelta: persistentDelta,
    recruiterState: nextState,
    psychology,
    pressure,
  });
  const moodLine = derivePersistentMoodLine(psychology, nextState);

  const shouldAddSkepticalMemory =
    decision.shouldCountAsAnswer &&
    (persistentDelta < 0 || nextSkepticism > 72);
  const memoryEvents = uniqueMemoryEvents([
    ...(decision.memoryEvents || []),
    ...(shouldAddSkepticalMemory
      ? [
          {
            type: "doubt" as const,
            text: moodLine,
            weight: nextSkepticism > 76 ? 8 : 5,
          },
        ]
      : []),
  ]);

  return applyBehavioralRealismLayer(input, {
    ...decision,
    trustDelta: persistentDelta,
    recruiterState: nextState,
    psychology,
    pressure,
    livePressureSimulation,
    recruiterMemoryInsight,
    honestFeedback,
    memoryEvents,
    feedback: decision.feedback ? `${decision.feedback} ${moodLine}` : moodLine,
  });
}

// ============================================================
// SECTION: Public entry point
// ============================================================

export async function decideUnifiedRecruiterResponse(
  input: UnifiedRecruiterInput,
): Promise<UnifiedRecruiterDecision> {
  input = recoverUnifiedRecruiterInput(input);
  const fallback = buildFallbackDecision(input);

  // Phase 1.5 v73: handle multi-intent rapport BEFORE the LLM or fallback analysis.
  // This prevents turns like "can you hear me and what is your name?" from being
  // misclassified as weak interview answers and triggering impact/STAR follow-ups.
  if (isMostlyMultiIntentRapport(input.answer)) {
    const targetRole = firstNonEmpty(
      input.setup?.targetRole,
      extractRoleFromJobDescription(cleanText(input.setup?.jobDescription)),
      "this role",
    );
    const psychology: UnifiedRecruiterPsychology = {
      ...fallback.psychology,
      patience: clamp((fallback.psychology?.patience ?? 68) + 4, 20, 95),
      engagement: clamp((fallback.psychology?.engagement ?? 62) + 2, 20, 95),
      skepticism: clamp((fallback.psychology?.skepticism ?? 28) - 4, 8, 94),
    };
    const pressure = deriveLivePressure(psychology, "interested", "smalltalk");
    const rapportDecision: UnifiedRecruiterDecision = {
      ...fallback,
      intent: "smalltalk",
      spokenReply: buildMultiIntentRapportReply(input, targetRole),
      displayQuestion: `Tell me a little about yourself and connect your recent experience to ${targetRole}.`,
      shouldAdvanceQuestion: false,
      shouldCountAsAnswer: false,
      shouldStayOnCurrentQuestion: true,
      trustDelta: 0,
      recruiterState: "interested",
      feedback: "Handled multi-intent rapport turn before interview scoring.",
      correction: "",
      concern: "",
      psychology,
      pressure,
      honestFeedback: deriveHonestFeedback({
        ...fallback,
        intent: "smalltalk",
        shouldCountAsAnswer: false,
        trustDelta: 0,
        recruiterState: "interested",
        feedback: "Handled multi-intent rapport turn before interview scoring.",
        correction: "",
        concern: "",
        psychology,
        pressure,
      }),
      livePressureSimulation: deriveLivePressureSimulation(
        psychology,
        "interested",
        "smalltalk",
        pressure,
      ),
      recruiterMemoryInsight: deriveRecruiterMemoryInsight(
        fallback.recruiterMemory ||
          buildRecruiterMemoryProfile(
            input.transcript,
            fallback.cvRead ||
              buildEvidenceProfile(
                cleanText(input.setup?.cvText),
                cleanText(input.setup?.jobDescription),
                input.setup?.resumeProfile,
              ),
            input.setup?.recruiterMemoryProfile,
          ),
        fallback,
      ),
      conversationStage: "rapport",
      cinematicRealism: {
        emotionalBeat: fallback.cinematicRealism?.emotionalBeat ?? "warming",
        pauseBeforeSpeakingMs:
          fallback.cinematicRealism?.pauseBeforeSpeakingMs ?? 480,
        recruiterMicroBehavior:
          fallback.cinematicRealism?.recruiterMicroBehavior ??
          "Recruiter acknowledges the setup question and continues naturally.",
        naturalTransition:
          fallback.cinematicRealism?.naturalTransition ??
          "Let’s start naturally.",
        shouldUseSilence: fallback.cinematicRealism?.shouldUseSilence ?? false,
        shouldSoften: fallback.cinematicRealism?.shouldSoften ?? true,
        shouldNarrowCandidate:
          fallback.cinematicRealism?.shouldNarrowCandidate ?? false,
      },
    };
    return rapportDecision;
  }
  const cvRead =
    fallback.cvRead ||
    buildEvidenceProfile(
      cleanText(input.setup?.cvText),
      cleanText(input.setup?.jobDescription),
      input.setup?.resumeProfile,
    );
  const recruiterMemory =
    fallback.recruiterMemory ||
    buildRecruiterMemoryProfile(
      input.transcript,
      cvRead,
      input.setup?.recruiterMemoryProfile,
    );

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[unifiedRecruiterIntelligence] OPENAI_API_KEY is not set in this environment — every turn will use the deterministic fallback engine, not GPT-4o.");
    return applyPhase15TrustPressure(
      input,
      applyNaturalConversationGuard(input, {
        ...fallback,
        pressure: deriveLivePressure(
          fallback.psychology,
          fallback.recruiterState,
          fallback.intent,
        ),
        honestFeedback: deriveHonestFeedback(fallback),
        recruiterMemoryInsight: deriveRecruiterMemoryInsight(
          recruiterMemory,
          fallback,
        ),
        livePressureSimulation: deriveLivePressureSimulation(
          fallback.psychology,
          fallback.recruiterState,
          fallback.intent,
          deriveLivePressure(
            fallback.psychology,
            fallback.recruiterState,
            fallback.intent,
          ),
        ),
        marketExpectation:
          fallback.marketExpectation || deriveMarketExpectation(input),
        humanImperfection:
          fallback.humanImperfection ||
          deriveHumanImperfection(input, fallback, recruiterMemory),
        socialSignals:
          fallback.socialSignals ||
          deriveSocialSignals(input.answer, fallback, recruiterMemory),
        cinematicRealism:
          fallback.cinematicRealism ||
          deriveCinematicRealism(
            input,
            fallback,
            fallback.socialSignals ||
              deriveSocialSignals(input.answer, fallback, recruiterMemory),
            deriveLivePressure(
              fallback.psychology,
              fallback.recruiterState,
              fallback.intent,
            ),
          ),
      }),
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const llmStartedAt = Date.now();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o",
      temperature: 0.62,
      // Was 1100, then 700 — the JSON payload is spokenReply (1-3 sentences)
      // plus a handful of small fields. 500 is still comfortable headroom and
      // reduces worst-case generation time. Raise back up only if replies
      // start getting cut off mid-JSON.
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(input, cvRead, recruiterMemory),
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              candidateMessage: cleanText(input.answer),
              currentQuestion: cleanText(input.currentQuestion),
              currentTrust: input.recruiterTrust,
              recentTranscript: (input.transcript || []).slice(-10),
              recruiterMemory,
            },
            null,
            2,
          ),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    console.log(`[unifiedRecruiterIntelligence] OpenAI call took ${Date.now() - llmStartedAt}ms`);
    const parsed = JSON.parse(raw) as Partial<UnifiedRecruiterDecision>;
    const normalized = normalizeDecision(parsed, fallback, input);
    const updated = updateMemoryAfterDecision(
      cleanText(input.answer),
      normalized,
      recruiterMemory,
    );
    const finalPressure =
      normalized.pressure ||
      deriveLivePressure(
        normalized.psychology,
        normalized.recruiterState,
        normalized.intent,
      );
    return applyPhase15TrustPressure(
      input,
      applyNaturalConversationGuard(input, {
        ...normalized,
        recruiterMemory: updated.memory,
        memoryEvents: uniqueMemoryEvents([
          ...(normalized.memoryEvents || []),
          ...updated.events,
        ]),
        recruiterMemoryInsight:
          normalized.recruiterMemoryInsight ||
          deriveRecruiterMemoryInsight(updated.memory, normalized),
        livePressureSimulation:
          normalized.livePressureSimulation ||
          deriveLivePressureSimulation(
            normalized.psychology,
            normalized.recruiterState,
            normalized.intent,
            finalPressure,
          ),
        marketExpectation:
          normalized.marketExpectation || deriveMarketExpectation(input),
        humanImperfection:
          normalized.humanImperfection ||
          deriveHumanImperfection(input, normalized, updated.memory),
        socialSignals:
          normalized.socialSignals ||
          deriveSocialSignals(input.answer, normalized, updated.memory),
        cinematicRealism:
          normalized.cinematicRealism ||
          deriveCinematicRealism(
            input,
            normalized,
            normalized.socialSignals ||
              deriveSocialSignals(input.answer, normalized, updated.memory),
            finalPressure,
          ),
      }),
    );
  } catch (error) {
    console.error(
      "[unifiedRecruiterIntelligence] OpenAI call failed — falling back to heuristic decision.",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return applyPhase15TrustPressure(
      input,
      applyNaturalConversationGuard(input, fallback),
    );
  }
}
