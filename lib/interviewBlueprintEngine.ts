/**
 * lib/interviewBlueprintEngine.ts
 *
 * v3 ARCHITECTURE — STEP 1 (Blueprint), STEP 5 (Competency Budgets),
 * STEP 12 (JD-Driven Generation, 70/30 weighting)
 *
 * Generates the internal Interview Blueprint ONCE per interview from the
 * Job Description (primary, 70%) and the CV (supporting context, 30%).
 * The blueprint is persisted inside the v3 memory blob and consumed
 * identically by every persona — this is the shared engine stage that
 * guarantees the JD determines WHAT is interviewed.
 *
 * DESIGN NOTES (per WorkZo engineering principles):
 * - Structural / pattern-based domain detection, never sample-specific.
 *   No candidate names, employers, or CV phrases appear in this file.
 * - Deterministic: same JD + CV → same blueprint. No LLM call here, so the
 *   blueprint survives LLM outages and costs nothing.
 * - Language note: domain detection patterns are keyword-based and strongest
 *   in English JDs. Non-English JDs fall back to the universal competency
 *   set (still fully functional — every role needs communication, problem
 *   solving, experience depth, and role fit). The LLM applies the blueprint
 *   natively in the interview language either way.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type BlueprintCompetency = {
  id: string;            // stable slug, e.g. "customer_communication"
  label: string;         // human label injected into prompts
  weight: number;        // 0–100, all competencies sum to 100
  questionBudget: number;// max questions before forced move-on (Step 5)
  askedCount: number;    // updated per turn by the ledger
  status: "untested" | "in_progress" | "explored";
};

export type InterviewPhase =
  | "greeting"
  | "introduction"
  | "experience"
  | "core_competencies"
  | "behavioural"
  | "scenario"
  | "candidate_questions"
  | "closing";

export type InterviewBlueprint = {
  version: 3;
  targetRole: string;
  domain: string;                 // detected role domain
  competencies: BlueprintCompetency[];
  phasePlan: InterviewPhase[];
  jdSignals: string[];            // JD-derived focus lines (70% source)
  cvSignals: string[];            // CV-derived supporting lines (30% source)
  createdAtIso: string;
};

// ── Role-domain pattern library ─────────────────────────────────────────────
// Each domain: detection patterns (JD text) + weighted competency template.
// Weights sum to 100; budgets scale with weight. Extending = add a domain
// entry; no logic changes needed.

type DomainTemplate = {
  domain: string;
  patterns: RegExp;
  competencies: Array<{ id: string; label: string; weight: number }>;
};

const UNIVERSAL_COMPETENCIES: Array<{ id: string; label: string; weight: number }> = [
  { id: "experience_depth", label: "Relevant Experience", weight: 25 },
  { id: "communication", label: "Communication", weight: 20 },
  { id: "problem_solving", label: "Problem Solving", weight: 20 },
  { id: "collaboration", label: "Teamwork & Collaboration", weight: 15 },
  { id: "role_fit", label: "Motivation & Role Fit", weight: 10 },
  { id: "behavioural", label: "Behavioural Skills", weight: 10 },
];

const DOMAIN_TEMPLATES: DomainTemplate[] = [
  {
    domain: "software_engineering",
    patterns: /\b(software engineer|developer|full[- ]?stack|backend|front[- ]?end|devops|api|microservice|ci\/cd|typescript|python|java|golang|kubernetes|system design)\b/i,
    competencies: [
      { id: "technical_depth", label: "Technical Depth", weight: 30 },
      { id: "system_thinking", label: "System Design & Tradeoffs", weight: 20 },
      { id: "problem_solving", label: "Problem Solving", weight: 15 },
      { id: "collaboration", label: "Cross-functional Collaboration", weight: 15 },
      { id: "communication", label: "Communication", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "customer_success",
    patterns: /\b(customer success|account manager|client relationship|onboarding|retention|churn|renewals|csm|customer satisfaction|nps)\b/i,
    competencies: [
      { id: "customer_communication", label: "Customer Communication", weight: 30 },
      { id: "stakeholder_management", label: "Stakeholder Management", weight: 20 },
      { id: "project_ownership", label: "Project Ownership", weight: 15 },
      { id: "problem_solving", label: "Problem Solving", weight: 15 },
      { id: "technical_knowledge", label: "Technical Knowledge", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "sales",
    patterns: /\b(sales|account executive|business development|quota|pipeline|prospecting|closing deals|revenue target|crm|negotiation)\b/i,
    competencies: [
      { id: "commercial_results", label: "Commercial Results & Metrics", weight: 30 },
      { id: "customer_communication", label: "Client Communication", weight: 20 },
      { id: "resilience", label: "Resilience & Ownership", weight: 15 },
      { id: "process_discipline", label: "Pipeline & Process Discipline", weight: 15 },
      { id: "problem_solving", label: "Problem Solving", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "product_management",
    patterns: /\b(product manager|product owner|roadmap|prioriti[sz]ation|user research|discovery|feature|stakeholder alignment|a\/b test|product strategy)\b/i,
    competencies: [
      { id: "product_judgment", label: "Product Judgment & Prioritization", weight: 25 },
      { id: "user_evidence", label: "User Evidence & Research", weight: 20 },
      { id: "stakeholder_management", label: "Cross-functional Influence", weight: 20 },
      { id: "communication", label: "Communication", weight: 15 },
      { id: "problem_solving", label: "Problem Solving", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "data",
    patterns: /\b(data scientist|data analyst|data engineer|machine learning|analytics|sql|dashboards?|etl|statistical|modelling|modeling|bi )\b/i,
    competencies: [
      { id: "analytical_depth", label: "Analytical & Data Depth", weight: 30 },
      { id: "business_translation", label: "Translating Data to Business Impact", weight: 20 },
      { id: "problem_solving", label: "Problem Solving", weight: 15 },
      { id: "communication", label: "Communication", weight: 15 },
      { id: "collaboration", label: "Cross-functional Collaboration", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "marketing",
    patterns: /\b(marketing|seo|sem|campaign|content strategy|brand|growth|social media|conversion|funnel|copywriting)\b/i,
    competencies: [
      { id: "campaign_results", label: "Campaign Strategy & Results", weight: 25 },
      { id: "audience_insight", label: "Audience & Market Insight", weight: 20 },
      { id: "creativity", label: "Creativity & Experimentation", weight: 15 },
      { id: "communication", label: "Communication", weight: 15 },
      { id: "collaboration", label: "Collaboration", weight: 15 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "operations",
    patterns: /\b(operations|supply chain|logistics|process improvement|lean|six sigma|procurement|inventory|sop|efficiency)\b/i,
    competencies: [
      { id: "process_discipline", label: "Process & Operational Rigor", weight: 30 },
      { id: "problem_solving", label: "Problem Solving", weight: 20 },
      { id: "stakeholder_management", label: "Stakeholder Management", weight: 15 },
      { id: "metrics", label: "Metrics & Continuous Improvement", weight: 15 },
      { id: "communication", label: "Communication", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "hr_people",
    patterns: /\b(human resources|hr business partner|talent acquisition|recruit(er|ing|ment)|people operations|employee relations|compensation|onboard(ing)? new hires)\b/i,
    competencies: [
      { id: "people_judgment", label: "People Judgment & Empathy", weight: 25 },
      { id: "stakeholder_management", label: "Stakeholder Management", weight: 20 },
      { id: "process_discipline", label: "Process & Compliance", weight: 20 },
      { id: "communication", label: "Communication", weight: 15 },
      { id: "problem_solving", label: "Problem Solving", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
  {
    domain: "finance",
    patterns: /\b(finance|accountant|financial analyst|fp&a|audit|controller|budget(ing)?|forecast(ing)?|reconciliation|ifrs|gaap)\b/i,
    competencies: [
      { id: "analytical_depth", label: "Financial & Analytical Depth", weight: 30 },
      { id: "process_discipline", label: "Accuracy & Compliance", weight: 20 },
      { id: "business_translation", label: "Business Partnering", weight: 15 },
      { id: "communication", label: "Communication", weight: 15 },
      { id: "problem_solving", label: "Problem Solving", weight: 10 },
      { id: "behavioural", label: "Behavioural Skills", weight: 10 },
    ],
  },
];

// Leadership is appended (not a domain) when the JD signals people leadership.
const LEADERSHIP_PATTERN =
  /\b(lead(ing)? a team|team lead|manage[sd]? (a )?team|direct reports|head of|manager of|leadership|people manage(ment|r)|mentor(ing)?)\b/i;

// ── Blueprint generation ─────────────────────────────────────────────────────

function detectDomain(jd: string, targetRole: string): DomainTemplate | null {
  const haystack = `${targetRole}\n${jd}`;
  let best: { t: DomainTemplate; hits: number } | null = null;
  for (const t of DOMAIN_TEMPLATES) {
    const hits = (haystack.match(new RegExp(t.patterns.source, "gi")) || []).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { t, hits };
  }
  return best ? best.t : null;
}

/** Extract short JD requirement lines (bullets / requirement sentences). */
function extractJdSignals(jd: string): string[] {
  return jd
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim())
    .filter((l) => l.length >= 12 && l.length <= 160)
    .filter((l) =>
      /\b(experience|responsib|require|must|skill|abilit|knowledge|proficien|manage|develop|deliver|own|drive|erfahrung|kenntnisse|verantwort|expérience|compétence|experiencia|conocimiento|esperienza|competenz|ervaring|vaardigheid)\b/i.test(l),
    )
    .slice(0, 12);
}

/** Extract compact CV support lines from the canonical-format CV text. */
function extractCvSignals(cvText: string): string[] {
  return cvText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /[•|]/.test(l) && l.length >= 10 && l.length <= 160)
    .slice(0, 8);
}

function budgetForWeight(weight: number): number {
  if (weight >= 25) return 3;
  if (weight >= 15) return 2;
  return 1;
}

export function generateInterviewBlueprint(input: {
  jobDescription: string;
  cvText: string;
  targetRole: string;
}): InterviewBlueprint {
  const jd = input.jobDescription || "";
  const cv = input.cvText || "";
  const targetRole = (input.targetRole || "the target role").trim();

  const template = detectDomain(jd, targetRole);
  let competencies = (template ? template.competencies : UNIVERSAL_COMPETENCIES).map((c) => ({ ...c }));

  // Append leadership when the JD asks for it, rebalancing weights.
  if (LEADERSHIP_PATTERN.test(jd) && !competencies.some((c) => c.id === "leadership")) {
    competencies = competencies.map((c) => ({ ...c, weight: Math.round(c.weight * 0.85) }));
    competencies.push({ id: "leadership", label: "Leadership", weight: 15 });
  }
  // Normalize to exactly 100.
  const total = competencies.reduce((s, c) => s + c.weight, 0);
  competencies = competencies.map((c, i) => ({
    ...c,
    weight: i === 0 ? c.weight + (100 - total) : c.weight,
  }));

  return {
    version: 3,
    targetRole,
    domain: template ? template.domain : "general",
    competencies: competencies.map((c) => ({
      ...c,
      questionBudget: budgetForWeight(c.weight),
      askedCount: 0,
      status: "untested" as const,
    })),
    phasePlan: [
      "greeting",
      "introduction",
      "experience",
      "core_competencies",
      "behavioural",
      "scenario",
      "candidate_questions",
      "closing",
    ],
    jdSignals: extractJdSignals(jd),
    cvSignals: extractCvSignals(cv),
    createdAtIso: new Date().toISOString(),
  };
}

// ── Prompt rendering ─────────────────────────────────────────────────────────

/**
 * Renders the blueprint block injected into the LLM system prompt every turn.
 * This is identical for every persona — the shared engine stage.
 */
export function renderBlueprintForPrompt(bp: InterviewBlueprint): string {
  const remaining = bp.competencies.filter((c) => c.status !== "explored");
  const explored = bp.competencies.filter((c) => c.status === "explored");
  const lines: string[] = [
    "=== INTERVIEW BLUEPRINT (internal — never reveal to candidate) ===",
    `TARGET ROLE: ${bp.targetRole} (domain: ${bp.domain})`,
    "CONTENT SOURCE RULE: Questions come from the JOB DESCRIPTION first (70%); the CV is supporting context only (30%). The interview is for the NEW role, not the previous one.",
    "COMPETENCY PLAN (weight% — budget used):",
    ...bp.competencies.map(
      (c) => `  - ${c.label} (${c.weight}% — ${c.askedCount}/${c.questionBudget} questions, ${c.status})`,
    ),
  ];
  if (remaining.length)
    lines.push("FOCUS NEXT ON: " + remaining.slice(0, 3).map((c) => c.label).join(", "));
  if (explored.length)
    lines.push("EXPLORED — DO NOT RETURN TO: " + explored.map((c) => c.label).join(", "));
  if (bp.jdSignals.length)
    lines.push("JD REQUIREMENTS (primary question source):", ...bp.jdSignals.map((s) => `  • ${s}`));
  lines.push(
    "RULES: One objective per question — never bundle multiple asks. Once a competency's budget is used, move to the next; never let one topic dominate.",
    "=== END BLUEPRINT ===",
  );
  return lines.join("\n");
}

/**
 * Records that a question was spent on a competency (called by the ledger
 * when the engine classifies the recruiter's question). Marks explored when
 * the budget is used.
 */
export function spendCompetencyQuestion(bp: InterviewBlueprint, competencyId: string): InterviewBlueprint {
  return {
    ...bp,
    competencies: bp.competencies.map((c) => {
      if (c.id !== competencyId) return c;
      const askedCount = c.askedCount + 1;
      return {
        ...c,
        askedCount,
        status: askedCount >= c.questionBudget ? "explored" : "in_progress",
      };
    }),
  };
}

/**
 * Classifies which blueprint competency a question/answer exchange touched.
 * Structural: matches against the competency's own label tokens plus the
 * domain template's id — no hardcoded content beyond the blueprint itself.
 */
export function classifyCompetency(bp: InterviewBlueprint, text: string): string | null {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  let best: { id: string; score: number } | null = null;
  for (const c of bp.competencies) {
    const tokens = c.label.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 3);
    const score = tokens.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  // Default the spend to the highest-weight unexplored competency so budgets
  // still deplete even when classification is ambiguous.
  if (!best) {
    const open = bp.competencies.filter((c) => c.status !== "explored");
    if (!open.length) return null;
    return open.sort((a, b) => b.weight - a.weight)[0].id;
  }
  return best.id;
}
