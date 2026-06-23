/**
 * lib/workzoInterviewEvidencePlanner.ts  — v3.0 (Full Intelligence Upgrade)
 *
 * ALL 9 PHASES IMPLEMENTED:
 *
 * Phase 1  — Interview Intelligence Layer (CV + JD parse before Question 1)
 * Phase 2  — Interview Plan Generator     (structured plan, no random questions)
 * Phase 3  — Evidence Tracker             (per-skill verification status)
 * Phase 4  — Follow-up Engine             (bad answer → drill down, not next Q)
 * Phase 5  — Contradiction Engine         (claim store + later challenge trigger)
 * Phase 6  — Scenario Engine              (JD-derived realistic scenarios)
 * Phase 7  — Adaptive Difficulty          (junior / mid / senior depth)
 * Phase 8  — Recruiter Memory             (asked, verified, weak, strong areas)
 * Phase 9  — Results Engine               (evidence-based scoring: 6 dimensions)
 */

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceStatus =
  | "unverified"
  | "partially_verified"
  | "verified"
  | "contradicted"
  | "gap_acknowledged";

export type RoleLevel = "junior" | "mid" | "senior" | "unknown";

export type QuestionCategory =
  | "intro"
  | "experience_validation"
  | "project_validation"
  | "technical_validation"
  | "jd_gap"
  | "scenario"
  | "behavioral"
  | "contradiction_challenge"
  | "followup";

export type WorkZoEvidenceTranscriptItem = {
  role?: string;
  speaker?: string;
  text?: string;
  time?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — INTERVIEW INTELLIGENCE LAYER
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_SKILLS = [
  "Python", "SQL", "MySQL", "PostgreSQL", "Excel", "Power BI", "Tableau",
  "Looker", "Figma", "Jira", "Confluence", "Salesforce", "HubSpot", "Zendesk",
  "ServiceNow", "ITIL", "ITSM", "Active Directory", "Windows Server", "Linux",
  "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "API",
  "REST API", "GraphQL", "ETL", "Data Pipeline", "Machine Learning", "NLP",
  "RAG", "LLM", "TensorFlow", "Scikit-learn", "Pandas", "NumPy", "Matplotlib",
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Java", "C#",
  "Spring", "Django", "FastAPI", "Cybersecurity", "SIEM", "SOC", "Splunk",
  "CrowdStrike", "Nessus", "Wireshark", "IAM", "Penetration Testing",
  "CAD", "SolidWorks", "Creo", "CATIA", "Inventor", "Windchill",
  "Customer Success", "Customer Support", "Technical Support", "Troubleshooting",
  "Stakeholder Management", "Roadmapping", "Agile", "Scrum", "A/B Testing",
  "User Research", "Growth Optimization", "Reporting", "Dashboards",
  "Power Query", "DAX", "VLOOKUP", "Pivot Tables", "Google Analytics",
  "Mixpanel", "Amplitude", "Segment", "dbt", "Airflow", "Spark", "Hadoop",
  "Selenium", "Cypress", "Jest", "Pytest", "Git", "GitHub", "GitLab",
  "Terraform", "Ansible", "Jenkins", "CircleCI", "Datadog", "Grafana",
  "Prometheus", "Elasticsearch", "Redis", "MongoDB", "Cassandra", "Snowflake",
  "BigQuery", "Redshift", "SAP", "Oracle", "Microsoft Dynamics",
  "Account Management", "Business Development", "Cold Calling", "Negotiation",
  "Project Management", "Change Management", "Process Improvement",
  "Six Sigma", "Lean", "Quality Assurance", "Compliance", "Risk Management",
];

const GENERIC_STOP = new Set([
  "candidate", "resume", "profile", "summary", "experience", "education",
  "contact", "language", "languages", "work", "professional", "skills",
  "project", "projects", "responsible", "excellent", "good", "strong",
  "team", "communication", "motivated", "detail", "oriented", "ability",
  "knowledge", "understanding", "including", "using",
]);

function clean(value: unknown, max = 4000): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function norm(value: unknown): string {
  return clean(value, 300)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items: string[], limit = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = clean(item, 100).replace(/^[-•*]\s*/, "").trim();
    const key = norm(label);
    if (!key || seen.has(key) || key.split(" ").every(w => GENERIC_STOP.has(w))) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function extractKnownSkills(text: string): string[] {
  const n = norm(text);
  return unique(
    KNOWN_SKILLS.filter(skill => {
      const key = norm(skill);
      return key && new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(n);
    }),
    40,
  );
}

function extractProjectNames(cvText: string): string[] {
  const lines = String(cvText || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);
  const found: string[] = [];
  let active = false;
  for (const line of lines) {
    if (/^(projects?|key projects?|selected projects?|portfolio|case studies|academic projects?|bootcamp projects?|personal projects?)$/i.test(line)) {
      active = true;
      continue;
    }
    if (active && /^(experience|education|languages?|contact|profile|summary|certifications?|references?|work experience|professional experience|skills)$/i.test(line)) break;
    if (active && line.length <= 120 && !/@|\+?\d[\d\s()./-]{5,}/.test(line)) found.push(line);
    if (found.length >= 12) break;
  }
  return unique(found, 10);
}

function extractExperienceTitles(cvText: string): string[] {
  const lines = String(cvText || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
  const titlePatterns = [
    /\b(engineer|analyst|manager|developer|designer|specialist|consultant|coordinator|director|executive|officer|lead|head|architect|scientist|associate|intern|supervisor|support|technician)\b/i,
  ];
  return unique(
    lines.filter(l => l.length < 100 && titlePatterns.some(p => p.test(l))).slice(0, 8),
    8,
  );
}

function extractJdSkills(jdText: string): { required: string[]; preferred: string[] } {
  const known = extractKnownSkills(jdText);
  const lines = String(jdText || "").split(/\n|•|- /).map(l => clean(l, 200)).filter(Boolean);

  const required = unique([
    ...known,
    ...lines.filter(l =>
      /\b(required|must have|essential|mandatory|minimum)\b/i.test(l) && l.length > 10
    ).slice(0, 8),
  ], 20);

  const preferred = unique(
    lines.filter(l =>
      /\b(preferred|nice to have|bonus|desired|advantage|plus)\b/i.test(l) && l.length > 10
    ).slice(0, 6),
    10,
  );

  return { required, preferred };
}

function extractCandidateClaims(transcript?: WorkZoEvidenceTranscriptItem[]): string[] {
  const answers = (transcript || [])
    .filter(t => /candidate|user/i.test(String(t.role || t.speaker || "")))
    .map(t => clean(t.text, 320))
    .filter(Boolean);

  return unique(
    answers.flatMap(answer =>
      answer
        .split(/(?<=[.!?])\s+/)
        .filter(s =>
          /\b(i|my|me|personally|led|built|created|designed|developed|implemented|resolved|improved|managed|handled|used|worked|owned|wrote|delivered|launched|increased|reduced|saved|automated)\b/i.test(s)
        )
        .map(s => clean(s, 200)),
    ),
    12,
  );
}

function intersection(a: string[], b: string[]): string[] {
  const bKeys = new Set(b.map(norm));
  return a.filter(item => bKeys.has(norm(item)));
}

function difference(a: string[], b: string[]): string[] {
  const bKeys = new Set(b.map(norm));
  return a.filter(item => !bKeys.has(norm(item)));
}

// ── Phase 1 Output ────────────────────────────────────────────────────────────

export type InterviewIntelligenceLayer = {
  cvSkills: string[];
  cvProjects: string[];
  cvExperience: string[];
  jdRequiredSkills: string[];
  jdPreferredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  claimsToValidate: string[];
  riskAreas: string[];
};

export function buildInterviewIntelligenceLayer(input: {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  transcript?: WorkZoEvidenceTranscriptItem[];
}): InterviewIntelligenceLayer {
  const cvText = clean(input.cvText, 8000);
  const jdText = clean(input.jobDescription, 8000);

  const cvSkills = extractKnownSkills(cvText);
  const cvProjects = extractProjectNames(cvText);
  const cvExperience = extractExperienceTitles(cvText);
  const { required: jdRequiredSkills, preferred: jdPreferredSkills } = extractJdSkills(jdText);
  const matchedSkills = intersection(jdRequiredSkills, cvSkills);
  const missingSkills = difference(jdRequiredSkills, cvSkills).slice(0, 10);
  const claimsToValidate = extractCandidateClaims(input.transcript);

  const riskAreas: string[] = [];
  if (missingSkills.length >= 4) riskAreas.push(`${missingSkills.length} JD requirements not visible in CV`);
  if (cvProjects.length === 0) riskAreas.push("No projects found in CV to probe");
  if (cvExperience.length === 0) riskAreas.push("No role titles detected — experience section may be missing");
  if (claimsToValidate.some(c => /\d+\s*(years?|yrs?)/i.test(c))) riskAreas.push("Candidate made experience-year claims to verify");

  return {
    cvSkills: cvSkills.slice(0, 20),
    cvProjects: cvProjects.slice(0, 8),
    cvExperience: cvExperience.slice(0, 8),
    jdRequiredSkills: jdRequiredSkills.slice(0, 20),
    jdPreferredSkills: jdPreferredSkills.slice(0, 10),
    matchedSkills: matchedSkills.slice(0, 12),
    missingSkills,
    claimsToValidate,
    riskAreas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — INTERVIEW PLAN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewPlan = {
  intro: number;
  experienceValidation: number;
  projectValidation: number;
  technicalValidation: number;
  jdGapQuestions: number;
  scenarioQuestions: number;
  behavioralQuestions: number;
  followupBudget: number;
  totalEstimatedQuestions: number;
  categoryOrder: QuestionCategory[];
  rationale: string;
};

export function buildInterviewPlan(
  intelligence: InterviewIntelligenceLayer,
  roleLevel: RoleLevel = "unknown",
): InterviewPlan {
  const hasCvProjects = intelligence.cvProjects.length > 0;
  const hasExperience = intelligence.cvExperience.length > 0;
  const hasGaps = intelligence.missingSkills.length > 0;
  const isFresher = roleLevel === "junior";
  const technicalCount = Math.min(6, Math.max(2, intelligence.matchedSkills.length + 1));

  // Freshers: more project + conceptual questions, fewer experience questions,
  // lighter scenarios, NO hard gap-drilling (they may simply not have it yet).
  const plan: InterviewPlan = {
    intro: 1,
    experienceValidation: isFresher ? 1 : (hasExperience ? 4 : 2),
    projectValidation: hasCvProjects
      ? (isFresher ? Math.min(5, intelligence.cvProjects.length + 2) : Math.min(4, intelligence.cvProjects.length + 1))
      : (isFresher ? 1 : 0), // fresher: ask about personal/academic projects even if not parsed
    technicalValidation: isFresher ? Math.min(4, technicalCount) : technicalCount,
    jdGapQuestions: isFresher ? 0 : (hasGaps ? Math.min(4, intelligence.missingSkills.length) : 0),
    scenarioQuestions: isFresher ? 1 : 3,  // freshers get 1 simplified scenario, not 3 hard ones
    behavioralQuestions: isFresher ? 3 : 2, // more behavioral for freshers (academic/life examples)
    followupBudget: 10,
    totalEstimatedQuestions: 0,
    categoryOrder: [],
    rationale: "",
  };

  plan.totalEstimatedQuestions =
    plan.intro +
    plan.experienceValidation +
    plan.projectValidation +
    plan.technicalValidation +
    plan.jdGapQuestions +
    plan.scenarioQuestions +
    plan.behavioralQuestions;

  plan.categoryOrder = isFresher
    ? [
        "intro",
        "project_validation",      // freshers: lead with projects, not experience
        "technical_validation",
        "behavioral",              // academic/life-based STAR questions
        "scenario",
      ]
    : [
        "intro",
        "experience_validation",
        ...(hasCvProjects ? (["project_validation"] as QuestionCategory[]) : []),
        "technical_validation",
        ...(hasGaps ? (["jd_gap"] as QuestionCategory[]) : []),
        "scenario",
        "behavioral",
      ];

  plan.rationale = isFresher
    ? [
        "FRESHER INTERVIEW MODE: candidate has little or no professional work experience.",
        "Focus on: academic projects, personal/side projects, conceptual understanding, and learning potential.",
        "Do NOT ask work-experience-based STAR questions — ask about university projects, coursework, team assignments, and personal initiatives.",
        "Do NOT penalise for missing industry experience. Assess curiosity, problem-solving approach, and foundation knowledge.",
        hasCvProjects ? `Projects to explore: ${intelligence.cvProjects.slice(0, 3).join(", ")}` : "No projects parsed — ask them to describe their best academic or personal project.",
        `Technical concepts to test (at foundational level): ${intelligence.cvSkills.slice(0, 5).join(", ") || "core role concepts"}`,
        "Tone: supportive and coaching. This is the candidate's first or second interview. Make them feel assessed fairly, not interrogated.",
        "Scenario: use a simple real-world task question, not a crisis scenario.",
      ].join(" | ")
    : [
        hasExperience
          ? `${plan.experienceValidation} experience questions targeting: ${intelligence.cvExperience.slice(0, 3).join(", ")}`
          : "No clear experience titles — will ask open experience questions",
        hasCvProjects
          ? `${plan.projectValidation} project deep-dives on: ${intelligence.cvProjects.slice(0, 2).join(", ")}`
          : "No projects found — skipping project validation",
        `${plan.technicalValidation} technical validations on: ${intelligence.matchedSkills.slice(0, 4).join(", ") || "core role skills"}`,
        hasGaps
          ? `${plan.jdGapQuestions} gap questions for: ${intelligence.missingSkills.slice(0, 3).join(", ")}`
          : "No significant CV-JD gaps detected",
        `${plan.scenarioQuestions} scenario questions derived from JD context`,
        `${plan.behavioralQuestions} behavioral / STAR questions`,
        `Up to ${plan.followupBudget} follow-up probes available`,
      ].join(" | ");

  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — EVIDENCE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceTracker = Record<string, EvidenceStatus>;

export function buildInitialEvidenceTracker(
  intelligence: InterviewIntelligenceLayer,
): EvidenceTracker {
  const tracker: EvidenceTracker = {};
  const allSkills = unique([
    ...intelligence.cvSkills,
    ...intelligence.matchedSkills,
    ...intelligence.missingSkills,
  ], 40);
  for (const skill of allSkills) {
    tracker[norm(skill)] = "unverified";
  }
  return tracker;
}

export function updateEvidenceTracker(
  tracker: EvidenceTracker,
  transcript: WorkZoEvidenceTranscriptItem[],
  intelligence: InterviewIntelligenceLayer,
): EvidenceTracker {
  const updated = { ...tracker };
  const candidateText = (transcript || [])
    .filter(t => /candidate|user/i.test(String(t.role || t.speaker || "")))
    .map(t => clean(t.text, 500))
    .join(" ");

  for (const skillKey of Object.keys(updated)) {
    const skillNorm = norm(skillKey);

    const mentioned = new RegExp(
      `(^|\\s)${skillNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`,
      "i",
    ).test(norm(candidateText));

    if (!mentioned) continue;

    const hasEvidence =
      /\b(i built|i wrote|i used|i implemented|i designed|i led|i created|i managed|i handled|i developed|i deployed|i owned|my responsibility)\b/i.test(candidateText) &&
      /\b(\d+|result|outcome|impact|saved|improved|reduced|increased|delivered|launched)\b/i.test(candidateText);

    const hasBasicMention =
      /\b(i used|i worked with|i have experience|familiar with|i know|i've done)\b/i.test(candidateText);

    if (hasEvidence) {
      updated[skillKey] = "verified";
    } else if (hasBasicMention) {
      updated[skillKey] = "partially_verified";
    }
  }

  // Mark missing JD skills that were acknowledged as gaps
  for (const missingSkill of intelligence.missingSkills) {
    const key = norm(missingSkill);
    if (updated[key] === "unverified") {
      const gapAcknowledged = new RegExp(
        `(haven'?t|haven'?t used|not experienced|don'?t have|working on|learning|would need).*${key}|(${key}).*(not yet|learning|would)`,
        "i",
      ).test(candidateText);
      if (gapAcknowledged) updated[key] = "gap_acknowledged";
    }
  }

  return updated;
}

export function getVerifiedSkills(tracker: EvidenceTracker): string[] {
  return Object.entries(tracker)
    .filter(([, status]) => status === "verified")
    .map(([key]) => key);
}

export function getUnverifiedSkills(tracker: EvidenceTracker): string[] {
  return Object.entries(tracker)
    .filter(([, status]) => status === "unverified")
    .map(([key]) => key);
}

export function serializeEvidenceTracker(tracker: EvidenceTracker): string {
  const lines: string[] = ["EVIDENCE TRACKER:"];
  const groups: Record<EvidenceStatus, string[]> = {
    verified: [],
    partially_verified: [],
    unverified: [],
    contradicted: [],
    gap_acknowledged: [],
  };
  for (const [skill, status] of Object.entries(tracker)) {
    groups[status].push(skill);
  }
  if (groups.verified.length) lines.push(`  Verified: ${groups.verified.join(", ")}`);
  if (groups.partially_verified.length) lines.push(`  Partial: ${groups.partially_verified.join(", ")}`);
  if (groups.unverified.length) lines.push(`  Unverified: ${groups.unverified.join(", ")}`);
  if (groups.contradicted.length) lines.push(`  Contradicted: ${groups.contradicted.join(", ")}`);
  if (groups.gap_acknowledged.length) lines.push(`  Gap acknowledged: ${groups.gap_acknowledged.join(", ")}`);
  lines.push("  Rule: Do NOT ask again about verified skills. Focus on unverified and gap areas.");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — FOLLOW-UP ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export type FollowUpTrigger =
  | "vague_answer"
  | "missing_metric"
  | "missing_ownership"
  | "missing_tool"
  | "missing_outcome"
  | "too_short"
  | "team_speak"
  | "good_answer_depth";

export type FollowUpDecision = {
  shouldFollowUp: boolean;
  trigger: FollowUpTrigger | null;
  followUpQuestion: string;
  drillQuestions: string[];
  stayOnCurrentQuestion: boolean;
};

export function buildFollowUpDecision(input: {
  candidateAnswer: string;
  recruiterQuestion: string;
  skill?: string;
  targetRole?: string;
  followupCount?: number;
  isFresher?: boolean;
}): FollowUpDecision {
  const answer = clean(input.candidateAnswer, 1000);
  const question = clean(input.recruiterQuestion, 300);
  const role = clean(input.targetRole, 80) || "this role";
  const followupCount = input.followupCount ?? 0;
  const isFresher = input.isFresher ?? false;
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  const hasMetric = /\b(\d+%|\d+ percent|reduced|increased|improved|saved|delivered|achieved|\$\d|\d+ (users?|customers?|tickets?|hours?|days?|weeks?))\b/i.test(answer);
  const hasOwnership = /\b(i\s+(built|wrote|led|created|designed|implemented|owned|managed|handled|developed|deployed|resolved|launched|automated|improved))\b/i.test(answer);
  const hasOutcome = /\b(result|outcome|impact|what changed|which meant|so that|therefore|as a result|which led to|ultimately)\b/i.test(answer);
  const hasTool = /\b(using|with|in|via|through)\s+[A-Z][a-z]+/i.test(answer);
  const isTeamSpeak = /\b(we|our team|the team|we built|we did|we implemented)\b/i.test(answer) && !hasOwnership;
  const isVague = wordCount < 25 || /\b(generally|usually|often|typically|i would|we would|in general|as much as possible|things like)\b/i.test(answer);
  const isTooShort = wordCount < 15;
  const maxFollowups = 3;

  if (followupCount >= maxFollowups) {
    return {
      shouldFollowUp: false,
      trigger: null,
      followUpQuestion: "",
      drillQuestions: [],
      stayOnCurrentQuestion: false,
    };
  }

  // Priority order for follow-up triggers
  if (isTooShort) {
    return {
      shouldFollowUp: true,
      trigger: "too_short",
      followUpQuestion: isFresher
        ? `Take your time — can you walk me through that in a bit more detail? Even an academic or personal project works.`
        : `Can you give me a bit more detail on that? Walk me through a specific example.`,
      drillQuestions: isFresher
        ? [
            "What was the goal of that project or task?",
            "What did you personally work on?",
            "What did you learn from it?",
          ]
        : [
            "What exactly did you do in that situation?",
            "What was the end result?",
            "Who else was involved, and what was your specific role?",
          ],
      stayOnCurrentQuestion: true,
    };
  }

  if (isTeamSpeak) {
    return {
      shouldFollowUp: true,
      trigger: "team_speak",
      followUpQuestion: isFresher
        ? `It sounds like it was a team effort — which part did you personally work on? Even a small piece is fine.`
        : `I hear the team's involvement — but what did YOU specifically own in that? What wouldn't have happened without you?`,
      drillQuestions: isFresher
        ? [
            "What was your specific task in that project?",
            "What did you build or write yourself?",
            "What would you do differently if you did it again?",
          ]
        : [
            "What was your personal contribution?",
            "What decisions did you make independently?",
            "If you hadn't been there, what would have been different?",
          ],
      stayOnCurrentQuestion: true,
    };
  }

  if (isVague && !hasOutcome) {
    return {
      shouldFollowUp: true,
      trigger: "vague_answer",
      followUpQuestion: `That's a bit general. Give me one specific real situation — what happened, what you did, and what the result was.`,
      drillQuestions: [
        "What was the actual situation or problem?",
        "What specifically did you do?",
        "What changed because of your actions?",
      ],
      stayOnCurrentQuestion: true,
    };
  }

  if (!hasOwnership && !isVague) {
    return {
      shouldFollowUp: true,
      trigger: "missing_ownership",
      followUpQuestion: `Understood — but I want to understand your personal role. What did you own end-to-end in that situation?`,
      drillQuestions: [
        "Were you the decision-maker, or were you supporting someone?",
        "What would you have done differently if you had full ownership?",
      ],
      stayOnCurrentQuestion: true,
    };
  }

  if (!hasMetric && hasOwnership) {
    return {
      shouldFollowUp: true,
      trigger: "missing_metric",
      followUpQuestion: `Good — can you put a number on that? Even rough: time saved, customer impact, error rate, cost reduction?`,
      drillQuestions: [
        "How did you measure success?",
        "What metric changed after your work?",
        "How many people, systems, or records were affected?",
      ],
      stayOnCurrentQuestion: true,
    };
  }

  if (!hasOutcome && hasOwnership && hasMetric) {
    return {
      shouldFollowUp: true,
      trigger: "missing_outcome",
      followUpQuestion: `What was the final outcome — did it achieve what you intended? What did stakeholders say?`,
      drillQuestions: [
        "What happened after you delivered this?",
        "Was the business problem actually solved?",
      ],
      stayOnCurrentQuestion: false,
    };
  }

  if (input.skill && !hasTool) {
    return {
      shouldFollowUp: true,
      trigger: "missing_tool",
      followUpQuestion: `Which specific tool or technology did you use for that? And how deeply did you work with it?`,
      drillQuestions: [
        `Walk me through one ${input.skill} task you built from scratch.`,
        `What was the most complex part of using ${input.skill} in that context?`,
      ],
      stayOnCurrentQuestion: false,
    };
  }

  // Good answer — depth question
  const depthQuestions: Record<string, string> = {
    sql: `Now go deeper: walk me through the most complex SQL query you've written — what tables, what joins, what business problem did it solve?`,
    python: `Give me a Python task where you had to go beyond basics — what libraries, what challenge, what did the output do?`,
    tableau: `Walk me through a Tableau dashboard you built end-to-end — data source, transforms, audience, and how they used it.`,
    "power bi": `Describe a Power BI report where the insight changed a stakeholder decision — what was the decision?`,
    "stakeholder management": `Tell me about a time a stakeholder pushed back hard on your recommendation — how did you handle it?`,
    "a/b testing": `Walk me through an A/B test from hypothesis to decision — what did you learn and what changed?`,
    default: `Good. Now take me to the hardest part of that — what would have gone wrong if you hadn't been there?`,
  };

  const skillKey = norm(input.skill || "");
  const depthQ = depthQuestions[skillKey] || depthQuestions.default;

  return {
    shouldFollowUp: true,
    trigger: "good_answer_depth",
    followUpQuestion: depthQ,
    drillQuestions: [],
    stayOnCurrentQuestion: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — CONTRADICTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateClaim = {
  text: string;
  skill?: string;
  metric?: string;
  company?: string;
  role?: string;
  turnIndex: number;
  timestamp?: string;
};

export type ContradictionResult = {
  hasContradiction: boolean;
  claim1?: CandidateClaim;
  claim2?: CandidateClaim;
  challengeQuestion?: string;
  severity: "none" | "low" | "medium" | "high";
};

export function extractAndStoreClaims(
  transcript: WorkZoEvidenceTranscriptItem[],
): CandidateClaim[] {
  const claims: CandidateClaim[] = [];
  const candidateTurns = (transcript || []).filter(t =>
    /candidate|user/i.test(String(t.role || t.speaker || "")),
  );

  for (let i = 0; i < candidateTurns.length; i++) {
    const turn = candidateTurns[i];
    const text = clean(turn.text, 400);
    if (!text) continue;

    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const isPersonalClaim =
        /\b(i\s+(built|used|created|led|wrote|managed|implemented|designed|owned|never|don'?t|didn'?t|haven'?t|always|was responsible|worked at|joined|studied))\b/i.test(sentence);
      if (!isPersonalClaim) continue;

      const metricMatch = sentence.match(/(\d+)\s*(%|years?|months?|users?|customers?|projects?|teams?)/i);
      const companyMatch = sentence.match(/\bat\s+([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3})/);
      const roleMatch = sentence.match(/\bas\s+(?:a|an\s+)?([A-Z][A-Za-z ]+(?:Engineer|Analyst|Manager|Developer|Designer|Specialist|Lead|Director|Officer|Executive|Consultant|Coordinator))/i);

      claims.push({
        text: clean(sentence, 200),
        metric: metricMatch ? metricMatch[0] : undefined,
        company: companyMatch ? companyMatch[1] : undefined,
        role: roleMatch ? roleMatch[1] : undefined,
        turnIndex: i,
        timestamp: turn.time,
      });
    }
  }

  return claims;
}

export function detectContradictions(
  claims: CandidateClaim[],
): ContradictionResult {
  // Detect "never used X" vs "I used X"
  const neverClaims = claims.filter(c =>
    /\b(never|don'?t have|haven'?t used|no experience|not familiar)\b/i.test(c.text),
  );
  const usedClaims = claims.filter(c =>
    /\b(i\s+(used|built|implemented|worked with|created|designed|developed))\b/i.test(c.text),
  );

  for (const neverClaim of neverClaims) {
    for (const usedClaim of usedClaims) {
      if (usedClaim.turnIndex <= neverClaim.turnIndex) continue;
      // Check if they refer to same skill
      const neverNorm = norm(neverClaim.text);
      const usedNorm = norm(usedClaim.text);
      const skillOverlap = KNOWN_SKILLS.some(skill => {
        const sk = norm(skill);
        return neverNorm.includes(sk) && usedNorm.includes(sk);
      });
      if (skillOverlap) {
        return {
          hasContradiction: true,
          claim1: neverClaim,
          claim2: usedClaim,
          challengeQuestion: `Earlier you mentioned having no experience with this, but just now you described using it. Can you clarify — have you used this before, and in what context?`,
          severity: "high",
        };
      }
    }
  }

  // Detect metric contradictions (vastly different numbers for same context)
  const metricClaims = claims.filter(c => c.metric);
  for (let i = 0; i < metricClaims.length; i++) {
    for (let j = i + 1; j < metricClaims.length; j++) {
      const a = metricClaims[i];
      const b = metricClaims[j];
      if (b.turnIndex === a.turnIndex) continue;
      const aNum = Number((a.metric || "").match(/\d+/)?.[0] || 0);
      const bNum = Number((b.metric || "").match(/\d+/)?.[0] || 0);
      if (aNum > 0 && bNum > 0 && Math.abs(aNum - bNum) / Math.max(aNum, bNum) > 0.5) {
        const nA = norm(a.text);
        const nB = norm(b.text);
        // Only flag if they mention the same skill or context
        const contextOverlap = KNOWN_SKILLS.some(sk => nA.includes(norm(sk)) && nB.includes(norm(sk)));
        if (contextOverlap) {
          return {
            hasContradiction: true,
            claim1: a,
            claim2: b,
            challengeQuestion: `Earlier you mentioned ${a.metric}, but just now you said ${b.metric} in what sounds like the same context. Can you help me reconcile those numbers?`,
            severity: "medium",
          };
        }
      }
    }
  }

  return { hasContradiction: false, severity: "none" };
}

export function serializeContradictionEngine(
  claims: CandidateClaim[],
  contradiction: ContradictionResult,
): string {
  const lines: string[] = ["CONTRADICTION ENGINE:"];
  lines.push(`  Claims stored: ${claims.length}`);
  if (contradiction.hasContradiction) {
    lines.push(`  ⚠️ CONTRADICTION DETECTED (${contradiction.severity})`);
    lines.push(`  Claim A: "${contradiction.claim1?.text?.slice(0, 100)}"`);
    lines.push(`  Claim B: "${contradiction.claim2?.text?.slice(0, 100)}"`);
    lines.push(`  Challenge: ${contradiction.challengeQuestion}`);
    lines.push(`  Action: Ask challenge question BEFORE next planned question.`);
  } else {
    lines.push(`  No contradictions detected. Continue with planned questions.`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — SCENARIO ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export type ScenarioQuestion = {
  skill: string;
  scenario: string;
  probeDepth: string;
};

const SCENARIO_TEMPLATES: Record<string, (role?: string) => string> = {
  sql: () =>
    `A senior analyst reports that a dashboard query is returning different totals than the source table. Walk me through exactly how you'd diagnose and fix that.`,
  "power bi": () =>
    `A VP flags that two Power BI reports show conflicting revenue figures for the same quarter. Where do you start, and how do you resolve it?`,
  tableau: () =>
    `A Tableau dashboard used by the leadership team suddenly shows a 40% drop in sales for yesterday. Before alerting anyone, how do you investigate?`,
  python: () =>
    `Your ETL script runs fine locally but crashes in production halfway through a 500k-row import. What's your debugging process?`,
  "stakeholder management": () =>
    `A key stakeholder disagrees with your analysis and wants to go with their own numbers in the executive presentation. How do you handle that?`,
  "a/b testing": () =>
    `You run an A/B test that shows the variant wins on clicks but loses on conversion. How do you decide which to ship?`,
  "customer success": (role?: string) =>
    `A customer is 30 days from renewal and flags that they haven't seen value yet. You're their ${role || "CSM"}. Walk me through your action plan.`,
  "technical support": () =>
    `A VIP customer calls in escalation at 5pm on a Friday — their system is down, your team can't reproduce it, and the developer is offline. What do you do?`,
  agile: () =>
    `Halfway through a sprint, the product owner wants to add three high-priority features. How do you handle it without derailing the team?`,
  "machine learning": () =>
    `Your model goes live and accuracy drops significantly in week 2. How do you determine if it's data drift, a bug, or a feature issue?`,
  "data pipeline": () =>
    `Your daily ETL pipeline fails silently and stakeholders don't notice for two days. How do you both fix it and prevent this happening again?`,
  looker: () =>
    `The marketing team says Looker numbers don't match what's in Salesforce. Walk me through how you'd resolve the discrepancy.`,
  aws: () =>
    `Production costs spike 3x overnight on AWS. You get a call at 7am. What's your process?`,
  salesforce: () =>
    `Your Salesforce pipeline report shows 30% of deals in "Proposal" for over 90 days. How do you identify what's real versus stuck?`,
  "project management": () =>
    `Your project is 2 weeks behind with a fixed launch date. The client doesn't know yet. How do you handle the next 48 hours?`,
  "change management": () =>
    `A team of 40 people is resisting a new process rollout. Half of them are senior staff with 10+ years of doing it the old way. How do you approach this?`,
};

const FRESHER_SCENARIO_TEMPLATES: Record<string, string> = {
  sql: `You have a table of student grades. Write a simple query to find the top 5 students by average score. Walk me through your thinking.`,
  python: `You have a CSV file of sales data and you need to find which product sold the most units last month. How would you approach that in Python?`,
  "power bi": `Your manager asks you to build a simple dashboard showing monthly sales by region from an Excel file. What's the first thing you'd do?`,
  tableau: `You're given a spreadsheet of customer orders and asked to visualise sales trends over the last 6 months. How would you approach building that in Tableau?`,
  "machine learning": `You want to build a model to predict whether a customer will cancel their subscription. What data would you collect, and what algorithm would you try first?`,
  agile: `You're part of a small team working on a 2-week sprint. Halfway through, a new requirement is added. How would you and the team decide what to do?`,
  "stakeholder management": `A classmate disagrees with your approach to a group project presentation. How do you handle it?`,
  default: `Imagine you're given a dataset of 10,000 customer transactions and asked to summarise the key trends for a manager. Walk me through how you'd start.`,
};

export function buildScenarioQuestions(
  intelligence: InterviewIntelligenceLayer,
  count = 3,
  isFresher = false,
): ScenarioQuestion[] {
  const scenarios: ScenarioQuestion[] = [];
  const skillsToProbe = [
    ...intelligence.matchedSkills,
    ...intelligence.jdRequiredSkills,
  ];

  for (const skill of skillsToProbe) {
    if (scenarios.length >= count) break;
    const key = norm(skill);

    if (isFresher) {
      // Use simplified fresher scenario templates
      const fresherEntry = Object.entries(FRESHER_SCENARIO_TEMPLATES).find(([k]) =>
        key.includes(norm(k)) || norm(k).includes(key),
      );
      if (!fresherEntry) continue;
      scenarios.push({
        skill,
        scenario: fresherEntry[1],
        probeDepth: `For freshers: ask "How did you learn about this?" or "Have you tried this in a project?" — not a high-pressure crisis question.`,
      });
    } else {
      const templateFn = Object.entries(SCENARIO_TEMPLATES).find(([k]) =>
        key.includes(norm(k)),
      )?.[1];
      if (!templateFn) continue;
      scenarios.push({
        skill,
        scenario: templateFn(),
        probeDepth: `After their answer, ask: "What's the first thing you'd actually do in the first 5 minutes?" to check if they default to theory or action.`,
      });
    }
  }

  // Fallback
  if (scenarios.length < count) {
    scenarios.push({
      skill: "Problem Solving",
      scenario: isFresher
        ? FRESHER_SCENARIO_TEMPLATES.default
        : `You discover a recurring issue that is affecting multiple customers but hasn't been escalated to your team yet. How do you triage, diagnose, and resolve it — and what do you communicate and to whom?`,
      probeDepth: isFresher
        ? `Ask: "Have you done something similar in a project or coursework?"`
        : `Ask: "What's the first stakeholder you'd contact, and what would you say?"`,
    });
  }

  return scenarios.slice(0, count);
}

export function serializeScenarioEngine(scenarios: ScenarioQuestion[]): string {
  const lines: string[] = ["SCENARIO ENGINE (use these instead of generic skill questions):"];
  for (const s of scenarios) {
    lines.push(`  [${s.skill}] ${s.scenario}`);
    lines.push(`  → Probe: ${s.probeDepth}`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — ADAPTIVE DIFFICULTY
// ─────────────────────────────────────────────────────────────────────────────

export type DifficultyQuestion = {
  skill: string;
  level: RoleLevel;
  question: string;
};

const DIFFICULTY_LADDER: Record<string, Record<RoleLevel, string>> = {
  sql: {
    junior: `What is a LEFT JOIN and how is it different from an INNER JOIN?`,
    mid: `When would you choose a LEFT JOIN over an INNER JOIN, and what happens to NULL values in the result?`,
    senior: `You have a query joining 4 tables on a 100M-row fact table and it's running in 90 seconds. Walk me through your optimization approach.`,
    unknown: `Describe a SQL query you wrote that solved a real business problem — walk me through it.`,
  },
  python: {
    junior: `What's the difference between a list and a dictionary in Python?`,
    mid: `How would you handle reading a 2GB CSV in Python without running out of memory?`,
    senior: `Walk me through how you'd design a Python ETL pipeline that's fault-tolerant, scalable, and observable in production.`,
    unknown: `Describe a Python script you wrote that automated something — what was the problem, what did it do, and what was the impact?`,
  },
  "power bi": {
    junior: `What's the difference between a measure and a calculated column in Power BI?`,
    mid: `How would you optimise a Power BI report that loads slowly for end users?`,
    senior: `Describe how you'd architect a Power BI solution for an enterprise with 200 report consumers, row-level security, and a live Snowflake source.`,
    unknown: `Walk me through a Power BI dashboard you built — what was the data source, who used it, and what decision did it drive?`,
  },
  tableau: {
    junior: `What is a calculated field in Tableau and when would you use one?`,
    mid: `How would you connect Tableau to multiple data sources and blend them — what are the limitations?`,
    senior: `You need to build a Tableau dashboard for a C-suite audience that auto-refreshes with live data and has drill-down by region. How do you architect it?`,
    unknown: `Describe a Tableau dashboard you built that changed how someone made a decision.`,
  },
  "machine learning": {
    junior: `What's the difference between supervised and unsupervised learning?`,
    mid: `How would you decide between a logistic regression and a random forest for a binary classification problem?`,
    senior: `Walk me through how you'd monitor a production ML model for drift and retrain it without downtime.`,
    unknown: `Describe a machine learning model you built — what was the problem, what algorithm, how did you validate it?`,
  },
  agile: {
    junior: `What's the difference between a sprint and a backlog?`,
    mid: `How do you handle scope creep mid-sprint from a stakeholder who outranks the product owner?`,
    senior: `How would you introduce agile practices into a 60-person organization that has always worked in waterfall?`,
    unknown: `Describe a sprint that went wrong — what happened and what did you do?`,
  },
  "stakeholder management": {
    junior: `How do you keep a stakeholder updated on project progress?`,
    mid: `A stakeholder is unhappy with your work but hasn't told you directly. How do you find out and address it?`,
    senior: `You need to get budget approved for a project that 3 VPs disagree on. How do you build alignment?`,
    unknown: `Tell me about a difficult stakeholder situation you navigated — what did you do and what was the outcome?`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FRESHER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const FRESHER_SIGNALS = [
  /\b(b\.?sc|b\.?tech|b\.?e\.?|b\.?a\.?|m\.?sc|m\.?tech|bachelor|master|degree|diploma|pgdm|mba)\b/i,
  /\b(university|college|institute|school of|faculty of)\b/i,
  /\b(2022|2023|2024|2025)\s*(graduate|batch|pass(out|ing)?|grad)\b/i,
  /\b(final year|third year|second year|first year)\b/i,
  /\b(fresher|fresh graduate|recently graduated|new graduate|just graduated|newly graduated)\b/i,
  /\b(bootcamp|coding school|data science course|nanodegree|udemy|coursera|edx|upgrad|simplilearn|coursework)\b/i,
  /\b(capstone|dissertation|final project|final year project|thesis)\b/i,
  /\b(no work experience|0 years|zero years|no professional experience|no prior experience)\b/i,
  /\b(academic project|personal project|hobby project|side project|self project|self-taught)\b/i,
  /\b(internship|intern at|interned at|6[\s-]?month intern|summer intern|winter intern)\b/i,
];

const EXPERIENCED_COUNTER_SIGNALS = [
  /\b(\d{1,2})\+?\s*years?\s*(of\s*)?(professional\s*)?experience\b/i,
  /\b(full[- ]time|permanent|full time employee|employed at|joined as)\b/i,
  /\b(promoted|promotion|appraisal|performance review|annual review)\b/i,
];

export function detectIsFresher(cvText: string): boolean {
  const raw = String(cvText || "");
  for (const pattern of EXPERIENCED_COUNTER_SIGNALS) {
    const match = raw.match(pattern);
    if (match) {
      const yearsMatch = match[0].match(/(\d+)/);
      if (yearsMatch && Number(yearsMatch[1]) >= 2) return false;
    }
  }
  const hits = FRESHER_SIGNALS.filter(p => p.test(raw)).length;
  return hits >= 2;
}

export function detectRoleLevel(input: {
  targetRole?: string;
  cvText?: string;
  cvExperience?: string[];
  transcript?: WorkZoEvidenceTranscriptItem[];
}): RoleLevel {
  const roleLower = norm(input.targetRole || "");
  const rawCv = String(input.cvText || "");
  const cvText = norm(rawCv);
  const experienceTitles = (input.cvExperience || []).map(norm).join(" ");
  const cvAndExp = cvText + " " + experienceTitles;

  // 1. Role title
  if (/\b(junior|jr|graduate|entry|intern|assistant|trainee|fresher|entry.level)\b/.test(roleLower)) return "junior";
  if (/\b(senior|sr|lead|principal|head|director|manager|vp|chief|staff)\b/.test(roleLower)) return "senior";

  // 2. Fresher signals from CV
  if (detectIsFresher(rawCv)) return "junior";

  // 3. Explicit years line
  const yearsMatch = rawCv.match(/(\d+)\+?\s*years?\s*(of\s*)?(professional\s*|work\s*)?experience/i);
  if (yearsMatch) {
    const years = Number(yearsMatch[1]);
    if (years <= 2) return "junior";
    if (years >= 6) return "senior";
    return "mid";
  }

  // 4. Title scan
  if (/\b(senior|lead|principal|head|director|vp|chief|manager)\b/.test(cvAndExp)) return "senior";
  if (/\b(junior|jr|graduate|entry|intern|trainee|fresher)\b/.test(cvAndExp)) return "junior";
  if (/\b(mid.level|mid level|associate|3 years|4 years|5 years)\b/.test(cvAndExp)) return "mid";

  // 5. Education-only CV with no work experience section = fresher
  const hasExperienceSection = /\b(work experience|professional experience|employment|career history|job history)\b/i.test(rawCv);
  if (!hasExperienceSection && /\b(education|academic|university|college|degree|bachelor|master)\b/i.test(rawCv)) {
    return "junior";
  }

  return "unknown";
}


export function buildAdaptiveDifficultyQuestions(
  intelligence: InterviewIntelligenceLayer,
  roleLevel: RoleLevel,
  count = 5,
): DifficultyQuestion[] {
  const questions: DifficultyQuestion[] = [];
  const skills = [
    ...intelligence.matchedSkills,
    ...intelligence.cvSkills,
    ...intelligence.jdRequiredSkills,
  ];

  for (const skill of skills) {
    if (questions.length >= count) break;
    const key = norm(skill);
    const ladderEntry = Object.entries(DIFFICULTY_LADDER).find(([k]) =>
      key.includes(norm(k)) || norm(k).includes(key),
    );
    if (!ladderEntry) continue;
    const [, ladder] = ladderEntry;
    const question = ladder[roleLevel] || ladder.unknown;
    if (questions.some(q => q.question === question)) continue;
    questions.push({ skill, level: roleLevel, question });
  }

  return questions;
}

export function serializeAdaptiveDifficulty(
  questions: DifficultyQuestion[],
  roleLevel: RoleLevel,
): string {
  const lines: string[] = [`ADAPTIVE DIFFICULTY (level: ${roleLevel.toUpperCase()}):`];
  lines.push(`  Questions are calibrated to ${roleLevel} depth. Do not ask junior questions to a senior, or vice versa.`);
  for (const q of questions) {
    lines.push(`  [${q.skill}] ${q.question}`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 8 — RECRUITER MEMORY
// ─────────────────────────────────────────────────────────────────────────────

export type RecruiterMemoryState = {
  alreadyAsked: string[];
  verifiedSkills: string[];
  weakAreas: string[];
  strongAreas: string[];
  openClaims: string[];
  contradictionsRaised: string[];
  questionsAsked: number;
  lastQuestionCategory: QuestionCategory | null;
};

export function createEmptyRecruiterMemory(): RecruiterMemoryState {
  return {
    alreadyAsked: [],
    verifiedSkills: [],
    weakAreas: [],
    strongAreas: [],
    openClaims: [],
    contradictionsRaised: [],
    questionsAsked: 0,
    lastQuestionCategory: null,
  };
}

export function updateRecruiterMemory(
  memory: RecruiterMemoryState,
  input: {
    questionAsked: string;
    candidateAnswer: string;
    skill?: string;
    evidenceStatus?: EvidenceStatus;
    questionCategory?: QuestionCategory;
  },
): RecruiterMemoryState {
  const updated = { ...memory };
  const question = clean(input.questionAsked, 200);
  const answer = clean(input.candidateAnswer, 500);

  updated.alreadyAsked = [...new Set([...updated.alreadyAsked, question])].slice(-30);
  updated.questionsAsked += 1;
  updated.lastQuestionCategory = input.questionCategory || null;

  if (input.skill) {
    const skillKey = input.skill.toLowerCase();
    if (input.evidenceStatus === "verified") {
      updated.verifiedSkills = [...new Set([...updated.verifiedSkills, skillKey])];
      updated.weakAreas = updated.weakAreas.filter(s => s !== skillKey);
    }
    if (input.evidenceStatus === "partially_verified") {
      if (!updated.verifiedSkills.includes(skillKey) && !updated.weakAreas.includes(skillKey)) {
        updated.weakAreas = [...updated.weakAreas, skillKey].slice(-12);
      }
    }
  }

  // Detect strong vs weak answers
  const hasEvidence =
    /\b(\d+%|\d+ (users?|customers?|saved|reduced|improved))\b/i.test(answer) &&
    /\b(i built|i led|i designed|i implemented|i owned)\b/i.test(answer);
  const isWeak =
    answer.split(/\s+/).length < 20 ||
    /\b(generally|usually|we tend to|i would|i think|maybe|not sure)\b/i.test(answer);

  if (hasEvidence && input.skill) {
    updated.strongAreas = [...new Set([...updated.strongAreas, input.skill])].slice(-10);
  }
  if (isWeak && input.skill) {
    const sk = input.skill.toLowerCase();
    if (!updated.weakAreas.includes(sk)) {
      updated.weakAreas = [...updated.weakAreas, sk].slice(-10);
    }
  }

  return updated;
}

export function serializeRecruiterMemory(memory: RecruiterMemoryState): string {
  const lines: string[] = ["RECRUITER MEMORY:"];
  lines.push(`  Questions asked so far: ${memory.questionsAsked}`);
  if (memory.verifiedSkills.length) lines.push(`  Verified skills (STOP asking): ${memory.verifiedSkills.join(", ")}`);
  if (memory.strongAreas.length) lines.push(`  Strong areas: ${memory.strongAreas.join(", ")}`);
  if (memory.weakAreas.length) lines.push(`  Weak areas (probe more): ${memory.weakAreas.join(", ")}`);
  if (memory.alreadyAsked.length > 0) {
    lines.push(`  Last ${Math.min(5, memory.alreadyAsked.length)} questions asked:`);
    for (const q of memory.alreadyAsked.slice(-5)) lines.push(`    - ${q.slice(0, 100)}`);
  }
  lines.push(`  Rule: NEVER repeat a question from the "already asked" list. NEVER re-test verified skills.`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9 — RESULTS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewScoreBreakdown = {
  communication: number;
  technicalEvidence: number;
  projectDepth: number;
  stakeholderThinking: number;
  jdFit: number;
  confidence: number;
  overall: number;
  summary: string;
  recommendation: "strong_yes" | "yes" | "maybe" | "no" | "strong_no";
  hiringRisk: string[];
  standoutStrengths: string[];
};

export function buildResultsScore(
  intelligence: InterviewIntelligenceLayer,
  memory: RecruiterMemoryState,
  transcript: WorkZoEvidenceTranscriptItem[],
  evidenceTracker: EvidenceTracker,
): InterviewScoreBreakdown {
  const candidateTurns = (transcript || [])
    .filter(t => /candidate|user/i.test(String(t.role || t.speaker || "")))
    .map(t => clean(t.text, 600));

  const fullText = candidateTurns.join(" ");
  const wordCounts = candidateTurns.map(t => t.split(/\s+/).filter(Boolean).length);
  const avgWords = wordCounts.length ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0;

  // Communication: clarity, sentence length, avoiding vague language
  const vagueCount = (fullText.match(/\b(generally|usually|might|kind of|sort of|i think maybe|not sure|we tend to)\b/gi) || []).length;
  const structuredCount = (fullText.match(/\b(first|then|finally|as a result|which led to|because|therefore|the outcome was|the result was)\b/gi) || []).length;
  const communication = Math.min(10, Math.max(1,
    5 +
    (avgWords > 50 ? 1.5 : avgWords > 30 ? 0.8 : -1) +
    (structuredCount > 3 ? 1.5 : structuredCount > 1 ? 0.8 : 0) +
    (vagueCount > 6 ? -2 : vagueCount > 3 ? -1 : 0),
  ));

  // Technical Evidence: verified skills with depth
  const verifiedCount = Object.values(evidenceTracker).filter(s => s === "verified").length;
  const partialCount = Object.values(evidenceTracker).filter(s => s === "partially_verified").length;
  const totalSkills = Object.keys(evidenceTracker).length || 1;
  const technicalSignals = (fullText.match(/\b(query|function|algorithm|deploy|pipeline|architecture|model|schema|endpoint|library|module|script|loop|condition|parameter|variable|api|cache|index|migration|server|container)\b/gi) || []).length;
  const technicalEvidence = Math.min(10, Math.max(1,
    3 +
    (verifiedCount / totalSkills) * 4 +
    (partialCount / totalSkills) * 1.5 +
    (technicalSignals > 10 ? 2 : technicalSignals > 5 ? 1 : 0),
  ));

  // Project Depth: did they go deep on CV projects?
  const projectMentions = intelligence.cvProjects.filter(p =>
    fullText.toLowerCase().includes(p.toLowerCase().slice(0, 12)),
  ).length;
  const metricsInText = (fullText.match(/\d+\s*(%|users?|customers?|hours?|days?|rows?|records?|tickets?|ms|seconds?|faster|cheaper|saved)/gi) || []).length;
  const ownershipPhrases = (fullText.match(/\b(i built|i designed|i led|i owned|i created|i implemented|i wrote|my responsibility)\b/gi) || []).length;
  const projectDepth = Math.min(10, Math.max(1,
    3 +
    projectMentions * 1.5 +
    (metricsInText > 4 ? 2.5 : metricsInText > 2 ? 1.5 : 0) +
    (ownershipPhrases > 3 ? 2 : ownershipPhrases > 1 ? 1 : 0),
  ));

  // Stakeholder Thinking: cross-functional, business context
  const stakeholderSignals = (fullText.match(/\b(stakeholder|customer|client|business|decision|impact|priority|requirement|feedback|executive|leadership|cross-functional|alignment|presented|reported|escalated)\b/gi) || []).length;
  const businessOutcomes = (fullText.match(/\b(revenue|cost|efficiency|satisfaction|churn|conversion|retention|adoption|risk|compliance|delivery)\b/gi) || []).length;
  const stakeholderThinking = Math.min(10, Math.max(1,
    4 +
    (stakeholderSignals > 8 ? 3 : stakeholderSignals > 4 ? 1.5 : 0) +
    (businessOutcomes > 3 ? 2 : businessOutcomes > 1 ? 1 : 0),
  ));

  // JD Fit: how many required skills evidenced + scenario handling
  const jdSkillsCovered = intelligence.jdRequiredSkills.filter(skill =>
    fullText.toLowerCase().includes(norm(skill)),
  ).length;
  const jdTotal = intelligence.jdRequiredSkills.length || 1;
  const jdFit = Math.min(10, Math.max(1,
    3 +
    (jdSkillsCovered / jdTotal) * 5 +
    (memory.strongAreas.length > 3 ? 2 : memory.strongAreas.length > 1 ? 1 : 0),
  ));

  // Confidence: answer length, hedging language, direct ownership
  const hedging = (fullText.match(/\b(i think|maybe|probably|not sure|kind of|i guess|hopefully|i believe it was)\b/gi) || []).length;
  const directAssertions = (fullText.match(/\b(i did|i built|i decided|i chose|i improved|i delivered|i owned|i solved)\b/gi) || []).length;
  const confidence = Math.min(10, Math.max(1,
    5 +
    (directAssertions > 5 ? 2.5 : directAssertions > 2 ? 1 : 0) +
    (hedging > 6 ? -2.5 : hedging > 3 ? -1 : 0) +
    (avgWords > 60 ? 1 : avgWords < 20 ? -1 : 0),
  ));

  const overall = Math.round(
    (communication + technicalEvidence + projectDepth + stakeholderThinking + jdFit + confidence) / 6 * 10,
  ) / 10;

  const recommendation =
    overall >= 8.5 ? "strong_yes" :
    overall >= 7.0 ? "yes" :
    overall >= 5.5 ? "maybe" :
    overall >= 4.0 ? "no" : "strong_no";

  const hiringRisk: string[] = [];
  if (communication < 5) hiringRisk.push("Communication clarity is below threshold — may struggle with stakeholder-facing work");
  if (technicalEvidence < 5) hiringRisk.push("Technical depth not demonstrated with concrete evidence");
  if (hedging > 8) hiringRisk.push("Excessive hedging language suggests low confidence or exaggeration");
  if (memory.weakAreas.length > 4) hiringRisk.push(`Multiple weak areas: ${memory.weakAreas.slice(0, 3).join(", ")}`);
  if (jdFit < 5) hiringRisk.push("Key JD requirements not evidenced in answers");

  const standoutStrengths: string[] = [];
  if (communication >= 8) standoutStrengths.push("Clear, structured communicator");
  if (technicalEvidence >= 8) standoutStrengths.push("Strong technical evidence with specifics");
  if (projectDepth >= 8) standoutStrengths.push("Deep project ownership with measurable outcomes");
  if (stakeholderThinking >= 8) standoutStrengths.push("Strong business and stakeholder awareness");
  if (jdFit >= 8) standoutStrengths.push("Excellent match to JD requirements");
  if (confidence >= 8) standoutStrengths.push("Confident, direct communicator with clear ownership");

  const summary = [
    `Overall score: ${overall}/10 (${recommendation.replace(/_/g, " ")})`,
    standoutStrengths.length ? `Strengths: ${standoutStrengths.join("; ")}` : "",
    hiringRisk.length ? `Risks: ${hiringRisk.join("; ")}` : "No significant risks detected",
  ].filter(Boolean).join(" | ");

  return {
    communication: Math.round(communication * 10) / 10,
    technicalEvidence: Math.round(technicalEvidence * 10) / 10,
    projectDepth: Math.round(projectDepth * 10) / 10,
    stakeholderThinking: Math.round(stakeholderThinking * 10) / 10,
    jdFit: Math.round(jdFit * 10) / 10,
    confidence: Math.round(confidence * 10) / 10,
    overall,
    summary,
    recommendation,
    hiringRisk,
    standoutStrengths,
  };
}

export function serializeResultsEngine(scores: InterviewScoreBreakdown): string {
  const lines: string[] = ["RESULTS ENGINE (evidence-based scoring):"];
  lines.push(`  Communication:       ${scores.communication}/10`);
  lines.push(`  Technical Evidence:  ${scores.technicalEvidence}/10`);
  lines.push(`  Project Depth:       ${scores.projectDepth}/10`);
  lines.push(`  Stakeholder Thinking:${scores.stakeholderThinking}/10`);
  lines.push(`  JD Fit:              ${scores.jdFit}/10`);
  lines.push(`  Confidence:          ${scores.confidence}/10`);
  lines.push(`  Overall:             ${scores.overall}/10`);
  lines.push(`  Recommendation:      ${scores.recommendation.replace(/_/g, " ").toUpperCase()}`);
  if (scores.standoutStrengths.length) lines.push(`  Strengths: ${scores.standoutStrengths.join("; ")}`);
  if (scores.hiringRisk.length) lines.push(`  Risks: ${scores.hiringRisk.join("; ")}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER PLAN BUILDER — combines all 9 phases into one callable function
// ─────────────────────────────────────────────────────────────────────────────

export type WorkZoInterviewEvidencePlan = {
  // Phase 1
  intelligence: InterviewIntelligenceLayer;
  // Phase 2
  plan: InterviewPlan;
  // Phase 3
  evidenceTracker: EvidenceTracker;
  // Phase 4
  followUpDecision: FollowUpDecision | null;
  // Phase 5
  claims: CandidateClaim[];
  contradiction: ContradictionResult;
  // Phase 6
  scenarios: ScenarioQuestion[];
  // Phase 7
  roleLevel: RoleLevel;
  isFresher: boolean;
  adaptiveQuestions: DifficultyQuestion[];
  // Phase 8
  recruiterMemory: RecruiterMemoryState;
  // Phase 9
  scores: InterviewScoreBreakdown | null;
  // Serialized for prompt injection
  serializedContext: string;
  // Legacy compat
  targetRole: string;
  cvSkills: string[];
  cvProjects: string[];
  jdRequirements: string[];
  matchedSkills: string[];
  missingOrWeakJdEvidence: string[];
  candidateClaimsToValidate: string[];
  questionPlan: {
    experienceValidation: number;
    projectValidation: number;
    technicalOrRoleSkillValidation: number;
    jdGapQuestions: number;
    scenarioQuestions: number;
    behavioralQuestions: number;
    followUpBudget: number;
  };
  requiredInterviewBehavior: string[];
};

export function buildWorkZoInterviewEvidencePlan(input: {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  transcript?: WorkZoEvidenceTranscriptItem[];
  candidateAnswer?: string;
  recruiterQuestion?: string;
  existingMemory?: RecruiterMemoryState;
  existingTracker?: EvidenceTracker;
}): WorkZoInterviewEvidencePlan {
  const targetRole = clean(input.targetRole, 120) || "the target role";

  // Phase 1 — Intelligence Layer
  const intelligence = buildInterviewIntelligenceLayer({
    cvText: input.cvText,
    jobDescription: input.jobDescription,
    targetRole: input.targetRole,
    transcript: input.transcript,
  });

  // Phase 7 — Role Level (must run BEFORE plan so plan can adjust for freshers)
  const roleLevel = detectRoleLevel({
    targetRole: input.targetRole,
    cvText: input.cvText,
    cvExperience: intelligence.cvExperience,
    transcript: input.transcript,
  });
  const isFresher = roleLevel === "junior";

  // Phase 2 — Plan (roleLevel-aware: fresher gets different question distribution)
  const plan = buildInterviewPlan(intelligence, roleLevel);

  // Phase 3 — Evidence Tracker
  let evidenceTracker = input.existingTracker || buildInitialEvidenceTracker(intelligence);
  if (input.transcript && input.transcript.length > 0) {
    evidenceTracker = updateEvidenceTracker(evidenceTracker, input.transcript, intelligence);
  }

  // Phase 4 — Follow-up
  let followUpDecision: FollowUpDecision | null = null;
  if (input.candidateAnswer && input.recruiterQuestion) {
    followUpDecision = buildFollowUpDecision({
      candidateAnswer: input.candidateAnswer,
      recruiterQuestion: input.recruiterQuestion,
      targetRole: input.targetRole,
      isFresher,
    });
  }

  // Phase 5 — Contradiction Engine
  const claims = extractAndStoreClaims(input.transcript || []);
  const contradiction = detectContradictions(claims);

  // Phase 6 — Scenarios (fresher: simplified count already set in plan)
  const scenarios = buildScenarioQuestions(intelligence, plan.scenarioQuestions, isFresher);

  // Phase 7 — Adaptive Difficulty (use already-computed roleLevel)
  const adaptiveQuestions = buildAdaptiveDifficultyQuestions(
    intelligence,
    roleLevel,
    plan.technicalValidation,
  );

  // Phase 8 — Recruiter Memory
  const recruiterMemory = input.existingMemory || createEmptyRecruiterMemory();

  // Phase 9 — Results (only if enough transcript to score)
  const candidateTurnCount = (input.transcript || []).filter(t =>
    /candidate|user/i.test(String(t.role || t.speaker || "")),
  ).length;
  const scores = candidateTurnCount >= 4
    ? buildResultsScore(intelligence, recruiterMemory, input.transcript || [], evidenceTracker)
    : null;

  // Serialize everything into a prompt-ready context block
  const serializedContext = [
    "══════════════════════════════════════════════════",
    "WORKZO INTERVIEW INTELLIGENCE — ALL 9 PHASES",
    "══════════════════════════════════════════════════",
    "",
    `TARGET ROLE: ${targetRole} | LEVEL: ${roleLevel.toUpperCase()}`,
    "",
    "── PHASE 1: CV + JD INTELLIGENCE ─────────────────",
    intelligence.cvSkills.length ? `CV Skills: ${intelligence.cvSkills.join(", ")}` : "CV Skills: none detected",
    intelligence.cvProjects.length ? `CV Projects: ${intelligence.cvProjects.join(" | ")}` : "CV Projects: none detected",
    intelligence.cvExperience.length ? `CV Experience: ${intelligence.cvExperience.join(" | ")}` : "CV Experience: none detected",
    intelligence.jdRequiredSkills.length ? `JD Required: ${intelligence.jdRequiredSkills.join(", ")}` : "JD Required: none detected",
    intelligence.jdPreferredSkills.length ? `JD Preferred: ${intelligence.jdPreferredSkills.join(", ")}` : "",
    intelligence.matchedSkills.length ? `Matched CV↔JD: ${intelligence.matchedSkills.join(", ")}` : "Matched: none",
    intelligence.missingSkills.length ? `JD Gaps (missing from CV): ${intelligence.missingSkills.join(", ")}` : "No significant JD gaps",
    intelligence.riskAreas.length ? `Risk areas: ${intelligence.riskAreas.join(" | ")}` : "",
    "",
    "── PHASE 2: INTERVIEW PLAN ────────────────────────",
    `Planned questions: intro(${plan.intro}) + experience(${plan.experienceValidation}) + projects(${plan.projectValidation}) + technical(${plan.technicalValidation}) + JD gaps(${plan.jdGapQuestions}) + scenarios(${plan.scenarioQuestions}) + behavioral(${plan.behavioralQuestions})`,
    `Total: ~${plan.totalEstimatedQuestions} questions | Follow-up budget: ${plan.followupBudget}`,
    `Order: ${plan.categoryOrder.join(" → ")}`,
    `Plan rationale: ${plan.rationale}`,
    "",
    "── PHASE 3: EVIDENCE TRACKER ──────────────────────",
    serializeEvidenceTracker(evidenceTracker),
    "",
    "── PHASE 4: FOLLOW-UP ENGINE ──────────────────────",
    followUpDecision?.shouldFollowUp
      ? `FOLLOW-UP NEEDED (${followUpDecision.trigger}): ${followUpDecision.followUpQuestion}\n  Drill options: ${followUpDecision.drillQuestions.join(" | ")}`
      : "No follow-up trigger active — advance to next planned question.",
    "",
    "── PHASE 5: CONTRADICTION ENGINE ─────────────────",
    serializeContradictionEngine(claims, contradiction),
    "",
    "── PHASE 6: SCENARIO ENGINE ───────────────────────",
    serializeScenarioEngine(scenarios),
    "",
    "── PHASE 7: ADAPTIVE DIFFICULTY ──────────────────",
    serializeAdaptiveDifficulty(adaptiveQuestions, roleLevel),
    "",
    "── PHASE 8: RECRUITER MEMORY ──────────────────────",
    serializeRecruiterMemory(recruiterMemory),
    "",
    scores
      ? ["── PHASE 9: RESULTS ENGINE ────────────────────────", serializeResultsEngine(scores)].join("\n")
      : "── PHASE 9: RESULTS ENGINE — (building — need 4+ candidate answers) ────",
    "",
    "══════════════════════════════════════════════════",
    "MANDATORY RECRUITER RULES:",
    "1. Every question must target ONE item from the evidence plan above.",
    "2. If a skill is VERIFIED in Phase 3, stop asking about it.",
    "3. If Phase 4 says follow-up needed, use that question — not the next planned one.",
    "4. If Phase 5 detected a contradiction, challenge it before moving on.",
    "5. Use Phase 6 scenarios instead of generic 'what is X' questions.",
    "6. Use Phase 7 depth level — do not ask senior questions to a junior.",
    "7. Never repeat a question from Phase 8 memory.",
    "8. Score evidence continuously so Phase 9 is accurate at the end.",
    "9. Real recruiters prove or disprove claims — do not just collect answers.",
    "",
    ...(isFresher ? [
      "── FRESHER MODE — CRITICAL RULES ─────────────────────",
      "CANDIDATE IS A FRESHER (little or no professional work experience).",
      "DO NOT ask: 'Tell me about a time at work when...' — they have no work history.",
      "DO ask: 'Tell me about a project / coursework / internship where...' instead.",
      "DO NOT penalise for missing industry experience — that is expected for a fresher.",
      "DO assess: conceptual understanding, learning curiosity, initiative, potential.",
      "TONE: supportive and coaching — not interrogative or pressure-heavy.",
      "SCENARIOS: use simple task-based questions, not production crisis scenarios.",
      "TECHNICAL: ask foundational/conceptual questions — not optimisation or architecture.",
      "PROJECTS: if they mention a university project, bootcamp project, or internship — probe it DEEPLY. That is their real experience.",
      "GOOD QUESTION EXAMPLE: 'Walk me through the most complex thing you built in your final year project.'",
      "BAD QUESTION EXAMPLE: 'Tell me about a time you handled a difficult stakeholder at work.'",
      "────────────────────────────────────────────────────────",
    ] : []),
    "══════════════════════════════════════════════════",
    "Question examples MUST be generated from the actual CV/JD evidence above.",
    "NEVER use hardcoded sample CVs or generic template questions.",
    "══════════════════════════════════════════════════",
  ].flat().filter(line => line !== undefined && line !== "").join("\n");

  return {
    intelligence,
    plan,
    evidenceTracker,
    followUpDecision,
    claims,
    contradiction,
    scenarios,
    roleLevel,
    isFresher,
    adaptiveQuestions,
    recruiterMemory,
    scores,
    serializedContext,
    // Legacy compat fields
    targetRole,
    cvSkills: intelligence.cvSkills,
    cvProjects: intelligence.cvProjects,
    jdRequirements: intelligence.jdRequiredSkills,
    matchedSkills: intelligence.matchedSkills,
    missingOrWeakJdEvidence: intelligence.missingSkills,
    candidateClaimsToValidate: intelligence.claimsToValidate,
    questionPlan: {
      experienceValidation: plan.experienceValidation,
      projectValidation: plan.projectValidation,
      technicalOrRoleSkillValidation: plan.technicalValidation,
      jdGapQuestions: plan.jdGapQuestions,
      scenarioQuestions: plan.scenarioQuestions,
      behavioralQuestions: plan.behavioralQuestions,
      followUpBudget: plan.followupBudget,
    },
    requiredInterviewBehavior: [
      "Do not ask generic interview questions when CV/JD evidence is available.",
      "Every question must be grounded in one CV skill, project, JD requirement, or candidate claim.",
      "Use Phase 6 scenario questions instead of trivia questions.",
      "If a JD requirement is missing from the CV, ask a natural gap question and assess transferable experience.",
      "If the candidate gives a vague answer, use the Phase 4 follow-up engine before moving on.",
      "Do not repeat already-asked questions (Phase 8 memory).",
      "Do not re-test verified skills (Phase 3 tracker).",
      "If a contradiction is detected (Phase 5), challenge it before the next question.",
      "Calibrate question depth to role level (Phase 7).",
      "Score all evidence for Phase 9 — real recruiters prove or disprove claims, not just collect answers.",
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZER — used by interview/route.ts to inject into LLM prompt
// ─────────────────────────────────────────────────────────────────────────────

export function serializeWorkZoInterviewEvidencePlan(
  plan: WorkZoInterviewEvidencePlan,
): string {
  return plan.serializedContext;
}
