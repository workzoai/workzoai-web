/**
 * lib/interviewBlueprintEngine.ts
 *
 * v3 ARCHITECTURE, STEP 1 (Blueprint), STEP 5 (Competency Budgets),
 * STEP 12 (JD-Driven Generation, 70/30 weighting)
 *
 * Generates the internal Interview Blueprint ONCE per interview from the
 * Job Description (primary, 70%) and the CV (supporting context, 30%).
 * The blueprint is persisted inside the v3 memory blob and consumed
 * identically by every persona, this is the shared engine stage that
 * guarantees the JD determines WHAT is interviewed.
 *
 * DESIGN NOTES (per WorkZo engineering principles):
 * - Structural / pattern-based domain detection, never sample-specific.
 *   No candidate names, employers, or CV phrases appear in this file.
 * - Deterministic: same JD + CV → same blueprint. No LLM call here, so the
 *   blueprint survives LLM outages and costs nothing.
 * - Language note: domain detection patterns are keyword-based and strongest
 *   in English JDs. Non-English JDs fall back to the universal competency
 *   set (still fully functional, every role needs communication, problem
 *   solving, experience depth, and role fit). The LLM applies the blueprint
 *   natively in the interview language either way.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type BlueprintCompetency = {
  id: string;            // stable slug, e.g. "customer_communication"
  label: string;         // human label injected into prompts
  weight: number;        // 0-100, all competencies sum to 100
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

/**
 * Structural result of comparing the candidate's professional history (CV)
 * against the domain the interview is FOR (JD + target role). When the target
 * domain is not backed by any prior professional role, the interview must
 * source target-skill evidence from study/projects/transferable work rather
 * than demanding on-the-job examples that cannot exist. This is detected once,
 * deterministically, and rendered as a binding directive every persona obeys.
 */
export type CareerTransition = {
  isChanger: boolean;
  targetDomain: string;           // domain the interview is FOR (from JD/role)
  originDomain: string | null;    // dominant domain of the CV's work history
  originLabel: string;            // human phrase for the prior field
  transferableThemes: string;     // prior-field strengths worth probing
  evidenceFromEducation: boolean; // target skills present, but only via study/projects
  confidence: "low" | "medium" | "high";
};

export type InterviewBlueprint = {
  version: 3;
  targetRole: string;
  domain: string;                 // detected role domain
  competencies: BlueprintCompetency[];
  phasePlan: InterviewPhase[];
  jdSignals: string[];            // JD-derived focus lines (70% source)
  cvSignals: string[];            // CV-derived supporting lines (30% source)
  transition?: CareerTransition;  // present when the engine ran the check
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

/**
 * Core domain matcher over arbitrary text. `exclude` lets callers ignore a
 * domain (used so target-skill keywords appearing in old CV bullets can't
 * masquerade as the ORIGIN domain).
 */
function detectDomainFromText(text: string, exclude?: string): DomainTemplate | null {
  if (!text) return null;
  let best: { t: DomainTemplate; hits: number } | null = null;
  for (const t of DOMAIN_TEMPLATES) {
    if (exclude && t.domain === exclude) continue;
    const hits = (text.match(new RegExp(t.patterns.source, "gi")) || []).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { t, hits };
  }
  return best ? best.t : null;
}

function detectDomain(jd: string, targetRole: string): DomainTemplate | null {
  return detectDomainFromText(`${targetRole}\n${jd}`);
}

// ── STEP 12b, Career-change detection (structural, global) ──────────────────
// The observed failure: the interview probes the TARGET domain's technical
// depth (e.g. "give me a specific on-the-job example of solving X with SQL")
// when the candidate's professional history is in a DIFFERENT field and the
// target skills come from a bootcamp/course/projects. The candidate can only
// say "I don't have that experience" and disengages ("next question").
//
// Fix condition (all structural, no candidate-specific content):
//   targetDomain is known, AND
//   no JOB TITLE in the CV belongs to the target domain, AND
//   (explicit transition language is present OR the target skills clearly
//    appear only via study/projects OR a different professional domain exists).
// Origin domain (for transferable-strength guidance) is the CV work history's
// dominant domain, excluding the target so acquired-skill mentions don't count.

// Explicit "I am switching careers" language across the platform's languages.
const TRANSITION_MARKERS =
  /\b(transition(?:ing)?\s+(?:in)?to|career\s+chang|changing\s+careers?|pivot(?:ing)?\s+(?:in)?to|re[- ]?skill|aspiring|looking\s+to\s+(?:move|break)\s+into|after\s+completing\s+(?:a\s+|my\s+)?(?:bootcamp|boot\s+camp|course|certification|degree|retraining)|ex[- ]|former\b|umschulung|quereinsteiger(?:in)?|neuorientierung|nach\s+abschluss\s+(?:des|meines)|reconversion|en\s+reconversion|reconvertir|reconversión|cambio\s+de\s+carrera|transición|riconversione|cambio\s+di\s+carriera|omscholing|carrièreswitch)\b/i;

// Section headers that start the work-history region (multilingual).
const EXPERIENCE_HEADER =
  /^\s*(?:work\s+|professional\s+|employment\s+)?(?:experience|history|employment|berufserfahrung|werdegang|erfahrung|expérience(?:s)?\s*(?:professionnelle)?|parcours|experiencia(?:s)?\s*(?:profesional)?|esperienza(?:e)?\s*(?:professionale|lavorativa)?|werkervaring|ervaring)\b/i;

// Headers that END the work-history region (so acquired skills / study don't
// leak into origin-domain detection).
const NON_EXPERIENCE_HEADER =
  /^\s*(?:skills?|technical\s+skills?|education|profile|summary|about|languages?|projects?|certifications?|interests?|references?|kenntnisse|f[äa]higkeiten|ausbildung|bildung|profil|zusammenfassung|sprachen|projekte|compétences|formation|éducation|profil|langues|projets|habilidades|competencias|educación|formación|perfil|idiomas|proyectos|competenze|istruzione|formazione|profilo|lingue|progetti|vaardigheden|opleiding|talen|projecten)\b/i;

// Common role-title nouns → line looks like a job title (multilingual-ish).
const TITLE_NOUN =
  /\b(engineer|developer|analyst|scientist|manager|specialist|consultant|designer|administrator|coordinator|representative|associate|assistant|lead|director|officer|technician|accountant|nurse|teacher|architect|advisor|strateg(?:ist|y)|executive|agent|supervisor|intern|trainee|ingenieur|entwickler|berater|leiter|assistent|techniker|ingénieur|développeur|responsable|chargé|técnico|ingeniero|desarrollador|responsabile|tecnico|ontwikkelaar)\b/i;

const DATE_RANGE =
  /\b(19|20)\d{2}\b[^\n]{0,20}?[-–—][^\n]{0,20}?((19|20)\d{2}|present|current|now|heute|aktuell|présent|actuel|presente|actual|heden)\b|\b\d{1,2}\/(19|20)\d{2}\b/i;

// Prior-field strengths worth probing, keyed by the domain templates already
// defined above. Any origin domain resolves to concrete transferable themes;
// an unknown origin degrades to a generic (still useful) phrase.
const TRANSFERABLE_THEMES: Record<string, string> = {
  software_engineering: "systematic debugging, ownership of technical problems, working from requirements",
  customer_success: "customer communication, stakeholder handling, turning messy requirements into clear outcomes",
  sales: "communicating value, resilience, working to targets, reading stakeholders",
  product_management: "prioritisation, cross-functional coordination, evidence-based decisions",
  data: "analytical rigour, translating findings for non-technical audiences",
  marketing: "audience insight, experimentation, communicating results",
  operations: "process discipline, continuous improvement, coordinating across teams",
  hr_people: "empathy, stakeholder management, handling sensitive situations",
  finance: "accuracy, analytical rigour, business partnering",
};

const DOMAIN_LABEL: Record<string, string> = {
  software_engineering: "software engineering",
  customer_success: "customer-facing / support",
  sales: "sales",
  product_management: "product",
  data: "data / analytics",
  marketing: "marketing",
  operations: "operations",
  hr_people: "people / HR",
  finance: "finance",
};

/** Slice the CV down to its work-history region so acquired skills/study in
 *  other sections don't pollute origin-domain detection. Falls back to lines
 *  around date ranges, then to the whole CV, so it works on messy text too. */
function extractExperienceRegion(cvText: string): string {
  const lines = cvText.split(/\n+/).map((l) => l.trim());
  const start = lines.findIndex((l) => EXPERIENCE_HEADER.test(l));
  if (start >= 0) {
    const region: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (NON_EXPERIENCE_HEADER.test(lines[i])) break;
      region.push(lines[i]);
    }
    if (region.join(" ").trim().length > 0) return region.join("\n");
  }
  // Fallback: date-range lines plus their neighbours (title context).
  const near: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (DATE_RANGE.test(lines[i])) {
      near.push(lines[Math.max(0, i - 1)], lines[i], lines[Math.min(lines.length - 1, i + 1)]);
    }
  }
  return near.length ? Array.from(new Set(near)).join("\n") : cvText;
}

/** Lines that look like job titles within the experience region. */
function extractTitleLines(experienceRegion: string): string[] {
  return experienceRegion
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 70 && TITLE_NOUN.test(l));
}

// Seniority / filler words that carry no field meaning, stripped before
// comparing a target role against the candidate's past job titles.
const ROLE_STOPWORDS = new Set([
  "junior", "senior", "lead", "principal", "staff", "entry", "level", "mid", "associate",
  "assistant", "trainee", "intern", "graduate", "the", "a", "an", "of", "for", "and", "or",
  "to", "in", "with", "i", "ii", "iii", "iv", "jr", "sr", "role", "position",
]);

// Role nouns so common they don't prove two roles are the SAME field
// (Financial Analyst vs Data Analyst both contain "analyst"). Matching on
// these alone must not count as "already held the target role".
const GENERIC_ROLE_NOUNS = new Set([
  "analyst", "engineer", "manager", "specialist", "associate", "coordinator", "consultant",
  "officer", "developer", "administrator", "lead", "director", "representative", "agent",
  "executive", "supervisor", "advisor", "assistant", "technician", "architect", "designer",
]);

/** Distinctive (field-bearing) words from the target role, e.g. "Junior Data
 *  Analyst" → ["data"]; "Backend Engineer" → ["backend"]. Generic role nouns
 *  and seniority words are dropped so matches actually indicate the field. */
function distinctiveRoleTokens(role: string): string[] {
  return (role || "")
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9+#]+/)
    .filter((w) => w.length >= 3 && !ROLE_STOPWORDS.has(w) && !GENERIC_ROLE_NOUNS.has(w));
}

/**
 * Has the candidate already held a job of the TARGET kind? Library-free
 * (target-role's own distinctive words appear in a past title) with the
 * domain library as an optional extra path. Erring toward "yes" here is the
 * safe direction: it suppresses false career-change flags.
 */
function heldTargetRoleBefore(
  titleLines: string[],
  targetRole: string,
  targetDomain: string,
  targetTemplate: DomainTemplate | null,
): boolean {
  const titleText = titleLines.join("\n").toLowerCase();
  // Library path (only when the target maps to a known domain).
  if (targetTemplate && targetDomain !== "general") {
    if (new RegExp(targetTemplate.patterns.source, "i").test(titleText)) return true;
    if (titleLines.some((t) => detectDomainFromText(t)?.domain === targetDomain)) return true;
  }
  // Library-free path: a past title shares a distinctive field word with the
  // target role (e.g. a "Data Support Analyst" applying for "Data Analyst").
  const focus = distinctiveRoleTokens(targetRole);
  if (focus.length && focus.some((tok) => titleText.includes(tok))) return true;
  return false;
}

export function detectCareerTransition(input: {
  jobDescription: string;
  cvText: string;
  targetRole: string;
}): CareerTransition {
  const jd = input.jobDescription || "";
  const cv = input.cvText || "";
  const targetRole = input.targetRole || "";
  const targetTemplate = detectDomain(jd, targetRole);
  const targetDomain = targetTemplate?.domain || "general";
  const hasLibraryTarget = !!targetTemplate && targetDomain !== "general";

  const inactive = (): CareerTransition => ({
    isChanger: false,
    targetDomain,
    originDomain: null,
    originLabel: "their prior field",
    transferableThemes: TRANSFERABLE_THEMES[targetDomain] || "communication, problem solving, ownership",
    evidenceFromEducation: false,
    confidence: "low",
  });

  // A CV is the only hard requirement. The target role need NOT be one of the
  // known domains — the explicit-transition and role-title paths below are
  // fully library-independent, so this works for ANY role.
  if (!cv.trim()) return inactive();

  const experienceRegion = extractExperienceRegion(cv);
  const titleLines = extractTitleLines(experienceRegion);
  const titleText = titleLines.join("\n");
  const workHistoryExists = titleLines.length > 0 || DATE_RANGE.test(experienceRegion);

  // Already held a target-kind role? Then it isn't a career change.
  if (heldTargetRoleBefore(titleLines, targetRole, targetDomain, targetTemplate)) return inactive();

  // Origin domain (enrichment only). Title-derived is trustworthy enough to
  // NAME to the candidate; region-derived is used only to decide a different
  // field exists, never to assert one (a stray tool word in an old bullet
  // must not become "you were an X").
  const originFromTitle = detectDomainFromText(titleText, targetDomain)?.domain || null;
  const originFromRegion = detectDomainFromText(experienceRegion, targetDomain)?.domain || null;
  const namedOrigin = originFromTitle;
  const anyOrigin = originFromTitle || originFromRegion;

  // ── Signals (each independently sufficient; all safe on any role) ──────────
  // A) Explicit transition language — fully global, no library needed.
  const explicit = TRANSITION_MARKERS.test(cv);
  // B) A different KNOWN professional domain vs a KNOWN target domain.
  const differentProfessionalDomain = hasLibraryTarget && !!anyOrigin && anyOrigin !== targetDomain;
  // C) Target-domain skills present but never held as a job (covered targets).
  const targetRe = hasLibraryTarget ? new RegExp(targetTemplate!.patterns.source, "i") : null;
  const targetSkillsPresent = targetRe ? targetRe.test(cv) : false;
  const skillsOnlyFromStudy =
    targetSkillsPresent && !!targetRe && !targetRe.test(experienceRegion);

  const isChanger = workHistoryExists && (explicit || differentProfessionalDomain || skillsOnlyFromStudy);
  if (!isChanger) return inactive();

  const signalCount = [explicit, differentProfessionalDomain, skillsOnlyFromStudy].filter(Boolean).length;
  const confidence: CareerTransition["confidence"] = signalCount >= 2 ? "high" : "medium";

  const GENERIC_THEMES =
    "communication, stakeholder handling, problem solving, and domain knowledge carried over from their prior work";

  return {
    isChanger: true,
    targetDomain,
    originDomain: namedOrigin,
    originLabel: namedOrigin ? DOMAIN_LABEL[namedOrigin] || "their prior field" : "their prior field",
    transferableThemes: (namedOrigin && TRANSFERABLE_THEMES[namedOrigin]) || GENERIC_THEMES,
    evidenceFromEducation: targetSkillsPresent,
    confidence,
  };
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

  // The domain template's first competency is its primary technical/depth axis
  // (e.g. analytical_depth, technical_depth). We cap its question budget for
  // career changers so the interview doesn't spend three forced turns demanding
  // professional depth the candidate has never had the chance to build.
  const primaryTechnicalId = competencies[0]?.id;

  // STEP 12b: detect a career change once, deterministically.
  const transition = detectCareerTransition({ jobDescription: jd, cvText: cv, targetRole });

  // Mandatory global interview dimensions. These are required for every job,
  // regardless of persona. They fix the observed gap where interviews skipped
  // "why this role/company" and never explored missing JD requirements.
  if (!competencies.some((c) => c.id === "career_motivation" || c.id === "role_fit")) {
    competencies = competencies.map((c) => ({ ...c, weight: Math.round(c.weight * 0.9) }));
    competencies.push({ id: "career_motivation", label: "Career Motivation & Why This Role", weight: 10 });
  }

  if (jd.trim() && cv.trim() && !competencies.some((c) => c.id === "resume_jd_gap")) {
    competencies = competencies.map((c) => ({ ...c, weight: Math.round(c.weight * 0.85) }));
    competencies.push({ id: "resume_jd_gap", label: "Resume vs JD Gaps & Missing Requirements", weight: 15 });
  }

  // Career changers: add a first-class competency for transferable strengths
  // from the prior field, so the interview budgets real time for evidence the
  // candidate can actually provide (rebalancing weights like the blocks above).
  if (transition.isChanger && !competencies.some((c) => c.id === "transferable_experience")) {
    competencies = competencies.map((c) => ({ ...c, weight: Math.round(c.weight * 0.85) }));
    competencies.push({ id: "transferable_experience", label: "Transferable Strengths from Prior Field", weight: 15 });
  }

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
    competencies: competencies.map((c) => {
      let questionBudget = budgetForWeight(c.weight);
      // For a career changer, don't let the primary technical axis dominate the
      // interview by demanding depth they've never built professionally.
      if (transition.isChanger && c.id === primaryTechnicalId) {
        questionBudget = Math.min(questionBudget, 2);
      }
      return { ...c, questionBudget, askedCount: 0, status: "untested" as const };
    }),
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
    transition,
    createdAtIso: new Date().toISOString(),
  };
}

// ── Prompt rendering ─────────────────────────────────────────────────────────

/**
 * Renders the blueprint block injected into the LLM system prompt every turn.
 * This is identical for every persona, the shared engine stage.
 */
export function renderBlueprintForPrompt(bp: InterviewBlueprint): string {
  const remaining = bp.competencies.filter((c) => c.status !== "explored");
  const explored = bp.competencies.filter((c) => c.status === "explored");
  const lines: string[] = [
    "=== INTERVIEW BLUEPRINT (internal, never reveal to candidate) ===",
    `TARGET ROLE: ${bp.targetRole} (domain: ${bp.domain})`,
    "CONTENT SOURCE RULE: Questions come from the JOB DESCRIPTION first (70%); the CV is supporting context only (30%). The interview is for the NEW role, not the previous one.",
  ];

  const tr = bp.transition;
  if (tr?.isChanger) {
    lines.push(
      "=== CAREER TRANSITION CONTEXT (BINDING) ===",
      `This candidate is CHANGING CAREERS: moving from ${tr.originLabel} into ${bp.targetRole}. Their ${tr.targetDomain} skills come from study / bootcamp / coursework / self-directed projects, NOT from a professional ${tr.targetDomain} role. The CV shows NO prior job in this field.`,
      "CONDUCT THE INTERVIEW ACCORDINGLY:",
      `  • Do NOT ask for on-the-job / professional examples of ${tr.targetDomain} work they have never held. Questions like "give me a specific example from your last role where you used [target skill]" are unfair here and will dead-end.`,
      "  • Source target-skill evidence from the RIGHT places: bootcamp/course projects, personal or portfolio projects, and self-directed learning. Prefer \"Walk me through a project where you used X\" over \"Tell me about a time at work you used X\".",
      `  • Actively probe TRANSFERABLE strengths from their prior field (${tr.transferableThemes}) and how those apply to ${bp.targetRole}. Treat these as real, scoreable evidence, not small talk.`,
      "  • Ask ONCE, early, why they are making this change and what draws them to this role. Do not interrogate the motivation repeatedly.",
      "  • For any required skill they lack professionally, assess comfort level, HOW they learned it, and their learning approach, not professional depth.",
      "  • NON-REPETITION (critical): the moment the candidate says they have no professional experience with a skill, ACCEPT it, record it, and pivot to project/learning evidence or an adjacent transferable strength. NEVER re-ask for professional proof of the same gap, and never escalate specificity on a skill they've said they only studied.",
      "=== END CAREER TRANSITION CONTEXT ===",
    );
  }

  lines.push(
    "COMPETENCY PLAN (weight%, budget used):",
    ...bp.competencies.map(
      (c) => `  - ${c.label} (${c.weight}%, ${c.askedCount}/${c.questionBudget} questions, ${c.status})`,
    ),
  );
  if (remaining.length)
    lines.push("FOCUS NEXT ON: " + remaining.slice(0, 3).map((c) => c.label).join(", "));
  if (explored.length)
    lines.push("EXPLORED, DO NOT RETURN TO: " + explored.map((c) => c.label).join(", "));
  if (bp.jdSignals.length)
    lines.push("JD REQUIREMENTS (primary question source):", ...bp.jdSignals.map((s) => `  • ${s}`));
  lines.push(
    "MANDATORY COVERAGE BEFORE CLOSING:",
    "  • Ask why this role/company or why the candidate is changing into this role.",
    "  • Ask at least one JD-specific scenario, not just generic CV questions.",
    "  • Ask at least one Resume-vs-JD gap question: mention a missing or weaker requirement respectfully and ask for transferable evidence.",
    "  • If the JD requires a skill not obvious in the CV, ask comfort level and learning approach instead of pretending it is listed.",
    "UNIVERSAL FAIRNESS RULE (every interview, no exceptions): Match your questions to the experience the candidate actually has. The instant a candidate says they lack professional/hands-on experience with something, ACCEPT it, score it silently, and move on, draw any evidence from their projects, studies, or transferable work instead. NEVER re-ask for professional proof of a gap they've already acknowledged, and never escalate into more detailed sub-questions on a skill they've said they only studied or never used. Demanding on-the-job examples the person cannot have is the single most common way these interviews dead-end.",
    "RULES: One objective per question, never bundle multiple asks. Once a competency's budget is used, move to the next; never let one topic dominate.",
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
 * domain template's id, no hardcoded content beyond the blueprint itself.
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
