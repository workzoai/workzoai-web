export type PhaseAInput = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyName?: string;
  companyStyle?: string;
};

export type PhaseARequirement = {
  label: string;
  status: "matched" | "partial" | "missing";
  reason: string;
};

export type PhaseAQuestion = {
  question: string;
  why: string;
  risk: "low" | "medium" | "high";
};

export type PhaseAObjection = {
  title: string;
  detail: string;
  fix: string;
  severity: "low" | "medium" | "high";
};

export type PhaseAInsights = {
  readinessScore: number;
  hiringRecommendation: "Strong proceed" | "Proceed" | "Borderline" | "Needs preparation";
  recruiterScan: {
    decision: "Strong profile" | "May proceed" | "Needs proof" | "High risk";
    strengths: string[];
    concerns: string[];
    firstImpression: string;
  };
  missingRequirements: PhaseARequirement[];
  recruiterQuestions: PhaseAQuestion[];
  objections: PhaseAObjection[];
  nextBestActions: string[];
  interviewProbability: {
    current: number;
    afterCvFix: number;
    afterInterviewPrep: number;
  };
};

function clean(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim() || fallback;
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function words(value: string) {
  return clean(value).split(/\s+/).filter(Boolean);
}

function containsAny(text: string, patterns: string[]) {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

function unique(values: string[], limit = 6) {
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

const SKILL_GROUPS = [
  { label: "SQL", terms: ["sql", "mysql", "postgres", "database", "query"] },
  { label: "Python", terms: ["python", "pandas", "numpy", "scikit", "sklearn"] },
  { label: "Power BI", terms: ["power bi", "powerbi", "dashboard", "reporting"] },
  { label: "Tableau", terms: ["tableau", "visualization", "visualisation"] },
  { label: "Excel", terms: ["excel", "spreadsheet", "pivot"] },
  { label: "Customer support", terms: ["customer", "client", "support", "ticket", "incident", "escalation"] },
  { label: "SaaS", terms: ["saas", "cloud", "subscription", "b2b"] },
  { label: "Stakeholder communication", terms: ["stakeholder", "cross-functional", "communication", "presentation"] },
  { label: "Project ownership", terms: ["led", "owned", "managed", "coordinated", "delivered"] },
  { label: "German", terms: ["german", "deutsch", "b1", "b2", "c1"] },
  { label: "English", terms: ["english", "fluent", "c1", "c2"] },
];

function extractRequirementLabels(jobDescription: string, targetRole: string) {
  const jd = clean(`${targetRole} ${jobDescription}`).toLowerCase();
  const direct = SKILL_GROUPS.filter((group) => containsAny(jd, group.terms)).map((group) => group.label);

  const bullets = clean(jobDescription)
    .split(/(?:\.|\n|;|•|- )/g)
    .map((item) => clean(item))
    .filter((item) => item.length > 8 && item.length < 90)
    .filter((item) => /experience|knowledge|skill|required|preferred|must|should|responsible|develop|support|analy|manage|communicat|customer|data|report|sql|python|excel|power bi|tableau|german|english/i.test(item))
    .slice(0, 8);

  return unique([...direct, ...bullets], 10);
}

function scoreRequirement(requirement: string, cvText: string): PhaseARequirement {
  const cv = cvText.toLowerCase();
  const req = requirement.toLowerCase();
  const group = SKILL_GROUPS.find((item) => item.label.toLowerCase() === req || item.terms.some((term) => req.includes(term)));
  const terms = group?.terms || words(req).filter((word) => word.length > 3);
  const matches = terms.filter((term) => cv.includes(term.toLowerCase())).length;

  if (matches >= Math.min(2, terms.length) || cv.includes(req)) {
    return { label: requirement, status: "matched", reason: "Detected in the CV context." };
  }

  if (matches === 1) {
    return { label: requirement, status: "partial", reason: "Related signal exists, but it should be made clearer." };
  }

  return { label: requirement, status: "missing", reason: "Not clearly visible in the current CV context." };
}

function hasMetric(text: string) {
  return /\b\d+(?:\.\d+)?\s*(%|percent|users?|customers?|tickets?|cases?|incidents?|hours?|days?|weeks?|months?|years?|people|team|revenue|€|\$|kpis?|reports?|calls?|leads?|projects?)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i|my|owned|led|managed|built|created|implemented|coordinated|resolved|improved|reduced|handled|delivered|designed|developed|trained|analyzed|analysed|presented)\b/i.test(text);
}

function detectCompanyStyle(companyName: string, companyStyle: string, targetRole: string) {
  const source = `${companyName} ${companyStyle} ${targetRole}`.toLowerCase();
  if (/amazon|aws/.test(source)) return "Amazon-style ownership, customer obsession, dive deep, and bias for action";
  if (/google|meta|microsoft|apple|software|developer|engineer|data|analyst/.test(source)) return "technical depth, structured problem solving, collaboration, and measurable delivery";
  if (/mckinsey|bcg|bain|consult/.test(source)) return "MECE structure, executive clarity, business impact, and hypothesis thinking";
  if (/bank|finance|compliance|insurance|regulated/.test(source)) return "risk awareness, accuracy, process discipline, and stakeholder trust";
  if (/startup|founder|early/.test(source)) return "ownership, speed, ambiguity handling, and bias for action";
  return "fit, proof, consistency, motivation, and communication maturity";
}

export function buildPhaseAInsights(input: PhaseAInput): PhaseAInsights {
  const cvText = clean(input.cvText, "");
  const jobDescription = clean(input.jobDescription, "");
  const targetRole = clean(input.targetRole, "Target role");
  const targetMarket = clean(input.targetMarket, "Global");
  const companyName = clean(input.companyName, "");
  const companyStyle = clean(input.companyStyle, "");
  const combined = `${cvText} ${jobDescription} ${targetRole}`;

  const cvWordCount = words(cvText).length;
  const jdWordCount = words(jobDescription).length;
  const metric = hasMetric(cvText);
  const ownership = hasOwnership(cvText);
  const roleTerms = targetRole.toLowerCase().split(/[^a-z0-9+#.]+/i).filter((word) => word.length > 2);
  const roleMatchCount = roleTerms.filter((word) => cvText.toLowerCase().includes(word)).length;
  const roleFit = roleTerms.length ? roleMatchCount / roleTerms.length : 0.45;

  const requirementLabels = extractRequirementLabels(jobDescription, targetRole);
  const requirements = (requirementLabels.length ? requirementLabels : [targetRole, "Communication", "Evidence of impact", "Role-specific examples"])
    .map((item) => scoreRequirement(item, cvText))
    .slice(0, 8);

  const matched = requirements.filter((item) => item.status === "matched").length;
  const partial = requirements.filter((item) => item.status === "partial").length;
  const missing = requirements.filter((item) => item.status === "missing").length;

  const readinessScore = clamp(
    38 +
      Math.min(18, cvWordCount / 45) +
      Math.min(12, jdWordCount / 65) +
      matched * 6 +
      partial * 3 -
      missing * 5 +
      (metric ? 10 : -6) +
      (ownership ? 9 : -5) +
      roleFit * 12,
  );

  const probabilityCurrent = clamp(readinessScore - 10 + (metric ? 4 : -4) + (ownership ? 4 : -3));
  const probabilityCv = clamp(probabilityCurrent + (missing ? 12 : 6) + (metric ? 2 : 8));
  const probabilityPrep = clamp(probabilityCv + 8 + (ownership ? 2 : 5));

  const strengths = unique([
    cvWordCount > 220 ? "CV has enough context for recruiter-style preparation." : "CV context is present, but can be strengthened.",
    roleFit >= 0.4 ? `Visible fit for ${targetRole}.` : "Some transferable background is visible.",
    matched > 0 ? `${matched} job requirement signal${matched === 1 ? "" : "s"} already matched.` : "The role direction is defined.",
    metric ? "Measurable impact appears in the profile." : "There is room to add measurable impact.",
    ownership ? "Personal ownership signals are visible." : "Ownership can be made clearer.",
  ], 4);

  const concerns = unique([
    !metric ? "Measurable outcomes are not visible enough." : "Keep the strongest metrics prominent.",
    !ownership ? "Personal contribution may not be obvious to a recruiter." : "Ownership is present; keep it specific.",
    missing > 0 ? `${missing} requirement signal${missing === 1 ? " is" : "s are"} missing or unclear.` : "No major requirement gaps detected from the pasted JD.",
    jdWordCount < 40 ? "Paste a fuller job description for a sharper job-specific analysis." : "Job context is usable.",
  ], 4);

  const decision: PhaseAInsights["recruiterScan"]["decision"] = readinessScore >= 82
    ? "Strong profile"
    : readinessScore >= 68
      ? "May proceed"
      : readinessScore >= 52
        ? "Needs proof"
        : "High risk";

  const companyExpectation = detectCompanyStyle(companyName, companyStyle, targetRole);
  const topMissing = requirements.filter((item) => item.status !== "matched").slice(0, 3);

  const recruiterQuestions = unique([
    `Walk me through your most relevant experience for this ${targetRole} role.`,
    !metric ? "Can you quantify the impact of your strongest example?" : "Which metric best proves your impact in this role?",
    !ownership ? "What exactly did you personally own in that project or responsibility?" : "Where did you take ownership beyond your assigned tasks?",
    topMissing[0] ? `The role seems to need ${topMissing[0].label}. Where have you used this or something similar?` : "What is one example that proves you can succeed in this role?",
    companyName ? `Why ${companyName}, and how does your background match their expectations?` : `How would you adapt your experience to a ${targetMarket} hiring context?`,
    `Give me a STAR example that shows ${companyExpectation}.`,
  ], 6).map((question, index) => ({
    question,
    why: index === 0
      ? "Recruiters usually start by testing role fit and clarity."
      : question.toLowerCase().includes("quant")
        ? "Missing metrics are one of the fastest ways to lose recruiter confidence."
        : question.toLowerCase().includes("personally") || question.toLowerCase().includes("ownership")
          ? "Hiring managers want to separate team impact from your own contribution."
          : "This is likely because of the CV + JD gap analysis.",
    risk: index <= 1 && (!metric || !ownership) ? "high" : index <= 3 ? "medium" : "low",
  }));

  const objections: PhaseAObjection[] = [
    !metric && {
      title: "Impact proof may feel weak",
      detail: "The recruiter may understand what you did, but not how much it mattered.",
      fix: "Add one number: volume, time saved, quality improvement, customer impact, revenue, cost, or SLA.",
      severity: "high" as const,
    },
    !ownership && {
      title: "Ownership may be unclear",
      detail: "The CV or answer may sound like team activity instead of personal contribution.",
      fix: "Start one bullet or answer with: I owned, I led, I resolved, I built, or I improved.",
      severity: "high" as const,
    },
    missing > 0 && {
      title: "Requirement gap",
      detail: `${missing} job requirement signal${missing === 1 ? " is" : "s are"} missing or unclear in the current profile.`,
      fix: "Either add truthful evidence to the CV or prepare a short explanation for the interview.",
      severity: "medium" as const,
    },
    jdWordCount < 40 && {
      title: "Job context too thin",
      detail: "The analysis may be less accurate because the job description is short or missing.",
      fix: "Paste the full job description before generating final CV, letter, or interview prep.",
      severity: "medium" as const,
    },
  ].filter(Boolean) as PhaseAObjection[];

  const hiringRecommendation: PhaseAInsights["hiringRecommendation"] = readinessScore >= 84
    ? "Strong proceed"
    : readinessScore >= 70
      ? "Proceed"
      : readinessScore >= 55
        ? "Borderline"
        : "Needs preparation";

  return {
    readinessScore,
    hiringRecommendation,
    recruiterScan: {
      decision,
      strengths,
      concerns,
      firstImpression: `${decision}: the recruiter will mainly look for ${companyExpectation}. ${concerns[0] || "Make sure every claim has proof."}`,
    },
    missingRequirements: requirements,
    recruiterQuestions: recruiterQuestions as PhaseAQuestion[],
    objections: objections.length ? objections : [{
      title: "No major application objection detected",
      detail: "The profile has enough signal for a first preparation pass.",
      fix: "Still prepare one metric-backed story and one ownership story before applying.",
      severity: "low",
    }],
    nextBestActions: unique([
      !metric ? "Add one measurable outcome to the strongest CV bullet." : "Keep your strongest measurable result near the top.",
      !ownership ? "Rewrite one bullet to make personal ownership unmistakable." : "Prepare to explain your exact personal contribution.",
      missing > 0 ? `Address the top missing requirement: ${topMissing[0]?.label || "role evidence"}.` : "Use the matched requirements as interview story anchors.",
      "Practice the forecast recruiter questions before applying.",
    ], 4),
    interviewProbability: {
      current: probabilityCurrent,
      afterCvFix: probabilityCv,
      afterInterviewPrep: probabilityPrep,
    },
  };
}
