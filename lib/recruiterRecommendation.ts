/**
 * lib/recruiterRecommendation.ts
 *
 * Deterministic, zero-LLM recruiter recommendation from CV text, JD text,
 * and target role. Runs client-side in onboarding so the suggestion appears
 * instantly as the user types/uploads — no API call, no cost, no latency.
 *
 * Design rules:
 *   - Pure function, server/client safe (no "use client", no imports from
 *     app/). Keys are duplicated as a local union to avoid a hard dependency
 *     on onboarding's local RecruiterKey type; both must stay in sync with
 *     lib/workzoRecruiterPersonas.ts.
 *   - Never auto-switches a persona the user already picked. This module
 *     only RANKS; the UI decides how to surface it (badge + hint line).
 *   - Always returns a free-tier alternative alongside the overall best
 *     match, because the best match may be a Pro-locked persona.
 *   - Returns null when there is no meaningful signal (no role, no JD, no
 *     CV) so the UI can keep its default "start with Priya or Sarah" hint
 *     instead of showing a fabricated recommendation.
 */

export type RecommendableRecruiterKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate"
  | "faang_hiring_manager"
  | "startup_founder"
  | "consulting_partner"
  | "sales_director"
  | "product_leader"
  | "executive_recruiter"
  | "enterprise_recruiter";

const PRO_KEYS: RecommendableRecruiterKey[] = [
  "startup_founder",
  "consulting_partner",
  "sales_director",
  "product_leader",
  "executive_recruiter",
  "enterprise_recruiter",
];

export type RecruiterRecommendation = {
  /** Best overall match, may be a Pro-only persona. */
  primary: RecommendableRecruiterKey;
  primaryIsPro: boolean;
  /** Best match among Free/Premium personas (equals primary when primary is free). */
  freeAlternative: RecommendableRecruiterKey;
  /** Short human-readable reason, safe to render directly in the UI. */
  reason: string;
  /** Which signal domains fired, for debugging / analytics. */
  matchedSignals: string[];
  confidence: "high" | "medium" | "low";
};

type Domain = {
  id: string;
  pattern: RegExp;
  /** Best free persona for this domain. */
  free: RecommendableRecruiterKey;
  /** Best overall persona (Pro allowed). Falls back to `free` if undefined. */
  pro?: RecommendableRecruiterKey;
  reason: string;
};

/**
 * Domain signal table. Patterns are intentionally broad word-boundary
 * matches, mirroring the style of interviewBlueprintEngine's domain
 * detection — structural keyword classes, not sample-specific strings.
 */
const DOMAINS: Domain[] = [
  {
    id: "customer_success",
    pattern:
      /\b(customer success|client success|account manager|key account|customer onboarding|success manager|customer relationship|customer adoption|customer retention|customer satisfaction|csat|nps|renewal|churn|escalat(?:e|ion))\b/i,
    free: "analytical_hiring_manager",
    pro: "sales_director",
    reason: "customer success interviews are commercial — expect questions on renewals, churn, escalations, and measurable customer outcomes",
  },
  {
    id: "implementation_delivery",
    pattern:
      /\b(implementation|rollout|go[- ]?live|project manager|project management|program(?:me)? manager|milestones?|delivery|change management|cross[- ]functional)\b/i,
    free: "german_corporate",
    reason: "implementation and delivery roles need structured stakeholder handling, escalation discipline, and clear project ownership",
  },
  {
    id: "engineering",
    pattern:
      /\b(software engineer|frontend engineer|backend engineer|full[- ]?stack engineer|devops engineer|site reliability|sre|system design|microservices|distributed systems|kubernetes|docker|typescript|javascript|golang|rust|c\+\+|java developer|python developer|software developer|programmer|coding interview|code review|live coding|algorithms?|data structures?|technical interviewer|architecture interview|cloud engineer|ml engineer|machine learning engineer|data engineer)\b/i,
    free: "faang_hiring_manager",
    pro: "enterprise_recruiter",
    reason: "the JD itself is technical — expect engineering depth, trade-offs, and a senior system-design interviewer",
  },
  {
    id: "data",
    pattern:
      /\b(data analyst|business intelligence|bi analyst|power ?bi|tableau|looker|data visuali[sz]ation|statistics|a\/b test|analytics role|etl|dashboards?|reporting analyst|data science|data scientist)\b/i,
    free: "analytical_hiring_manager",
    pro: "product_leader",
    reason: "the JD is data-heavy, so the interview should test metrics, analysis quality, and business interpretation",
  },
  {
    id: "sales",
    pattern:
      /\b(sales|account executive|business development|bdr|sdr|quota|pipeline|prospecting|closing|revenue target|crm|salesforce|negotiation|deal size|upsell|commercial)\b/i,
    free: "analytical_hiring_manager",
    pro: "sales_director",
    reason: "sales interviews are numbers-first — you'll be pushed to quantify everything",
  },
  {
    id: "product",
    pattern:
      /\b(product manager|product owner|roadmap|prioriti[sz]ation|user research|product sense|feature launch|backlog|discovery|okrs?)\b/i,
    free: "analytical_hiring_manager",
    pro: "product_leader",
    reason: "product roles get tested on prioritisation and user evidence",
  },
  {
    id: "consulting",
    pattern:
      /\b(consultant|consulting|case study|case interview|mckinsey|bcg|bain|deloitte|accenture|strategy engagement|client engagement|advisory)\b/i,
    free: "german_corporate",
    pro: "consulting_partner",
    reason: "consulting interviews demand case-style structure in every answer",
  },
  {
    id: "leadership",
    pattern:
      /\b(director|vp|vice president|head of|chief|cto|ceo|cfo|coo|executive|leadership team|board|c[- ]level|principal)\b/i,
    free: "analytical_hiring_manager",
    pro: "executive_recruiter",
    reason: "the JD expects senior communication, judgement, and leadership-level stakeholder handling",
  },
  {
    id: "enterprise",
    // GLOBAL FIX: this pattern had been stuffed with vocabulary from one
    // specific job posting (company names, "old loft", "conferences",
    // "quarterly", brand names). Sample-specific tokens are banned — they
    // misroute every CV that happens to mention a common word. Structural
    // role-signal keywords only.
    pattern:
      /\b(stakeholder management|governance|program(?:me)? manager|cross[- ]functional|escalation|compliance|enterprise|pmo|change management|itil|process[- ]oriented|matrix(?:ed)? organi[sz]ation)\b/i,
    free: "german_corporate",
    reason: "enterprise roles need structured answers around process, stakeholders, and accountability",
  },
  {
    id: "startup",
    pattern:
      /\b(startup|start[- ]up|seed stage|series [ab]|founding|scrappy|0 to 1|zero to one|early[- ]stage|mvp)\b/i,
    free: "startup_recruiter",
    pro: "startup_founder",
    reason: "startup interviews reward ownership and honest talk about failure",
  },
  {
    id: "early_career",
    pattern:
      /\b(intern(ship)?|graduate|fresher|entry[- ]level|junior|trainee|working student|first job|career (change|switch)|bootcamp)\b/i,
    free: "startup_recruiter",
    reason: "for early-career and career-change interviews, a growth-focused recruiter fits best",
  },
];

/**
 * Signal weights are intentionally JD-first.
 *
 * The recruiter persona should model the interviewer required by the job,
 * not the strongest skill cluster in the candidate's CV. A technical CV can
 * still be used for a customer-success JD, but it should not select Alex
 * unless the JD/role itself is clearly engineering or coding-heavy.
 */
const ROLE_WEIGHT = 4;
const JD_WEIGHT = 6;
const CV_WEIGHT_WITH_JD = 0.5;
const CV_WEIGHT_WITHOUT_JD = 1.25;

function countMatches(pattern: RegExp, text: string): number {
  if (!text) return 0;
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const matches = text.match(global);
  // Cap per-source so one keyword-stuffed JD can't drown everything else.
  return Math.min(matches ? matches.length : 0, 6);
}

function hasMeaningfulJd(jd: string): boolean {
  return jd.trim().replace(/\s+/g, " ").length >= 80;
}

function hasStrongJdDomain(scores: Array<{ domain: Domain; roleScore: number; jdScore: number; cvScore: number; score: number }>): boolean {
  return scores.some((entry) => entry.jdScore >= JD_WEIGHT * 2 || entry.roleScore >= ROLE_WEIGHT * 2);
}

export function recommendRecruiters(input: {
  targetRole?: string;
  jobDescription?: string;
  cvText?: string;
  market?: string;
}): RecruiterRecommendation | null {
  const role = (input.targetRole || "").trim();
  const jd = (input.jobDescription || "").trim();
  // Only use the head of the CV: headline/summary/recent role carry the
  // signal; old bullet points at the bottom shouldn't outvote the JD.
  const cv = (input.cvText || "").trim().slice(0, 4000);
  const jdPresent = hasMeaningfulJd(jd);

  if (!role && !jd && !cv) return null;

  const cvWeight = jdPresent ? CV_WEIGHT_WITH_JD : CV_WEIGHT_WITHOUT_JD;

  let scores = DOMAINS.map((domain) => {
    const roleHits = countMatches(domain.pattern, role);
    const jdHits = countMatches(domain.pattern, jd);
    const cvHits = countMatches(domain.pattern, cv);

    let roleScore = roleHits * ROLE_WEIGHT;
    let jdScore = jdHits * JD_WEIGHT;
    let cvScore = cvHits * cvWeight;

    // Critical guard: when a real JD is present, Alex/technical should be
    // selected only if the JD or target role is technical. A technical CV
    // alone is supporting context, not the interviewer type.
    if (jdPresent && domain.id === "engineering" && roleHits === 0 && jdHits === 0) {
      cvScore = 0;
    }

    // Same principle for pure data persona selection: a data-heavy CV should
    // not override a non-data JD. It can support Daniel's evidence focus, but
    // not become the primary recruiter reason.
    if (jdPresent && domain.id === "data" && roleHits === 0 && jdHits === 0) {
      cvScore = Math.min(cvScore, 0.5);
    }

    return { domain, roleScore, jdScore, cvScore, score: roleScore + jdScore + cvScore };
  }).filter((entry) => entry.score > 0);

  if (scores.length === 0) return null;

  // If the JD/role clearly identifies a non-technical interview family,
  // de-prioritise CV-only technical residue instead of letting Python/SQL/API
  // terms from the CV steal the recommendation.
  if (jdPresent && hasStrongJdDomain(scores)) {
    scores = scores.map((entry) => {
      if ((entry.domain.id === "engineering" || entry.domain.id === "data") && entry.jdScore === 0 && entry.roleScore === 0) {
        return { ...entry, score: Math.min(entry.score, 0.25) };
      }
      return entry;
    });
  }

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker is JD-first, then role, then CV.
    if (b.jdScore !== a.jdScore) return b.jdScore - a.jdScore;
    if (b.roleScore !== a.roleScore) return b.roleScore - a.roleScore;
    return b.cvScore - a.cvScore;
  });

  let winner = scores[0];
  const runnerUp = scores[1];

  // Customer success + implementation + senior stakeholder language should
  // feel like a senior customer/enterprise interview, not a code interview.
  const customer = scores.find((entry) => entry.domain.id === "customer_success");
  const delivery = scores.find((entry) => entry.domain.id === "implementation_delivery");
  const leadership = scores.find((entry) => entry.domain.id === "leadership");
  if (jdPresent && customer && customer.score >= Math.max(winner.score * 0.72, 6)) {
    winner = customer;
    if (leadership && leadership.score >= customer.score * 0.6) {
      winner = { ...customer, domain: { ...customer.domain, pro: "executive_recruiter" } };
    }
  } else if (jdPresent && delivery && delivery.score >= Math.max(winner.score * 0.8, 6)) {
    winner = delivery;
  }

  // Seniority tiebreak: engineering + leadership both firing on a
  // "Staff Engineer" role should stay technical, not go executive,
  // unless leadership clearly dominates.
  if (
    winner.domain.id === "leadership" &&
    runnerUp &&
    runnerUp.domain.id === "engineering" &&
    runnerUp.score >= winner.score * 0.75 &&
    (runnerUp.jdScore > 0 || runnerUp.roleScore > 0)
  ) {
    winner = runnerUp;
  }

  const primary = winner.domain.pro || winner.domain.free;
  const primaryIsPro = PRO_KEYS.includes(primary);

  const confidence: RecruiterRecommendation["confidence"] =
    winner.score >= 10 && (!runnerUp || winner.score >= runnerUp.score * 1.25)
      ? "high"
      : winner.score >= 5
        ? "medium"
        : "low";

  return {
    primary,
    primaryIsPro,
    freeAlternative: winner.domain.free,
    reason: winner.domain.reason,
    matchedSignals: scores.slice(0, 3).map((entry) => entry.domain.id),
    confidence,
  };
}
