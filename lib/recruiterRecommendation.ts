/**
 * lib/recruiterRecommendation.ts
 *
 * Deterministic, zero-LLM recruiter recommendation from CV text, JD text, and
 * target role. Runs client-side in onboarding, so the suggestion appears as the
 * user types. No API call, no cost, no latency.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS WAS REBUILT
 *
 * The previous version scored 11 English white-collar tech/business domains by
 * RAW KEYWORD COUNT, and returned the top scorer no matter how thin the evidence
 * was. Measured against a corpus of real non-technical CVs, it did this:
 *
 *   Certified Welder     -> SALES DIRECTOR
 *       because the word "commercial" appeared twice ("commercial welding
 *       projects"). One generic word, repeated, outscored everything else.
 *
 *   Head Sommelier       -> no suggestion   (no hospitality domain exists)
 *   Brand Marketing Lead -> no suggestion   (no marketing domain exists)
 *   Chef de Projet       -> no suggestion   (patterns are English only)
 *   Registered Nurse     -> startup recruiter, via the word "junior"
 *
 *   Data Scientist       -> analytical/product interviewer, NEVER the technical
 *       one, because the `engineering` pattern only matched JOB TITLES
 *       ("ml engineer", "data engineer") while a CV full of Python, TensorFlow,
 *       Sklearn, and GCP scored ZERO on it. Alex was structurally unreachable.
 *
 * Three defects, and only the last one is about tech:
 *
 *   1. NO EVIDENCE BAR. A single generic word could carry a domain to the top.
 *   2. NO COVERAGE. Healthcare, hospitality, trades, marketing, education,
 *      finance, HR, and operations did not exist. Most of the workforce got
 *      either silence or a wrong answer.
 *   3. NO FAIL-SAFE. When the signal was junk, it guessed anyway.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE RULES THIS VERSION ENFORCES
 *
 *   1. EVIDENCE IS DISTINCT, NOT REPEATED. Scoring counts how many DIFFERENT
 *      keywords matched, not how many times one keyword occurred. "commercial"
 *      five times is one piece of evidence, not five.
 *
 *   2. A RECOMMENDATION MUST BE EARNED. A domain must clear an evidence bar:
 *      the user's stated ROLE matches it, or at least two DISTINCT keywords
 *      matched in the JD, or at least two in the CV. Nothing else can win.
 *
 *   3. SILENCE BEATS A WRONG ANSWER. If no domain clears the bar, return null
 *      and let the UI show its neutral default. A welder must get no suggestion
 *      rather than a Sales Director.
 *
 * Rules 1-3 are what make this global: they hold for a CV in any language, in
 * any profession, including ones this table has never heard of. An unrecognised
 * CV now fails into silence, which is correct, instead of failing into a
 * confident misroute.
 *
 * Coverage is a second, separate axis. It has been widened to the main
 * occupational families and to DE/FR/ES vocabulary, but coverage will always be
 * incomplete, and that is precisely why the fail-safe exists.
 *
 * Design rules (unchanged):
 *   - Pure function, server/client safe.
 *   - Never auto-switches a persona the user already picked. This only RANKS.
 *   - Always returns a free-tier alternative alongside the best match.
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
  primary: RecommendableRecruiterKey;
  primaryIsPro: boolean;
  freeAlternative: RecommendableRecruiterKey;
  reason: string;
  matchedSignals: string[];
  confidence: "high" | "medium" | "low";
};

type Domain = {
  id: string;
  pattern: RegExp;
  free: RecommendableRecruiterKey;
  pro?: RecommendableRecruiterKey;
  reason: string;
  /**
   * May the "startup" modifier replace this domain's interviewer with a
   * generic startup founder?
   *
   * THE BUG THIS EXISTS TO KILL
   *
   * The startup override used to be gated on `!winner.domain.pro`, which was
   * read as "this domain has no premium upsell, so a founder is a reasonable
   * Pro-tier stand-in". But a missing `pro` also means something completely
   * different in this table: "the FREE persona is the correct primary for this
   * domain, do not demote them". `data_science_ml` omits `pro` for exactly that
   * reason, so that Alex (the technical interviewer) is the primary.
   *
   * The result: any data scientist whose CV said "startup" twice, or "startup"
   * plus "MVP", got a startup founder instead of a technical screen. The same
   * override hijacked healthcare, skilled_trades, education, finance_legal and
   * five more, so a NURSE who volunteered at a health startup was routed to a
   * founder. The interviewer the job actually needs was silently replaced by a
   * vibe.
   *
   * Two meanings, one flag. Now they are separate. This is opt-in and defaults
   * to false: a domain only surrenders its interviewer if it explicitly says a
   * founder is genuinely the better screen for that kind of work.
   */
  startupOverridable?: boolean;
};

/**
 * Domain signal table.
 *
 * Structural role-signal keywords only. No company names, no brand names, no
 * vocabulary lifted from one specific job posting: sample-specific tokens
 * misroute every CV that happens to contain a common word.
 *
 * Where a profession's vocabulary is shared across languages (DE/FR/ES), the
 * tokens are included, because WorkZo runs in 15 languages and an English-only
 * table silently blanks every non-English CV.
 */
const DOMAINS: Domain[] = [
  /* ------------------------------ technical ------------------------------ */
  {
    id: "engineering",
    pattern:
      /\b(software engineer|frontend engineer|backend engineer|full[- ]?stack|devops|site reliability|sre|system design|microservices|distributed systems|kubernetes|docker|typescript|golang|rust|c\+\+|java developer|python developer|software developer|programmer|coding interview|code review|live coding|algorithms?|data structures?|cloud engineer|softwareentwickler|entwickler|ingénieur logiciel|développeur|desarrollador|programador)\b/i,
    free: "faang_hiring_manager",
    pro: "enterprise_recruiter",
    reason:
      "the role is technical, so expect engineering depth, trade-offs, and a senior system-design interviewer",
  },
  {
    // TECHNICAL data work: models, pipelines, the ML stack.
    //
    // Split out of the old single "data" domain. That domain sent EVERY data CV
    // to the analytical/product interviewer, so the technical interviewer was
    // unreachable for a data scientist. Model and pipeline work is technical and
    // gets a technical interviewer. No Pro upsell in the primary slot: when the
    // right answer is Alex, the recommendation should say Alex, not demote him
    // to a "free alternative" nobody reads.
    id: "data_science_ml",
    pattern:
      /\b(data scientist|data science|machine learning|deep learning|neural networks?|tensorflow|pytorch|scikit[- ]?learn|sklearn|xgboost|nlp|natural language processing|computer vision|feature engineering|model (?:training|deployment|evaluation)|mlops|ml pipelines?|data pipelines?|etl|airflow|spark|predictive model|recommender|datenwissenschaftler|maschinelles lernen|apprentissage automatique|científico de datos|aprendizaje automático)\b/i,
    free: "faang_hiring_manager",
    reason:
      "the role is model- and pipeline-heavy, so expect a technical interviewer probing your methods, trade-offs, and how you validated results",
  },
  {
    // BUSINESS-FACING data work: dashboards, reporting, metrics interpretation.
    id: "data_analytics",
    pattern:
      /\b(data analyst|business intelligence|bi analyst|power ?bi|tableau|looker|data visuali[sz]ation|a\/b test|analytics|dashboards?|kpis?|reporting analyst|business metrics|statistics|datenanalyst|analyste de données|analista de datos)\b/i,
    free: "analytical_hiring_manager",
    pro: "product_leader",
    reason:
      "the role is analytics-heavy, so the interview should test metrics, analysis quality, and business interpretation",
  },

  /* --------------------------- commercial / product ---------------------- */
  {
    id: "customer_success",
    pattern:
      /\b(customer success|client success|account manager|key account|customer onboarding|success manager|customer relationship|customer adoption|customer retention|csat|nps|renewals?|churn|kundenerfolg|kundenbetreuung|responsable de compte|gestor de cuentas)\b/i,
    free: "analytical_hiring_manager",
    pro: "sales_director",
    reason:
      "customer success interviews are commercial: expect questions on renewals, churn, escalations, and measurable customer outcomes",
  },
  {
    id: "sales",
    pattern:
      /\b(account executive|business development|bdr|sdr|quota|sales pipeline|prospecting|cold calling|revenue target|upsell|cross[- ]sell|deal size|crm|salesforce|vertrieb|vertriebsmitarbeiter|ventas|comercial de ventas)\b/i,
    free: "analytical_hiring_manager",
    pro: "sales_director",
    reason: "sales interviews are numbers-first, you will be pushed to quantify everything",
  },
  {
    id: "product",
    pattern:
      /\b(product manager|product owner|roadmap|prioriti[sz]ation|user research|product sense|feature launch|backlog|okrs?|produktmanager|chef de produit|jefe de producto)\b/i,
    free: "analytical_hiring_manager",
    pro: "product_leader",
    reason: "product roles get tested on prioritisation and user evidence",
  },
  {
    id: "marketing_creative",
    // Was entirely absent. A Brand Marketing Lead got NO suggestion at all.
    pattern:
      /\b(marketing|brand|campaigns?|content strategy|seo|sem|social media|copywriting|creative director|art director|growth marketing|demand generation|public relations|communications|marketing digital|mercadotecnia|markenführung)\b/i,
    free: "analytical_hiring_manager",
    pro: "product_leader",
    reason:
      "marketing interviews test campaign thinking and outcomes, so be ready to attach numbers to creative work",
  },

  /* ------------------------- process / enterprise ------------------------ */
  {
    id: "implementation_delivery",
    // "delivery" and "cross-functional" removed. They appear in nearly every
    // customer-success, account-management, and operations posting, which is how
    // this domain kept hijacking them. They live in `enterprise` now.
    pattern:
      /\b(implementation|rollout|go[- ]?live|project manager|project management|program(?:me)? manager|milestones?|change management|delivery manager|deployment plan|projektleiter|projektmanagement|chef de projet|jefe de proyecto)\b/i,
    free: "german_corporate",
    reason:
      "implementation and delivery roles need structured stakeholder handling, escalation discipline, and clear project ownership",
  },
  {
    id: "enterprise",
    pattern:
      /\b(stakeholder management|governance|cross[- ]functional|escalations?|compliance|enterprise|pmo|itil|itsm|process[- ]oriented|matrix(?:ed)? organi[sz]ation|audit|risk management)\b/i,
    free: "german_corporate",
    reason:
      "enterprise roles need structured answers around process, stakeholders, and accountability",
  },
  {
    id: "consulting",
    pattern:
      /\b(consultant|consulting|case study|case interview|strategy engagement|client engagement|advisory|unternehmensberatung|berater|conseil|consultoría)\b/i,
    free: "german_corporate",
    pro: "consulting_partner",
    reason: "consulting interviews demand case-style structure in every answer",
  },
  {
    id: "finance_legal",
    // Was absent. Accountants, controllers, and lawyers got nothing.
    pattern:
      /\b(accountant|accounting|controller|financial analyst|auditor|bookkeep(?:er|ing)|tax|treasury|ifrs|gaap|payroll|lawyer|attorney|solicitor|paralegal|legal counsel|contracts?|buchhalt(?:er|ung)|steuerberater|comptable|contable|abogado)\b/i,
    free: "german_corporate",
    reason:
      "finance and legal interviews test precision, compliance, and how you handle work where an error is expensive",
  },
  {
    id: "operations_logistics",
    // Was absent.
    pattern:
      /\b(operations manager|supply chain|logistics|warehouse|procurement|inventory|dispatch|fleet|lean|six sigma|kaizen|scheduling|logistik|einkauf|logistique|logística)\b/i,
    free: "german_corporate",
    reason:
      "operations interviews test process discipline, throughput, and how you fix a system under pressure",
  },

  /* ---------------------------- people-facing ---------------------------- */
  {
    id: "healthcare",
    // Was absent. A Registered Nurse was recommended a startup recruiter,
    // because the word "junior" happened to appear in her CV.
    pattern:
      /\b(nurse|nursing|registered nurse|rn\b|patient care|clinical|physician|doctor|paramedic|caregiv(?:er|ing)|ward|triage|medication|healthcare assistant|midwife|therapist|pharmacist|krankenpfleger|krankenschwester|pflegekraft|infirmi(?:er|ère)|soignant|enfermer(?:o|a)|sanitario)\b/i,
    free: "friendly_hr",
    reason:
      "healthcare interviews focus on patient safety, protocol, and how you stay calm and precise under pressure",
  },
  {
    id: "hospitality_food",
    // Was absent. A Head Sommelier got NO suggestion at all.
    // Note: bare "chef" is deliberately NOT a token. "Chef de Projet" is a
    // project manager, and "Chef" is German for "boss".
    pattern:
      /\b(sommelier|head chef|sous chef|chef de partie|chef de cuisine|barista|bartender|restaurant|hotel|hospitality|front of house|waitstaff|waiter|maître d|guest experience|concierge|housekeeping|banquet|catering|gastronomie|hôtellerie|restauración|camarero)\b/i,
    free: "friendly_hr",
    reason:
      "hospitality interviews test service judgement, composure under pressure, and how you recover a guest experience when it goes wrong",
  },
  {
    id: "skilled_trades",
    // Was absent. A Certified Welder was recommended a SALES DIRECTOR, because
    // "commercial" appeared twice in "commercial welding projects".
    pattern:
      /\b(welder|welding|electrician|plumber|carpenter|machinist|cnc|fabricat(?:or|ion)|technician|maintenance|hvac|forklift|scaffold|apprenticeship|journeyman|blueprint|tig|mig|schwei(?:ss|ß)er|elektriker|mechaniker|soudeur|électricien|soldador|electricista)\b/i,
    free: "german_corporate",
    reason:
      "trade interviews focus on certifications, safety compliance, and process discipline, so be specific about standards you work to",
  },
  {
    id: "education",
    // Was absent.
    pattern:
      /\b(teacher|teaching|lecturer|professor|tutor|curriculum|classroom|pedagog(?:y|ical)|student outcomes|school|educator|lehrer|dozent|enseignant|professeur|profesor|docente)\b/i,
    free: "friendly_hr",
    reason:
      "teaching interviews test how you explain, how you handle a room, and how you evidence student progress",
  },
  {
    id: "hr_people",
    // Was absent.
    pattern:
      /\b(human resources|hr manager|hr business partner|hrbp|talent acquisition|recruit(?:er|ment)|people operations|onboarding programme|employee relations|personalwesen|personalreferent|ressources humaines|recursos humanos)\b/i,
    free: "friendly_hr",
    reason:
      "HR interviews test judgement in difficult conversations and how you balance the person against the policy",
  },

];



/**
 * MODIFIERS ARE NOT DOMAINS.
 *
 * This is the bug that mattered most for coding schools and universities.
 *
 * "early_career" used to sit in the DOMAINS table and compete with the job
 * itself. Every bootcamp CV is saturated with junior / graduate / bootcamp /
 * entry-level / career change / trainee, so `early_career` beat the actual role
 * and EVERY bootcamp graduate was routed to the growth recruiter instead of a
 * technical interviewer, even when they had typed "Junior Data Scientist":
 *
 *   Bootcamp grad -> "Junior Data Scientist"     => PRIYA   (growth)
 *   Bootcamp grad -> "Junior Frontend Developer" => PRIYA
 *   German bootcamp -> "Junior Datenanalyst"     => PRIYA
 *
 * A junior data scientist is still a data scientist. Seniority is not a job
 * family, it is an AXIS. It decides which TIER of interviewer you face, never
 * which TYPE.
 *
 * So modifiers can no longer win the ranking. They adjust the outcome:
 *
 *   early_career -> keep the domain's interviewer, but drop the Pro/executive
 *                   upsell. An entry-level candidate should not be routed to an
 *                   "Enterprise Recruiter". They face the real interviewer for
 *                   the job, at the right level.
 *   leadership   -> promote to the executive interviewer.
 *   startup      -> promote to the founder interviewer.
 *
 * A modifier only picks the persona itself when NO domain clears the evidence
 * bar, i.e. a career changer whose CV says nothing about the work yet. That is
 * the one case where "early career" really is all we know.
 */
type Modifier = {
  id: string;
  pattern: RegExp;
  /** Used ONLY when no domain clears the evidence bar. */
  fallbackFree: RecommendableRecruiterKey;
  fallbackPro?: RecommendableRecruiterKey;
  reason: string;
};

const MODIFIERS: Modifier[] = [
  {
    id: "early_career",
    pattern:
      /\b(intern(ship)?|graduate|fresher|entry[- ]level|junior|trainee|working student|first job|career (change|switch)|bootcamp|praktikum|berufseinsteiger|absolvent|stagiaire|becario)\b/i,
    fallbackFree: "startup_recruiter",
    reason: "an early-career interview: expect a real screen for the role, pitched at entry level",
  },
  {
    id: "leadership",
    pattern:
      /\b(director|vp|vice president|head of|chief|cto|ceo|cfo|coo|executive|leadership team|board|c[- ]level|principal|geschäftsführer|leiter|directeur|director general)\b/i,
    fallbackFree: "analytical_hiring_manager",
    fallbackPro: "executive_recruiter",
    reason: "the role expects senior communication, judgement, and leadership-level stakeholder handling",
  },
  {
    id: "startup",
    pattern:
      /\b(startup|start[- ]up|seed stage|series [ab]|founding|scrappy|0 to 1|zero to one|early[- ]stage|mvp)\b/i,
    fallbackFree: "startup_recruiter",
    fallbackPro: "startup_founder",
    reason: "startup interviews reward ownership and honest talk about failure",
  },
];

/**
 * The target role the user TYPED is an explicit statement of the interview they
 * want. Previously weighted 4 against a JD at 6, so a JD that merely mentioned
 * "milestones" outvoted a user who had literally typed "Customer success
 * manager", and the recommendation went to the corporate process interviewer.
 * Explicit intent now leads. The JD still shapes it.
 */
const ROLE_WEIGHT = 10;
const JD_WEIGHT = 6;
const CV_WEIGHT_WITH_JD = 0.5;
const CV_WEIGHT_WITHOUT_JD = 1.25;

/**
 * DISTINCT keyword matches, not raw occurrences.
 *
 * This single change is what stops a welder being sent to a Sales Director. The
 * word "commercial" appearing five times is ONE piece of evidence, not five. Raw
 * counting let any CV that repeated one generic word dominate the table.
 */
function distinctMatches(pattern: RegExp, text: string): number {
  if (!text) return 0;
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );
  const matches = text.match(global);
  if (!matches) return 0;
  const unique = new Set(matches.map((m) => m.toLowerCase().trim()));
  // Cap so one keyword-stuffed JD cannot drown everything else.
  return Math.min(unique.size, 6);
}

function hasMeaningfulJd(jd: string): boolean {
  return jd.trim().replace(/\s+/g, " ").length >= 80;
}

/**
 * THE EVIDENCE BAR.
 *
 * A domain may only win if the recommendation is EARNED:
 *   - the user's stated role matches it, or
 *   - at least two DISTINCT keywords matched in the JD, or
 *   - at least two DISTINCT keywords matched in the CV.
 *
 * One incidental word is never enough. If nothing clears this bar, the caller
 * returns null and the UI shows its neutral default, because silence is a better
 * answer than a confident misroute.
 */
function clearsEvidenceBar(entry: { roleHits: number; jdHits: number; cvHits: number }): boolean {
  return entry.roleHits >= 1 || entry.jdHits >= 2 || entry.cvHits >= 2;
}

export function recommendRecruiters(input: {
  targetRole?: string;
  jobDescription?: string;
  cvText?: string;
  market?: string;
}): RecruiterRecommendation | null {
  const role = (input.targetRole || "").trim();
  const jd = (input.jobDescription || "").trim();
  const cv = (input.cvText || "").trim().slice(0, 4000);
  const jdPresent = hasMeaningfulJd(jd);

  if (!role && !jd && !cv) return null;

  const cvWeight = jdPresent ? CV_WEIGHT_WITH_JD : CV_WEIGHT_WITHOUT_JD;

  const measure = (pattern: RegExp) => {
    const roleHits = distinctMatches(pattern, role);
    const jdHits = distinctMatches(pattern, jd);
    const cvHits = distinctMatches(pattern, cv);
    return { roleHits, jdHits, cvHits };
  };

  /* ---------------------------- domains ---------------------------------- */

  let scores = DOMAINS.map((domain) => {
    const { roleHits, jdHits, cvHits } = measure(domain.pattern);
    const roleScore = roleHits * ROLE_WEIGHT;
    const jdScore = jdHits * JD_WEIGHT;
    let cvScore = cvHits * cvWeight;

    // With a real JD present, a technical CV is supporting context, not the
    // interviewer type. A technical CV may be used for a non-technical JD.
    if (jdPresent && domain.id === "engineering" && roleHits === 0 && jdHits === 0) {
      cvScore = 0;
    }
    if (jdPresent && domain.id === "data_analytics" && roleHits === 0 && jdHits === 0) {
      cvScore = Math.min(cvScore, 0.5);
    }

    return { domain, roleHits, jdHits, cvHits, roleScore, jdScore, cvScore, score: roleScore + jdScore + cvScore };
  }).filter((entry) => entry.score > 0 && clearsEvidenceBar(entry));

  /* --------------------------- modifiers --------------------------------- */

  const modifiers = MODIFIERS.map((modifier) => {
    const hits = measure(modifier.pattern);
    const score = hits.roleHits * ROLE_WEIGHT + hits.jdHits * JD_WEIGHT + hits.cvHits * cvWeight;
    return { modifier, ...hits, score, present: clearsEvidenceBar(hits) };
  }).filter((entry) => entry.present);

  const isEarlyCareer = modifiers.some((m) => m.modifier.id === "early_career");
  const isLeadership = modifiers.some((m) => m.modifier.id === "leadership");
  const isStartup = modifiers.some((m) => m.modifier.id === "startup");

  /* ------------------- no domain: the modifier decides -------------------- */

  // The only case where "early career" or "startup" is genuinely all we know:
  // a career changer whose CV does not yet say anything about the work.
  if (scores.length === 0) {
    const best = modifiers.sort((a, b) => b.score - a.score)[0];
    if (!best) return null; // RULE 3: silence beats a wrong answer.
    const primary = best.modifier.fallbackPro || best.modifier.fallbackFree;
    return {
      primary,
      primaryIsPro: PRO_KEYS.includes(primary),
      freeAlternative: best.modifier.fallbackFree,
      reason: best.modifier.reason,
      matchedSignals: [best.modifier.id],
      confidence: "low",
    };
  }

  /* ------------------------- rank the domains ---------------------------- */

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.jdScore !== a.jdScore) return b.jdScore - a.jdScore;
    if (b.roleScore !== a.roleScore) return b.roleScore - a.roleScore;
    return b.cvScore - a.cvScore;
  });

  let winner = scores[0];
  const runnerUp = scores[1];

  // A customer-facing JD with implementation language in it is still a customer
  // interview, not a process interview.
  const customer = scores.find((entry) => entry.domain.id === "customer_success");
  const delivery = scores.find((entry) => entry.domain.id === "implementation_delivery");
  if (jdPresent && customer && customer.score >= Math.max(winner.score * 0.72, 6)) {
    winner = customer;
  } else if (jdPresent && delivery && delivery.score >= Math.max(winner.score * 0.8, 6)) {
    winner = delivery;
  }

  /* ------------------ apply modifiers to the winning domain --------------- */

  let primary: RecommendableRecruiterKey = winner.domain.pro || winner.domain.free;
  let reason = winner.domain.reason;

  if (isEarlyCareer) {
    // Keep the interviewer the JOB needs. Drop the Pro/executive upsell: an
    // entry-level candidate faces the real interviewer for the role, at the
    // right level, not an "Enterprise Recruiter". THIS is what sends a bootcamp
    // graduate targeting a technical role to the technical interviewer.
    primary = winner.domain.free;
    reason = `${winner.domain.reason}. Pitched at entry level, but it is still a real screen for this role`;
  }
  if (isLeadership && !isEarlyCareer) {
    primary = "executive_recruiter";
    reason = `${winner.domain.reason}, at leadership level`;
  }
  // A startup context changes the FLAVOUR of an interview, not the KIND. A data
  // scientist at a seed-stage company still gets a technical screen; a nurse at
  // a health startup still gets a healthcare interviewer. Only domains that
  // explicitly opt in surrender their interviewer to a generic founder.
  // See the `startupOverridable` note on the Domain type.
  if (isStartup && !isEarlyCareer && !isLeadership && winner.domain.startupOverridable) {
    primary = "startup_founder";
  }

  const confidence: RecruiterRecommendation["confidence"] =
    winner.score >= 10 && (!runnerUp || winner.score >= runnerUp.score * 1.25)
      ? "high"
      : winner.score >= 5
        ? "medium"
        : "low";

  return {
    primary,
    primaryIsPro: PRO_KEYS.includes(primary),
    freeAlternative: winner.domain.free,
    reason,
    matchedSignals: [
      ...scores.slice(0, 2).map((entry) => entry.domain.id),
      ...modifiers.map((m) => m.modifier.id),
    ],
    confidence,
  };
}
