export type PhaseBInput = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyName?: string;
  companyStyle?: string;
  coverLetterText?: string;
};

export type CompanyDnaDimension = {
  label: string;
  score: number;
  target: number;
  note: string;
};

export type EvidenceItem = {
  text: string;
  score: number;
  ownership: boolean;
  metric: boolean;
  result: boolean;
  relevance: boolean;
  recruiterHeard: string;
  top10Rewrite: string;
};

export type TrustAuditItem = {
  label: string;
  score: number;
  delta: number;
  reason: string;
};

export type LetterHook = {
  style: "Professional" | "Confident" | "Story-driven" | "Executive";
  text: string;
};

export type MatchMatrixItem = {
  requirement: string;
  candidateEvidence: string;
  strength: "Strong" | "Partial" | "Weak";
};

export type PhaseBInsights = {
  companyDNA: {
    companyType: string;
    label: string;
    description: string;
    dimensions: CompanyDnaDimension[];
    interviewStyle: string;
    cvOptimizationRule: string;
    coverLetterRule: string;
  };
  trustAudit: {
    overall: number;
    verdict: "High trust" | "Good trust" | "Trust at risk" | "Needs proof";
    dimensions: TrustAuditItem[];
    deductions: Array<{ label: string; delta: number; reason: string }>;
    recoveryActions: string[];
  };
  evidenceEngine: {
    overall: number;
    summary: string;
    items: EvidenceItem[];
  };
  top10Rewrite: {
    weakestLine: string;
    improvedLine: string;
    eliteLine: string;
    rule: string;
  };
  coverLetter: {
    hooks: LetterHook[];
    riskScore: number;
    riskFlags: string[];
    readability: {
      estimatedReadingSeconds: number;
      verdict: "Skimmable" | "Too long" | "Needs substance";
      note: string;
    };
    matchMatrix: MatchMatrixItem[];
  };
  consistency: {
    status: "Aligned" | "Needs alignment" | "Risky";
    notes: string[];
    crossFeatureActions: string[];
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

function words(text: string) {
  return clean(text).split(/\s+/).filter(Boolean);
}

function unique(values: string[], limit = 8) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const item = clean(raw);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function hasMetric(text: string) {
  return /\b\d+(?:\.\d+)?\s*(%|percent|users?|customers?|tickets?|cases?|incidents?|hours?|days?|weeks?|months?|years?|people|team|revenue|€|\$|kpis?|reports?|calls?|leads?|projects?|x)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i|my|me|owned|led|managed|built|created|implemented|coordinated|resolved|improved|reduced|handled|delivered|designed|developed|trained|analyzed|analysed|presented|automated)\b/i.test(text);
}

function hasResult(text: string) {
  return /\b(result|impact|outcome|improved|reduced|increased|saved|resolved|delivered|achieved|therefore|as a result|which led|customer satisfaction|sla|csat|nps)\b/i.test(text) || hasMetric(text);
}

function hasRelevance(text: string, targetRole: string, jobDescription: string) {
  const source = `${targetRole} ${jobDescription}`.toLowerCase();
  const tokens = unique(source.split(/[^a-z0-9+#.]+/i).filter((w) => w.length > 3), 20);
  const line = text.toLowerCase();
  return tokens.some((token) => line.includes(token)) || /\b(customer|client|support|data|analysis|report|dashboard|sales|project|stakeholder|technical|product|operations|quality|delivery)\b/i.test(text);
}

function extractLines(cvText: string) {
  const normalized = clean(cvText)
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .replace(/[•●▪◦]/g, "\n")
    .replace(/\s+-\s+/g, "\n");

  return normalized
    .split(/\n|;/)
    .map((line) => clean(line).replace(/^[-*]\s*/, ""))
    .filter((line) => line.length >= 22 && line.length <= 220)
    .filter((line) => /\b(led|managed|built|created|implemented|resolved|improved|reduced|handled|delivered|designed|developed|trained|analyzed|analysed|automated|supported|coordinated|customer|client|project|dashboard|report|process|system|ticket|issue)\b/i.test(line))
    .slice(0, 10);
}

function extractRequirements(jobDescription: string, targetRole: string) {
  const dictionary = [
    "SQL", "Python", "Excel", "Power BI", "Tableau", "Dashboarding", "Reporting",
    "Customer support", "Stakeholder communication", "Project ownership", "SaaS",
    "Technical troubleshooting", "Data analysis", "Leadership", "German", "English",
    "Agile", "CRM", "API", "Cloud", "Documentation", "Process improvement",
  ];

  const source = `${targetRole} ${jobDescription}`.toLowerCase();
  const direct = dictionary.filter((item) => source.includes(item.toLowerCase()));

  const jdPhrases = clean(jobDescription)
    .split(/\.|\n|;|•|-/)
    .map((item) => clean(item))
    .filter((item) => item.length > 10 && item.length < 95)
    .filter((item) => /required|preferred|experience|knowledge|responsible|skill|support|manage|analy|communicat|develop|build|customer|stakeholder|report|dashboard|sql|python|excel/i.test(item))
    .slice(0, 8);

  return unique([...direct, ...jdPhrases, targetRole], 10);
}

function companyKind(companyName: string, companyStyle: string, targetRole: string) {
  const source = `${companyName} ${companyStyle} ${targetRole}`.toLowerCase();
  if (/amazon|aws/.test(source)) return "amazon";
  if (/google|alphabet/.test(source)) return "google";
  if (/meta|facebook|instagram|whatsapp/.test(source)) return "meta";
  if (/microsoft|azure|linkedin/.test(source)) return "microsoft";
  if (/mckinsey|bcg|bain|consult/.test(source)) return "consulting";
  if (/sap|oracle|servicenow|salesforce|enterprise/.test(source)) return "enterprise";
  if (/bank|finance|insurance|compliance|regulated/.test(source)) return "regulated";
  if (/startup|founder|early|scaleup/.test(source)) return "startup";
  if (/software|engineer|developer|data|analyst|product/.test(source)) return "technical";
  return "general";
}

function buildCompanyDNA(input: PhaseBInput, evidenceAverage: number, trustAverage: number): PhaseBInsights["companyDNA"] {
  const kind = companyKind(clean(input.companyName), clean(input.companyStyle), clean(input.targetRole));
  const map: Record<string, PhaseBInsights["companyDNA"]> = {
    amazon: {
      companyType: "Amazon-style",
      label: "Amazon Bar Raiser Alignment",
      description: "Optimized for ownership, customer obsession, dive-deep evidence, and bias for action.",
      interviewStyle: "Direct, evidence-heavy, and follow-up intense.",
      cvOptimizationRule: "Move customer impact, ownership verbs, and measurable results to the top.",
      coverLetterRule: "Lead with customer impact and a concrete ownership story.",
      dimensions: [
        { label: "Customer Obsession", score: clamp(evidenceAverage + 6), target: 90, note: "Show customer/user impact with proof." },
        { label: "Ownership", score: clamp(trustAverage + 4), target: 88, note: "Make personal scope unmistakable." },
        { label: "Dive Deep", score: evidenceAverage, target: 86, note: "Add root cause, scale, metrics, and trade-offs." },
        { label: "Bias for Action", score: clamp((evidenceAverage + trustAverage) / 2), target: 84, note: "Show speed, decisions, and delivery." },
      ],
    },
    google: {
      companyType: "Google-style",
      label: "Google Interview Alignment",
      description: "Optimized for structured problem solving, collaboration, technical clarity, and learning ability.",
      interviewStyle: "Calm but rigorous; expects structured reasoning and trade-offs.",
      cvOptimizationRule: "Highlight complexity, scale, collaboration, and technical depth.",
      coverLetterRule: "Lead with problem-solving and user/business impact.",
      dimensions: [
        { label: "Problem Solving", score: clamp(evidenceAverage + 4), target: 88, note: "Explain approach and trade-offs." },
        { label: "Collaboration", score: clamp(trustAverage + 2), target: 84, note: "Show cross-functional communication." },
        { label: "Technical Depth", score: evidenceAverage, target: 86, note: "Use tools, systems, complexity, and scale." },
        { label: "Learning Ability", score: clamp((evidenceAverage + trustAverage) / 2 + 3), target: 82, note: "Show adaptation and reflection." },
      ],
    },
    consulting: {
      companyType: "Consulting",
      label: "Consulting / MECE Alignment",
      description: "Optimized for executive clarity, MECE structure, business impact, and concise reasoning.",
      interviewStyle: "Structured, skeptical, and business-impact focused.",
      cvOptimizationRule: "Convert bullets into business outcomes and quantified improvements.",
      coverLetterRule: "Open with a concise business impact claim, not a generic motivation paragraph.",
      dimensions: [
        { label: "Structured Thinking", score: clamp(trustAverage + 5), target: 90, note: "Use clear situation, action, result logic." },
        { label: "Business Impact", score: evidenceAverage, target: 88, note: "Quantify cost, revenue, efficiency, or quality." },
        { label: "Executive Clarity", score: clamp(trustAverage), target: 86, note: "Lead with the conclusion." },
        { label: "Hypothesis Mindset", score: clamp((evidenceAverage + trustAverage) / 2 - 2), target: 82, note: "Explain why your approach was chosen." },
      ],
    },
    startup: {
      companyType: "Startup",
      label: "Startup Readiness Alignment",
      description: "Optimized for ownership, speed, ambiguity, resourcefulness, and measurable progress.",
      interviewStyle: "Fast, practical, and ownership-heavy.",
      cvOptimizationRule: "Show what you built, shipped, fixed, or improved with limited resources.",
      coverLetterRule: "Lead with why you can create impact quickly.",
      dimensions: [
        { label: "Ownership", score: clamp(trustAverage + 6), target: 88, note: "Show you can own messy problems." },
        { label: "Speed", score: clamp(evidenceAverage + 2), target: 84, note: "Show delivery under constraints." },
        { label: "Ambiguity Handling", score: clamp((evidenceAverage + trustAverage) / 2), target: 82, note: "Explain how you decide without perfect information." },
        { label: "Impact", score: evidenceAverage, target: 86, note: "Use measurable outcomes." },
      ],
    },
    enterprise: {
      companyType: "Enterprise SaaS",
      label: "Enterprise SaaS Alignment",
      description: "Optimized for reliability, stakeholder trust, process maturity, and customer/business impact.",
      interviewStyle: "Professional, evidence-based, and process-aware.",
      cvOptimizationRule: "Show systems, stakeholders, scale, documentation, and operational reliability.",
      coverLetterRule: "Lead with enterprise/customer impact and process maturity.",
      dimensions: [
        { label: "Stakeholder Trust", score: clamp(trustAverage + 4), target: 86, note: "Show communication and reliability." },
        { label: "Process Maturity", score: clamp(evidenceAverage + 2), target: 84, note: "Show repeatable methods and documentation." },
        { label: "Customer Impact", score: evidenceAverage, target: 86, note: "Quantify user/customer outcomes." },
        { label: "Consistency", score: trustAverage, target: 84, note: "Keep claims aligned across CV and interview." },
      ],
    },
    regulated: {
      companyType: "Regulated / Compliance-heavy",
      label: "Regulated Industry Alignment",
      description: "Optimized for accuracy, risk awareness, documentation, and responsible communication.",
      interviewStyle: "Careful, structured, and risk-sensitive.",
      cvOptimizationRule: "Highlight accuracy, documentation, compliance, and escalation judgment.",
      coverLetterRule: "Lead with reliability and responsible decision-making.",
      dimensions: [
        { label: "Accuracy", score: trustAverage, target: 88, note: "Avoid vague claims and unsupported metrics." },
        { label: "Risk Awareness", score: clamp(trustAverage + 2), target: 86, note: "Show escalation and judgment." },
        { label: "Documentation", score: clamp(evidenceAverage), target: 84, note: "Mention process and audit-friendly work." },
        { label: "Professionalism", score: clamp((trustAverage + evidenceAverage) / 2 + 3), target: 86, note: "Keep tone precise." },
      ],
    },
    technical: {
      companyType: "Technical",
      label: "Technical Role Alignment",
      description: "Optimized for tools, systems, scale, trade-offs, ownership, and measurable delivery.",
      interviewStyle: "Deep-dive technical follow-ups with proof requests.",
      cvOptimizationRule: "Make tools, architecture, data, scale, and measurable outcomes visible.",
      coverLetterRule: "Lead with the technical/business problem you can solve.",
      dimensions: [
        { label: "Technical Evidence", score: evidenceAverage, target: 88, note: "Use concrete tools and complexity." },
        { label: "Ownership", score: trustAverage, target: 84, note: "Show what you personally built or fixed." },
        { label: "Impact", score: clamp(evidenceAverage + 2), target: 86, note: "Quantify reliability, speed, cost, quality, or users." },
        { label: "Communication", score: clamp(trustAverage + 3), target: 82, note: "Explain trade-offs clearly." },
      ],
    },
    general: {
      companyType: "General",
      label: "Professional Recruiter Alignment",
      description: "Optimized for fit, consistency, proof, motivation, and communication maturity.",
      interviewStyle: "Balanced recruiter screening with evidence-focused follow-ups.",
      cvOptimizationRule: "Make role fit, ownership, metrics, and outcomes easy to scan.",
      coverLetterRule: "Lead with one role-relevant proof point.",
      dimensions: [
        { label: "Role Fit", score: clamp((evidenceAverage + trustAverage) / 2), target: 84, note: "Connect experience to the target role." },
        { label: "Evidence", score: evidenceAverage, target: 84, note: "Add proof and measurable outcomes." },
        { label: "Ownership", score: trustAverage, target: 82, note: "Clarify personal contribution." },
        { label: "Communication", score: clamp(trustAverage + 2), target: 82, note: "Keep it concise and structured." },
      ],
    },
  };

  return map[kind] || map.general;
}

function buildEvidenceItems(input: PhaseBInput): EvidenceItem[] {
  const cvText = clean(input.cvText);
  const targetRole = clean(input.targetRole, "target role");
  const jobDescription = clean(input.jobDescription);
  const lines = extractLines(cvText);
  const sourceLines = lines.length ? lines : [
    "Add one role-relevant bullet with personal ownership, measurable impact, and a clear outcome.",
  ];

  return sourceLines.slice(0, 7).map((line) => {
    const ownership = hasOwnership(line);
    const metric = hasMetric(line);
    const result = hasResult(line);
    const relevance = hasRelevance(line, targetRole, jobDescription);
    const score = clamp(28 + (ownership ? 22 : 0) + (metric ? 26 : 0) + (result ? 18 : 0) + (relevance ? 12 : 0));

    let recruiterHeard = "Relevant experience is visible, but the recruiter needs clearer proof.";
    if (!ownership && !metric) recruiterHeard = "This sounds like a responsibility, not yet a proven achievement.";
    else if (!metric) recruiterHeard = "The work sounds useful, but the scale or impact is still unclear.";
    else if (!ownership) recruiterHeard = "The impact is interesting, but the recruiter may not know what you personally owned.";
    else if (!result) recruiterHeard = "The action is clear, but the final business or user outcome needs to be sharper.";
    else recruiterHeard = "This reads like credible, recruiter-ready evidence.";

    const base = line.replace(/\.$/, "");
    const top10Rewrite = metric && ownership && result
      ? `${base}. Keep this near the top because it already contains ownership, proof, and outcome.`
      : `Personally owned ${targetRole.toLowerCase()}-relevant work by improving a specific process or outcome; add the truthful metric, scale, or result to make this a top-10% bullet.`;

    return { text: line, score, ownership, metric, result, relevance, recruiterHeard, top10Rewrite };
  });
}

function buildTrustAudit(items: EvidenceItem[], cvText: string, jobDescription: string): PhaseBInsights["trustAudit"] {
  const avg = items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 45;
  const metricRate = items.filter((item) => item.metric).length / Math.max(items.length, 1);
  const ownershipRate = items.filter((item) => item.ownership).length / Math.max(items.length, 1);
  const resultRate = items.filter((item) => item.result).length / Math.max(items.length, 1);
  const relevanceRate = items.filter((item) => item.relevance).length / Math.max(items.length, 1);
  const hasJd = words(jobDescription).length > 25;
  const hasEnoughCv = words(cvText).length > 160;

  const dimensions: TrustAuditItem[] = [
    { label: "Evidence quality", score: clamp(avg), delta: metricRate >= 0.45 ? 6 : -12, reason: metricRate >= 0.45 ? "Enough quantified proof appears." : "Too few quantified outcomes are visible." },
    { label: "Ownership clarity", score: clamp(ownershipRate * 100), delta: ownershipRate >= 0.55 ? 5 : -10, reason: ownershipRate >= 0.55 ? "Personal contribution is visible." : "Several statements may sound team-owned." },
    { label: "Outcome clarity", score: clamp(resultRate * 100), delta: resultRate >= 0.5 ? 5 : -9, reason: resultRate >= 0.5 ? "Results are visible." : "More final outcomes are needed." },
    { label: "Role relevance", score: clamp(relevanceRate * 100), delta: relevanceRate >= 0.55 ? 6 : -8, reason: relevanceRate >= 0.55 ? "CV content connects to the role." : "Role fit should be made more explicit." },
    { label: "Context completeness", score: clamp((hasEnoughCv ? 55 : 25) + (hasJd ? 35 : 5)), delta: hasJd && hasEnoughCv ? 4 : -7, reason: hasJd && hasEnoughCv ? "CV and JD context are both usable." : "Add fuller CV/JD context for a sharper read." },
  ];

  const overall = clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const verdict = overall >= 82 ? "High trust" : overall >= 68 ? "Good trust" : overall >= 52 ? "Trust at risk" : "Needs proof";

  const deductions = dimensions
    .filter((item) => item.delta < 0)
    .map((item) => ({ label: item.label, delta: item.delta, reason: item.reason }))
    .slice(0, 4);

  return {
    overall,
    verdict,
    dimensions,
    deductions: deductions.length ? deductions : [{ label: "No major deduction", delta: 4, reason: "The profile has enough evidence for a strong preparation pass." }],
    recoveryActions: unique([
      metricRate < 0.45 ? "Add one measurable outcome to the strongest achievement." : "Keep the strongest metric visible in the top half of the CV.",
      ownershipRate < 0.55 ? "Rewrite at least one bullet starting with a personal ownership verb." : "Prepare a short story explaining your exact contribution.",
      resultRate < 0.5 ? "Add the final outcome after the action." : "Use the outcome as the closing sentence in interview answers.",
      relevanceRate < 0.55 ? "Mirror two truthful keywords from the JD." : "Use matched JD keywords as story anchors.",
    ], 4),
  };
}

function buildTop10Rewrite(items: EvidenceItem[], targetRole: string): PhaseBInsights["top10Rewrite"] {
  const weakest = [...items].sort((a, b) => a.score - b.score)[0];
  const weakestLine = weakest?.text || "No strong bullet detected yet.";
  const improvedLine = weakest
    ? `${weakest.text.replace(/\.$/, "")}; clarify your personal role, the method used, and the result.`
    : `Add one ${targetRole} achievement with ownership, method, and measurable result.`;

  const eliteLine = weakest && weakest.metric && weakest.ownership
    ? `${weakest.text.replace(/\.$/, "")}. Strengthen it further by adding the business reason and recruiter-relevant outcome.`
    : `Owned a ${targetRole.toLowerCase()}-relevant problem, applied the right tools/process, and delivered a measurable improvement; replace this with the truthful metric from your experience.`;

  return {
    weakestLine,
    improvedLine,
    eliteLine,
    rule: "Top candidates make every major claim pass four checks: ownership, metric, result, and role relevance.",
  };
}

function buildLetterHooks(input: PhaseBInput, strongestEvidence: EvidenceItem | undefined): LetterHook[] {
  const role = clean(input.targetRole, "this role");
  const company = clean(input.companyName, "your team");
  const proof = strongestEvidence?.text || "my background in customer-facing and technical problem solving";

  return [
    {
      style: "Professional",
      text: `I am applying for the ${role} role because my experience aligns with the practical problems ${company} needs solved, especially where clear communication, ownership, and measurable outcomes matter.`,
    },
    {
      style: "Confident",
      text: `What makes me a strong fit for the ${role} role is my ability to turn practical problems into clear outcomes, supported by evidence such as: ${proof}`,
    },
    {
      style: "Story-driven",
      text: `After working through real customer and technical challenges, I learned that strong outcomes come from understanding the problem, taking ownership, and communicating clearly, the same strengths I would bring to ${company}.`,
    },
    {
      style: "Executive",
      text: `For the ${role} position, I would bring a practical mix of execution, stakeholder communication, and outcome-focused problem solving, with a focus on creating measurable value quickly.`,
    },
  ];
}

function buildCoverLetterIntelligence(input: PhaseBInput, evidenceItems: EvidenceItem[]): PhaseBInsights["coverLetter"] {
  const letter = clean(input.coverLetterText);
  const wc = words(letter).length;
  const requirements = extractRequirements(clean(input.jobDescription), clean(input.targetRole));
  const cv = clean(input.cvText).toLowerCase();
  const strongest = [...evidenceItems].sort((a, b) => b.score - a.score)[0];

  const riskFlags = unique([
    !letter ? "No cover letter generated yet." : "",
    wc > 420 ? "Letter may be too long for a recruiter skim." : "",
    wc > 0 && wc < 120 ? "Letter may be too short to show match depth." : "",
    !hasMetric(letter) && !hasMetric(clean(input.cvText)) ? "No measurable outcome is visible." : "",
    /i am excited to apply|dear hiring manager/i.test(letter) ? "Opening may sound generic unless followed by specific proof." : "",
    !clean(input.jobDescription) ? "Job description missing, so company match is weaker." : "",
  ], 5);

  const matchMatrix = requirements.slice(0, 6).map((requirement) => {
    const req = requirement.toLowerCase();
    const tokens = req.split(/[^a-z0-9+#.]+/).filter((w) => w.length > 3);
    const hits = tokens.filter((token) => cv.includes(token)).length;
    const strength = hits >= 2 || cv.includes(req) ? "Strong" : hits === 1 ? "Partial" : "Weak";
    return {
      requirement,
      candidateEvidence: strength === "Strong" ? "Clear evidence appears in the CV context." : strength === "Partial" ? "Related evidence exists, but it should be stated more directly." : "Not clearly visible yet.",
      strength,
    } as MatchMatrixItem;
  });

  return {
    hooks: buildLetterHooks(input, strongest),
    riskScore: clamp(100 - riskFlags.length * 16 - (wc > 420 ? 12 : 0) + (hasMetric(letter) ? 8 : 0)),
    riskFlags: riskFlags.length ? riskFlags : ["No major cover letter risk detected. Keep the opening specific and proof-led."],
    readability: {
      estimatedReadingSeconds: wc ? clamp((wc / 220) * 60, 10, 180) : 0,
      verdict: !wc ? "Needs substance" : wc > 420 ? "Too long" : "Skimmable",
      note: !wc ? "Generate a draft to evaluate readability." : wc > 420 ? "Shorten to the strongest proof and role match." : "Length is acceptable for a recruiter skim.",
    },
    matchMatrix,
  };
}

function buildConsistency(input: PhaseBInput, trust: PhaseBInsights["trustAudit"], companyDNA: PhaseBInsights["companyDNA"]): PhaseBInsights["consistency"] {
  const cvText = clean(input.cvText);
  const jd = clean(input.jobDescription);
  const role = clean(input.targetRole);
  const hasRole = role && cvText.toLowerCase().includes(role.toLowerCase().split(/\s+/)[0] || "");
  const hasJd = words(jd).length > 25;
  const hasCompany = Boolean(clean(input.companyName) || clean(input.companyStyle));

  const notes = unique([
    hasRole ? "CV and target role have visible overlap." : "Target role is not strongly mirrored in the CV yet.",
    hasJd ? "JD context is strong enough for job-specific coaching." : "JD context is thin; paste the full job description for sharper outputs.",
    hasCompany ? `${companyDNA.label} is being used for company-style coaching.` : "Company DNA is using a general professional model until a company/style is provided.",
    trust.overall >= 68 ? "Trust audit is strong enough to generate interview prep." : "Trust audit suggests proof should be improved before applying.",
  ], 4);

  const status = trust.overall >= 72 && hasJd ? "Aligned" : trust.overall >= 55 ? "Needs alignment" : "Risky";

  return {
    status,
    notes,
    crossFeatureActions: unique([
      trust.overall < 68 ? "Improve CV evidence before generating the final cover letter." : "Use the strongest CV evidence as the first cover letter proof point.",
      "Use the same top achievement across CV, cover letter, and interview story.",
      `Prepare one answer that directly demonstrates ${companyDNA.dimensions[0]?.label || "role fit"}.`,
      hasJd ? "Use missing JD requirements as interview preparation topics." : "Paste the full JD before final application preparation.",
    ], 4),
  };
}

export function buildPhaseBInsights(input: PhaseBInput): PhaseBInsights {
  const evidenceItems = buildEvidenceItems(input);
  const evidenceAverage = evidenceItems.length
    ? clamp(evidenceItems.reduce((sum, item) => sum + item.score, 0) / evidenceItems.length)
    : 42;
  const trustAudit = buildTrustAudit(evidenceItems, clean(input.cvText), clean(input.jobDescription));
  const companyDNA = buildCompanyDNA(input, evidenceAverage, trustAudit.overall);
  const top10Rewrite = buildTop10Rewrite(evidenceItems, clean(input.targetRole, "target role"));
  const coverLetter = buildCoverLetterIntelligence(input, evidenceItems);
  const consistency = buildConsistency(input, trustAudit, companyDNA);

  return {
    companyDNA,
    trustAudit,
    evidenceEngine: {
      overall: evidenceAverage,
      summary: evidenceAverage >= 80
        ? "Evidence is strong: most important claims include ownership, proof, and outcomes."
        : evidenceAverage >= 62
          ? "Evidence is usable, but the strongest claims need sharper metrics or outcomes."
          : "Evidence is weak: the profile may sound responsible but not yet impact-driven.",
      items: evidenceItems,
    },
    top10Rewrite,
    coverLetter,
    consistency,
  };
}
