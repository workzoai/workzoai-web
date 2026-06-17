import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { askOpenRouter } from "@/lib/openrouter";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import { completeResumeProfile, mergePreservingOriginalStructure } from "@/lib/workzoResumeProfileManager";

type CopilotAction =
  | "career_chat"
  | "interview_coach"
  | "magic"
  | "cv_improve"
  | "cv_rewrite_ats"
  | "cover_letter"
  | "job_fit"
  | "find_jobs_strategy"
  | "linkedin_message"
  | "email_reply"
  | "salary_negotiation"
  | "career_plan"
  | "rewrite"
  | "star"
  | "metrics"
  | "ownership"
  | "concise"
  | "followups"
  | "score"
  | "expectation"
  | "recruiter_intent";

type CopilotMessage = { role: "user" | "assistant"; content: string };

type CopilotRequest = {
  action?: CopilotAction;
  mode?: string;
  message?: string;
  prompt?: string;
  question?: string;
  answer?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  outputLanguage?: string;
  recruiterName?: string;
  recruiterRole?: string;
  recruiterMemory?: unknown;
  resumeProfile?: unknown;
  history?: CopilotMessage[];
};

// ─── Plan gates ───────────────────────────────────────────────────────────────
// Matches the WorkZo feature table exactly:
//
// FREE:    Voice interviews (2/mo), basic recruiter intelligence, basic follow-ups,
//          basic interview reports. Nothing CV/analysis/coaching related.
//
// PREMIUM: Everything free + Improve CV, ATS, Cover Letter, Job Assist, Career Brain,
//          Performance Tracking, Hiring Readiness, Interview History, advanced reports.
//          Analysis actions (job_fit, scoring, etc.) unlock here.
//          CV writing/rewriting unlocks here.
//          NO career coaching, roadmaps, replay, or live AI recruiter.
//
// PRO:     Everything premium + AI Career Coach, Career Roadmaps, Replay Intelligence,
//          Coaching Memory, Interview Probability Forecasting, Tavus Live AI Recruiter,
//          Premium Personas, Priority AI Models.

// Actions that require at minimum Premium (not available on Free)
const PREMIUM_ACTIONS: CopilotAction[] = [
  "cv_improve",
  "cv_rewrite_ats",
  "cover_letter",
  "rewrite",
  "star",
  "metrics",
  "ownership",
  "concise",
  "job_fit",
  "find_jobs_strategy",
  "followups",
  "score",
  "recruiter_intent",
  "linkedin_message",
  "email_reply",
];

// Actions that require Premium Pro (not available on Free or Premium)
const PRO_ONLY_ACTIONS: CopilotAction[] = [
  "career_chat",
  "career_plan",
  "salary_negotiation",
  "expectation",
  "interview_coach",
];

// ─── Model routing ────────────────────────────────────────────────────────────
// Routes by feature category then plan tier. All overrideable via env vars.
//
// Writing (CV rewriting, cover letter, bullet rewrites):
//   Premium  → Claude Haiku 4.5  (good instruction-following, affordable)
//   Pro      → Claude Sonnet 4.6 (best writing quality + tone, Priority AI Models)
//
// Coaching (career chat, roadmaps, interview coaching):
//   Pro only → Claude Sonnet 4.6 (multi-turn nuance, coaching depth)
//
// Analysis (job fit, scoring, gap analysis, recruiter intent):
//   Premium  → Gemini 2.5 Flash  (fast, structured output, cost-efficient)
//   Pro      → Gemini 2.5 Flash  (same — analysis doesn't need bigger models)
//
// Interview support (magic, followups, score — available premium+):
//   Premium  → Claude Haiku 4.5
//   Pro      → Claude Sonnet 4.6

const MODELS = {
  writingPremium:  process.env.OPENROUTER_WRITING_PREMIUM_MODEL  || "anthropic/claude-haiku-4-5-20251001",
  writingPro:      process.env.OPENROUTER_WRITING_PRO_MODEL      || "anthropic/claude-sonnet-4-6",
  coachingPro:     process.env.OPENROUTER_COACHING_PRO_MODEL     || "anthropic/claude-sonnet-4-6",
  analysisPremium: process.env.OPENROUTER_ANALYSIS_PREMIUM_MODEL || "google/gemini-2.5-flash",
  analysisPro:     process.env.OPENROUTER_ANALYSIS_PRO_MODEL     || "google/gemini-2.5-flash",
  interviewPremium:process.env.OPENROUTER_INTERVIEW_PREMIUM_MODEL|| "anthropic/claude-haiku-4-5-20251001",
  interviewPro:    process.env.OPENROUTER_INTERVIEW_PRO_MODEL    || "anthropic/claude-sonnet-4-6",
};

const WRITING_ACTIONS: CopilotAction[]  = ["cv_improve", "cv_rewrite_ats", "cover_letter", "rewrite", "star", "metrics", "ownership", "concise"];
const COACHING_ACTIONS: CopilotAction[] = ["career_chat", "career_plan", "salary_negotiation", "expectation", "interview_coach"];
const ANALYSIS_ACTIONS: CopilotAction[] = ["job_fit", "find_jobs_strategy", "followups", "score", "recruiter_intent", "linkedin_message", "email_reply"];
// Everything else (magic, etc.) → interview category

function selectModel(action: CopilotAction, isPro: boolean): string {
  if (WRITING_ACTIONS.includes(action))  return isPro ? MODELS.writingPro      : MODELS.writingPremium;
  if (COACHING_ACTIONS.includes(action)) return MODELS.coachingPro; // pro-only, always Sonnet
  if (ANALYSIS_ACTIONS.includes(action)) return isPro ? MODELS.analysisPro     : MODELS.analysisPremium;
  return isPro ? MODELS.interviewPro : MODELS.interviewPremium; // magic, score, etc.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanMultiline(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n").trim().slice(0, maxLength);
}

function safeJson(value: unknown, maxLength: number) {
  if (!value) return "No recruiter memory provided.";
  try { return JSON.stringify(value).slice(0, maxLength); }
  catch { return "Recruiter memory could not be serialized."; }
}

type RewrittenResumeProfile = {
  basics: { name: string; headline?: string; email?: string; phone?: string; location?: string; linkedin?: string };
  summary?: string;
  experience?: Array<{ title?: string; company?: string; location?: string; dates?: string; bullets?: string[] }>;
  education?: Array<{ degree?: string; institution?: string; location?: string; dates?: string }>;
  skills?: string[];
  projects?: Array<{ name?: string; bullets?: string[] }>;
  languages?: string[];
  strengths?: string[];
  additionalEvidence?: string[];
  warnings?: string[];
  rawText?: string;
  previewText?: string;
  certifications?: string[];
};

/** Tolerant JSON extraction — handles markdown code fences and any leading/
 * trailing prose the model might add despite being asked for raw JSON. */
function parseJsonLoose(raw: string): RewrittenResumeProfile | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.basics) return parsed as RewrittenResumeProfile;
  } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object" && parsed.basics) return parsed as RewrittenResumeProfile;
    } catch {}
  }
  return null;
}

/** Collapses embedded newlines/extra whitespace in a single field value down
 * to one clean line, and removes an exact duplicate of the whole string
 * appended to itself (e.g. "Zoho Corp\nZoho Corp" → "Zoho Corp"). This is a
 * safety net independent of prompt compliance — LLMs occasionally echo a
 * field's value twice within itself, especially when the source CV text had
 * the same string appear in two places due to a multi-column PDF layout. */
function sanitizeFieldText(value: unknown): string {
  if (typeof value !== "string") return "";
  let cleaned = value.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // Detect "X X" or "X. X" where the second half exactly repeats the first
  // half (case-insensitive, ignoring trailing punctuation) — this is the
  // "Zoho Corp Zoho Corp" / "Zoho Corp. Zoho Corp" duplication pattern.
  const half = cleaned.length / 2;
  if (cleaned.length > 3 && Number.isInteger(half)) {
    const firstHalf = cleaned.slice(0, half).trim().replace(/[.,]$/, "");
    const secondHalf = cleaned.slice(half).trim().replace(/[.,]$/, "");
    if (firstHalf && firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      cleaned = firstHalf;
    }
  }
  // Detect "X X" with a single space/period boundary even when lengths
  // aren't perfectly even (e.g. "Zoho Corp. Zoho Corp" — 19 vs 9 chars).
  const words = cleaned.split(" ");
  for (let splitAt = 1; splitAt < words.length; splitAt++) {
    const left = words.slice(0, splitAt).join(" ").replace(/[.,]$/, "").trim();
    const right = words.slice(splitAt).join(" ").replace(/[.,]$/, "").trim();
    if (left.length >= 3 && left.toLowerCase() === right.toLowerCase()) {
      cleaned = left;
      break;
    }
  }
  return cleaned;
}

/** Removes a sibling field's value if it has been duplicated inside this
 * field — e.g. job.title containing the company name that already lives in
 * job.company ("Technical Support Engineer Zoho Corp" when company is
 * "Zoho Corp" → "Technical Support Engineer"). */
function stripSiblingDuplicate(fieldValue: string, siblingValue: string): string {
  if (!fieldValue || !siblingValue || siblingValue.length < 3) return fieldValue;
  const pattern = new RegExp(`\\s*${siblingValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const stripped = fieldValue.replace(pattern, "").trim().replace(/[.,]$/, "").trim();
  return stripped || fieldValue;
}

/** Defensive sanitization pass applied to every rewrite, regardless of how
 * well the model followed the prompt's formatting rules. Strips embedded
 * newlines, removes self-duplicated field values, and removes a company/
 * institution name that has leaked into the title/degree field next to it. */
function sanitizeRewrittenProfile(profile: RewrittenResumeProfile): RewrittenResumeProfile {
  const basics = profile.basics || { name: "" };
  const sanitizedBasics = {
    name: sanitizeFieldText(basics.name),
    headline: sanitizeFieldText(basics.headline),
    email: sanitizeFieldText(basics.email),
    phone: sanitizeFieldText(basics.phone),
    location: sanitizeFieldText(basics.location),
    linkedin: sanitizeFieldText(basics.linkedin),
  };

  const experience = (profile.experience || []).map((job) => {
    const company = sanitizeFieldText(job.company);
    const title = stripSiblingDuplicate(sanitizeFieldText(job.title), company);
    return {
      title,
      company,
      location: sanitizeFieldText(job.location),
      dates: sanitizeFieldText(job.dates),
      bullets: (job.bullets || []).map((b) => sanitizeFieldText(b)).filter(Boolean),
    };
  });

  const education = (profile.education || []).map((edu) => {
    const institution = sanitizeFieldText(edu.institution);
    const degree = stripSiblingDuplicate(sanitizeFieldText(edu.degree), institution);
    return {
      degree,
      institution,
      location: sanitizeFieldText(edu.location),
      dates: sanitizeFieldText(edu.dates),
    };
  });

  const projects = (profile.projects || []).map((project) => ({
    name: sanitizeFieldText(project.name),
    bullets: (project.bullets || []).map((b) => sanitizeFieldText(b)).filter(Boolean),
  }));

  return {
    ...profile,
    basics: sanitizedBasics,
    summary: sanitizeFieldText(profile.summary),
    experience,
    education,
    projects,
  };
}

/** Renders a structured profile back to the same plain-text ATS shape the
 * editable textarea expects, using fixed English section headers (matching
 * what the plain-text rewrite path produces) regardless of output language —
 * the body content inside each section is whatever language the model wrote
 * it in, only the section labels are pinned for consistency. */
function formatResumeProfileAsPlainText(profile: RewrittenResumeProfile): string {
  const lines: string[] = [];
  const b = profile.basics || { name: "" };
  if (b.name) lines.push(b.name);
  if (b.headline) lines.push(b.headline);
  const contact = [b.email, b.phone, b.location, b.linkedin].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);

  if (profile.summary) {
    lines.push("", "PROFESSIONAL SUMMARY", profile.summary);
  }

  if (profile.skills?.length) {
    lines.push("", "SKILLS", profile.skills.join(", "));
  }

  if (profile.experience?.length) {
    lines.push("", "EXPERIENCE");
    profile.experience.forEach((job) => {
      const header = [job.title, job.company, job.dates].filter(Boolean).join(" | ");
      if (header) lines.push(header);
      job.bullets?.forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }

  if (profile.education?.length) {
    lines.push("", "EDUCATION");
    profile.education.forEach((edu) => {
      lines.push([edu.degree, edu.institution, edu.dates].filter(Boolean).join(" | "));
    });
  }

  if (profile.projects?.length) {
    lines.push("", "PROJECTS");
    profile.projects.forEach((project) => {
      if (project.name) lines.push(project.name);
      project.bullets?.forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }

  if (profile.languages?.length) {
    lines.push("", "LANGUAGES", profile.languages.join(", "));
  }

  if (profile.certifications?.length) {
    lines.push("", "CERTIFICATIONS", profile.certifications.join(", "));
  }

  return lines.join("\n").trim();
}

function normalizeAction(action: unknown, mode: unknown): CopilotAction {
  if (typeof action === "string") return action as CopilotAction;
  if (mode === "interview") return "magic";
  if (mode === "cv") return "cv_improve";
  if (mode === "jobs") return "find_jobs_strategy";
  if (mode === "cover_letter") return "cover_letter";
  if (mode === "message") return "linkedin_message";
  return "career_chat";
}

function actionInstruction(action: CopilotAction) {
  if (action === "cv_improve") return [
    "You are a senior executive recruiter and career strategist. Analyse the candidate's CV against the target role and job description. Produce recruiter-quality, immediately usable rewrite recommendations.",
    "",
    "PROFESSIONAL STANDARD: All output must meet the standard of a CV written by a professional career consultant. Language must be:",
    "  - Confident, precise, and achievement-oriented",
    "  - Free of filler phrases ('responsible for', 'helped with', 'worked on', 'assisted in')",
    "  - Written in third-person implied voice (no 'I' or 'my')",
    "  - Using industry-standard terminology for the target role",
    "  - Quantified wherever the CV provides numbers, percentages, or scale",
    "",
    "CROSS-DOMAIN ABSTRACTION: If the candidate's background is in a different domain to the target role, translate their real experience into transferable functional language that maps to the JD:",
    "  - Physical/hardware installation work → Systems deployment & configuration",
    "  - Cross-functional engineering teams → Cross-functional stakeholder collaboration / technical consulting",
    "  - Troubleshooting equipment/machinery → Root-cause analysis, technical problem-solving, 3rd-level support",
    "  - Writing technical spec sheets / engineering docs → Creating system documentation, SOPs, integration guides",
    "  - Product lifecycle / change management (PLM) → Systems integration lifecycle, change management processes",
    "  - Quality control / compliance processes → Process governance, compliance documentation",
    "",
    "RULES:",
    "1. NO FABRICATION — only use evidence present in the CV. Do not invent tools, credentials, or achievements.",
    "2. Every rewritten bullet MUST open with a strong past-tense action verb (Configured, Integrated, Coordinated, Authored, Optimised, Resolved, Deployed, Documented, Reduced, Increased, Led, Delivered).",
    "3. Apply the X-Y-Z formula where evidence exists: Accomplished [X], measured by [Y], by doing [Z].",
    "4. Prioritise JD keywords the candidate has genuine evidence for — surface them prominently.",
    "5. The rewritten headline and summary must sound like a senior professional wrote them — no generic phrases.",
    "6. Flag honestly which JD requirements the candidate lacks evidence for.",
  ].join("\n");
  if (action === "cv_rewrite_ats") return [
    "You are a senior professional CV writer rewriting this CV specifically for the job description provided. This is not a generic polish — every section must be actively re-angled toward this job description.",
    "",
    "PRIMARY GOAL — TARGET THE JD:",
    "  - Read the job description first and identify its core requirements, responsibilities, and preferred skills/tools.",
    "  - For every bullet in the candidate's CV, ask: does this responsibility, tool, or outcome relate to something the JD asks for? If yes, rewrite that bullet so the connection is explicit and uses the JD's own terminology where the candidate has genuine matching evidence.",
    "  - Reorder bullets within each job so the most JD-relevant achievements come first.",
    "  - The summary must explicitly position the candidate for THIS role and THIS job description — reference the actual responsibilities in the JD, not a generic professional summary.",
    "  - Skills section: lead with every skill that appears in the JD that the candidate genuinely has, in the JD's own wording, then list remaining real skills after.",
    "  - If the JD emphasises something (e.g. 'cloud administration', 'documentation', 'customer-facing support') and the candidate has relevant but differently-worded experience, translate it into the JD's vocabulary — this is the single most important thing this rewrite does.",
    "",
    "PROFESSIONAL WRITING STANDARD:",
    "  - Every bullet must open with a strong, specific past-tense action verb",
    "  - No weak openers: never start with 'Responsible for', 'Helped', 'Worked on', 'Assisted', 'Supported' alone",
    "  - No first-person pronouns (no 'I', 'my', 'we')",
    "  - Quantify with numbers, percentages, scale, or scope wherever the original CV provides them",
    "  - Language must be confident, precise, and industry-standard for the target role",
    "",
    "CROSS-DOMAIN REWRITING: If the candidate's background is from a different domain than the JD, translate their real experience using functional abstraction — do not fabricate, but reframe genuine skills using language that maps to the target role and JD specifically:",
    "  - Physical/hardware installation → systems deployment & on-site configuration",
    "  - Engineering change management → technical change control & process documentation",
    "  - Cross-functional team collaboration → stakeholder coordination & technical consulting",
    "  - Equipment troubleshooting → root-cause analysis & technical problem resolution",
    "  - Technical drawing / specification writing → system documentation & SOP authoring",
    "  - PLM / Windchill tools → product lifecycle systems & configuration management tools",
    "",
    "RULES:",
    "1. Do NOT invent companies, job titles, dates, employers, degrees, metrics, or achievements not in the original CV. Every fact must trace to real CV content — only the framing and emphasis change to match the JD.",
    "2. Keep the same structure: same section order, same jobs, same number of bullets per role — but reorder bullets within a job by JD relevance, and reword every one toward the JD where genuine evidence supports it.",
    "3. If there is no job description provided, rewrite for general professional polish using the target role only.",
    "",
    "OUTPUT: Return ONLY the rewritten CV as plain text. No preamble, no markdown, no commentary.",
  ].join("\n");
  if (action === "cover_letter") return "Draft or improve a concise, role-specific cover letter using only the CV and job description. Use placeholders where facts are missing.";
  if (action === "find_jobs_strategy") return "Create a practical job-search strategy: target titles, keywords, platforms, filters, outreach ideas, and a 7-day application plan.";
  if (action === "linkedin_message") return "Write a concise LinkedIn outreach message or recruiter reply. Keep it natural, specific, and not desperate.";
  if (action === "magic") return "Do a complete recruiter-aware improvement: diagnose, rewrite, score, predict follow-ups, and give the next practice step.";
  if (action === "job_fit") return "Evaluate job fit honestly. Compare CV evidence with the job description. Show strengths, gaps, and apply/tailor/skip verdict.";
  if (action === "career_plan") return "Create a detailed, actionable career development plan personalised to the candidate's background, target role, and market. Include a 30/60/90 day roadmap with concrete milestones.";
  if (action === "salary_negotiation") return "Coach the candidate on salary negotiation for their target role and market. Give specific numbers, scripts, and tactics.";
  if (action === "interview_coach") return "Coach the candidate on their interview answer. Diagnose weakness, provide a stronger version, and explain the recruiter's likely reaction.";
  return "Act as a senior career guidance coach. Give practical, honest, context-aware advice using the user's CV, target role, job description, market, and recent conversation.";
}

function outputFormat(action: CopilotAction) {
  if (action === "cv_improve") return "OUTPUT FORMAT:\n1. Positioning diagnosis (how the CV currently reads vs the JD)\n2. Cross-domain transferable strengths (what maps well with abstracted framing)\n3. Bullets to rewrite (show original → rewritten version)\n4. Missing proof or gaps (JD requirements with no CV evidence — be honest)\n5. Recommended headline and summary for this target role\n6. One action to take today";
  if (action === "cv_rewrite_ats") return `OUTPUT FORMAT:\nReturn ONLY the rewritten CV as plain text, in the EXACT same structure as the input ATS CV:\n- Same section order and section headers. IMPORTANT: keep section headers in English exactly as given (e.g. "PROFESSIONAL SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS", "PROJECTS", "LANGUAGES") even when the body content is translated into another output language — this keeps the document machine-parseable.\n- Same number of jobs, order, company names, job titles, and dates — do not add, remove, or reorder jobs.\n- Same number of bullets per job, but you MAY reorder bullets within a single job so the most JD-relevant ones come first — rewrite the wording of every bullet to target the JD.\n- Same skills list, reordered so JD-relevant skills the candidate genuinely has come first, in the JD's own terminology where applicable.\nDo NOT include any preamble, explanation, markdown fences, or commentary. Output the CV text only.`;
  if (action === "cover_letter") return "OUTPUT FORMAT:\n1. Quick fit note\n2. Cover letter draft\n3. What to personalise before sending\n4. One stronger alternative opening";
  if (action === "find_jobs_strategy") return "OUTPUT FORMAT:\n1. Best target job titles\n2. Search keywords\n3. Where to search (global job boards)\n4. Filters to use\n5. 7-day application plan";
  if (action === "magic") return "OUTPUT FORMAT:\n1. Recruiter diagnosis\n2. Stronger answer\n3. Trust score /100\n4. What is still missing\n5. Likely follow-up questions\n6. Next practice step";
  if (action === "career_plan") return "OUTPUT FORMAT:\n1. Current positioning assessment — strengths vs gaps table\n2. 30-day plan — use ### Week headers and - [ ] checkbox items for each task. Put a blank line before any > blockquote example.\n3. 60-day plan — skill building and applications\n4. 90-day plan — target outcomes and milestones\n5. Key risks and mitigation strategies\n\nIMPORTANT: Always put a blank line before and after > blockquotes. Never put a blockquote directly after a - [ ] item with no blank line.";
  return "OUTPUT FORMAT:\n1. Direct answer\n2. Recruiter / career perspective\n3. Recommended action\n4. Example wording or example step — use a > blockquote with a blank line before and after it\n5. What to avoid\n6. One action to do today\n\nIMPORTANT: Always put a blank line before and after > blockquotes.";
}

function buildFallback(targetRole: string) {
  return `1. Direct answer\nWork-O-Bot could not reach the AI model, but here is a safe fallback.\n\n2. Recruiter / career perspective\nRecruiters trust specific evidence more than broad claims.\n\n3. Recommended action\nFor ${targetRole}, add one real example, one personal action, and one measurable result.\n\n4. Example wording\n"In my previous role, I handled [specific situation], took [personal action], and achieved [measurable result]."\n\n5. What to avoid\nAvoid vague claims like "I worked on many things" without proof.\n\n6. One action today\nRewrite one CV bullet or interview answer with a clear result.`;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Moved to lib/workzoRateLimit.ts — an in-memory Map here does not work
// correctly on Vercel serverless (each cold start gets its own empty Map,
// so the limit was not actually being enforced across instances). The
// database-backed version keys by user ID (set further down, after auth
// resolves) rather than IP, which is also more accurate per-account.

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // 1. Auth check
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json({ error: "Please sign in to use this feature." }, { status: 401 });
  }

  const isPremium = account.plan === "premium" || account.plan === "premium_pro";
  const isPro     = account.plan === "premium_pro";

  // Debug log — visible in server logs, helps diagnose plan resolution issues
  console.log("[copilot] plan resolution:", {
    authenticated: account.authenticated,
    userId: account.userId,
    plan: account.plan,
    status: account.status,
    isPremium,
    isPro,
  });

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: false, error: "OPENROUTER_API_KEY is missing." }, { status: 500 });
  }

  const body = (await request.json()) as CopilotRequest;
  const action = normalizeAction(body.action, body.mode);

  console.log("[copilot] action:", action, "isPro:", isPro, "isPremium:", isPremium);

  // 2. Feature gate — checked against server-resolved plan (not cookie)
  if (PRO_ONLY_ACTIONS.includes(action) && !isPro) {
    console.log("[copilot] BLOCKED pro-only action:", action, "plan:", account.plan);
    return NextResponse.json(
      { success: false, error: "upgrade_required", requiredPlan: "premium_pro", action },
      { status: 403 },
    );
  }
  if (PREMIUM_ACTIONS.includes(action) && !isPremium) {
    console.log("[copilot] BLOCKED premium action:", action, "plan:", account.plan);
    return NextResponse.json(
      { success: false, error: "upgrade_required", requiredPlan: "premium", action },
      { status: 403 },
    );
  }

  // 3. Rate limit — keyed by user ID (more accurate than IP, and consistent
  // across serverless instances since it's backed by a database table).
  const rateLimitKey = `copilot:${account.userId}`;
  const rateLimit = isPro ? 80 : isPremium ? 40 : 5;
  const { allowed: rateLimitAllowed } = await checkWorkZoRateLimit(rateLimitKey, rateLimit);
  if (!rateLimitAllowed) {
    const requiredPlan = isPro ? "premium_pro" : isPremium ? "premium" : "premium";
    return NextResponse.json(
      { success: false, error: "upgrade_required_rate_limit", requiredPlan },
      { status: 429 },
    );
  }

  try {
    const message       = cleanMultiline(body.message || body.prompt, 4000);
    const question      = cleanMultiline(body.question, 2500);
    const answer        = cleanMultiline(body.answer, 6000);
    const cvText        = cleanMultiline(body.cvText, 9000);
    // Structured CV profile — used for cv_rewrite_ats and cv_improve when available
    // This gives the AI clean typed data instead of raw extracted text
    const resumeProfileRaw = body.resumeProfile && typeof body.resumeProfile === "object"
      ? (body.resumeProfile as Record<string, unknown>)
      : null;
    const resumeProfile = safeJson(resumeProfileRaw, 12000);
    const jobDescription= cleanMultiline(body.jobDescription, 7000);
    const targetRole    = cleanText(body.targetRole, 180) || "target role";
    const targetMarket  = cleanText(body.targetMarket, 120) || "Global";
    const outputLanguage = cleanText(body.outputLanguage, 40) || "English";
    const recruiterName = cleanText(body.recruiterName, 80) || "Work-O-Bot";
    const recruiterRole = cleanText(body.recruiterRole, 120) || "Career Copilot";
    const recruiterMemory = safeJson(body.recruiterMemory, 3500);

    const systemPrompt = `
You are Work-O-Bot, the intelligent career guidance copilot inside WorkZo AI.

You are NOT a generic chatbot.
You are a senior career strategist, recruiter-aware interview coach, and practical job-search guide for a global audience.

STRICT TRUTH + QUALITY RULES:
- Never invent candidate experience, companies, tools, projects, metrics, education, or achievements.
- Only use facts clearly present in the candidate answer, CV text, job description, or user message.
- Use placeholders like [add measurable result] when facts are missing.
- Give honest guidance, including when a role is a weak fit.
- Be specific, practical, and immediately usable.
- Always include one concrete action the user can do today.
- This product serves a global audience — do not assume any specific country, market, or language unless stated.

CONVERSATION STYLE:
- This is an ongoing chat. The conversation history is provided as prior turns.
- For the first message on a topic, use the structured OUTPUT FORMAT below.
- For natural follow-ups (e.g. "make it shorter", "what about for a different role?"), respond conversationally and concisely — do not repeat the full numbered format.
- Stay consistent with anything you already told the user earlier in this conversation.

MARKDOWN FORMATTING RULES (strictly follow these — output is rendered in a custom UI):
- Use ## for section headers, ### for sub-sections. Never use ####.
- Use **bold** for emphasis. Use *italic* sparingly (only inside blockquotes or for example text).
- Use - [ ] for actionable checklist items (tasks the user should do).
- Use numbered lists (1. 2. 3.) for ordered steps or ranked items.
- Use unordered lists (- item) for non-ordered points.
- Use | table | format | for comparisons and gap analyses.
- Use > blockquote for example scripts, wording templates, and honest assessments. ALWAYS put a blank line before and after a blockquote.
- Use --- (on its own line with blank lines before and after) to separate major sections.
- NEVER nest a blockquote directly after a list item with no blank line — always add a blank line first.
- Do NOT use ####, bold headers like **Header:**, or emoji in headers.
- Do NOT use emoji as bullet replacements (❌ ✅ 👉 etc.) — use plain text or list markers instead.
- Keep responses focused and scannable — avoid walls of plain text.

CONTEXT:
Recruiter name: ${recruiterName}
Recruiter role: ${recruiterRole}
Target role: ${targetRole}
Target market: ${targetMarket}
CV context available: ${cvText ? "Yes" : "No"}
Job description available: ${jobDescription ? "Yes" : "No"}
${(action === "cv_rewrite_ats" || action === "cover_letter") && outputLanguage !== "English" ? `\nOUTPUT LANGUAGE: Write the entire output in ${outputLanguage}. Every section, heading, and sentence must be in ${outputLanguage} — do not mix in English unless it's a proper noun (company name, product name, certification name) that has no natural translation.` : ""}

TASK:
${actionInstruction(action)}

${outputFormat(action)}
`.trim();

    // For CV rewrite actions, build a clean structured representation from the
    // resumeProfile object when available — avoids feeding the AI garbled raw text
    // with duplicate company names, truncated bullets, and extraction artefacts.
    function buildStructuredCvBlock(profile: Record<string, unknown> | null): string {
      if (!profile || typeof profile !== "object") return "";
      const b = (profile.basics as Record<string, string>) || {};
      const lines: string[] = [];
      if (b.name)     lines.push(`Name: ${b.name}`);
      if (b.headline) lines.push(`Headline: ${b.headline}`);
      const contact = [b.email, b.phone, b.location].filter(Boolean).join(" • ");
      if (contact)    lines.push(`Contact: ${contact}`);
      const summary = profile.summary as string;
      if (summary)    lines.push(`\nSummary:\n${summary}`);
      const exp = profile.experience as Array<Record<string, unknown>>;
      if (Array.isArray(exp) && exp.length) {
        lines.push("\nExperience:");
        exp.slice(0, 8).forEach((e) => {
          const title = [e.title, e.company, e.dates].filter(Boolean).join(" | ");
          lines.push(`  ${title}`);
          const bullets = e.bullets as string[];
          if (Array.isArray(bullets)) bullets.slice(0, 8).forEach((b) => lines.push(`    • ${b}`));
        });
      }
      const edu = profile.education as Array<Record<string, unknown>>;
      if (Array.isArray(edu) && edu.length) {
        lines.push("\nEducation:");
        edu.slice(0, 6).forEach((e) => {
          lines.push(`  ${[e.degree, e.institution, e.dates].filter(Boolean).join(" | ")}`);
        });
      }
      const skills = profile.skills as string[];
      if (Array.isArray(skills) && skills.length) lines.push(`\nSkills: ${skills.slice(0, 40).join(", ")}`);
      const projects = profile.projects as Array<Record<string, unknown>>;
      if (Array.isArray(projects) && projects.length) {
        lines.push("\nProjects:");
        projects.slice(0, 6).forEach((p) => {
          lines.push(`  ${p.name}`);
          const bullets = p.bullets as string[];
          if (Array.isArray(bullets)) bullets.slice(0, 4).forEach((b) => lines.push(`    • ${b}`));
        });
      }
      const langs = profile.languages as string[];
      if (Array.isArray(langs) && langs.length)  lines.push(`Languages: ${langs.join(", ")}`);
      return lines.join("\n").trim();
    }

    // Use structured profile for CV actions if available; fall back to raw cvText
    const cvIsForRewrite = action === "cv_rewrite_ats" || action === "cv_improve";
    const structuredCv = cvIsForRewrite && resumeProfileRaw
      ? buildStructuredCvBlock(resumeProfileRaw)
      : null;
    const cvContextBlock = structuredCv || cvText || "No CV context provided.";

    const userPrompt = `
USER MESSAGE:
${message || "No separate user message provided."}

RECRUITER QUESTION:
${question || "No recruiter question provided."}

CANDIDATE ANSWER:
${answer || "No candidate answer provided."}

CANDIDATE CV CONTEXT:
${cvContextBlock}

JOB DESCRIPTION:
${jobDescription || "No job description provided."}

RECRUITER MEMORY:
${recruiterMemory}
`.trim();

    const history: CopilotMessage[] = Array.isArray(body.history)
      ? body.history
          .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
          .map((item) => ({ role: item.role, content: cleanMultiline(item.content, 4000) }))
          .filter((item) => item.content)
          .slice(-16)
      : [];

    const model = selectModel(action, isPro);

    // Token limits and temperature tuned per action
    const isWriting = WRITING_ACTIONS.includes(action);
    const maxTokens = action === "cv_rewrite_ats" ? 3600 : action === "cv_improve" ? 2000 : isWriting ? 1200 : 900;
    const temperature = action === "cv_rewrite_ats" ? 0.12 : action === "cv_improve" ? 0.15 : isWriting ? 0.20 : 0.25;

    // ── Structured JSON rewrite path (cv_rewrite_ats with a profile) ─────────
    // Plain-text rewrites were being fed back through extractResumeProfile —
    // the same regex-based fallback parser used for messy uploaded PDFs — to
    // turn them back into a structured ResumeProfile for the template/preview.
    // That parser was never built to handle clean AI-generated prose reliably
    // and was silently corrupting the result: the candidate's name was
    // overwritten by a project title line ("GANS E-Scooter Service"), an
    // entire job (the most recent one) disappeared, a single-word project
    // name ("Magist") fell back to the placeholder "Candidate", the
    // education section vanished, and the summary became a single bullet.
    // None of that is a prompt-quality issue — it's structural data loss
    // from re-parsing prose that was never meant to be re-parsed.
    //
    // Fix: when we already have a structured resumeProfile, ask the model to
    // return the rewrite AS structured JSON in the same shape, so every
    // field (name, headline, each job, each project, education, summary)
    // is something the model explicitly fills in — never something a
    // regex has to infer from plain text after the fact.
    if (action === "cv_rewrite_ats" && resumeProfileRaw) {
      const jsonSystemPrompt = `
You are a senior professional CV writer rewriting this CV specifically for the job description provided. This is not a generic polish — every section must be actively re-angled toward this job description.

PRIMARY GOAL — TARGET THE JD:
- Read the job description first and identify its core requirements, responsibilities, and preferred skills/tools.
- For every bullet in the candidate's CV, ask: does this responsibility, tool, or outcome relate to something the JD asks for? If yes, rewrite that bullet so the connection is explicit and uses the JD's own terminology where the candidate has genuine matching evidence.
- Reorder bullets within each job so the most JD-relevant achievements come first.
- The summary must explicitly position the candidate for THIS role and THIS job description.
- Skills: lead with every skill that appears in the JD that the candidate genuinely has, in the JD's own wording, then list remaining real skills after.

PROFESSIONAL WRITING STANDARD:
- Every bullet opens with a strong, specific past-tense action verb.
- No weak openers: never start with "Responsible for", "Helped", "Worked on", "Assisted", "Supported" alone.
- No first-person pronouns.
- Quantify with numbers/percentages/scale wherever the original provides them.
${outputLanguage !== "English" ? `- Write every text field (summary, headline, bullets, project descriptions) ENTIRELY in ${outputLanguage} — if a field has multiple clauses separated by "|" or "·", ALL clauses must be translated, not just some of them. Do not translate: candidate name, company names, institution names, certification names, or proper nouns with no natural translation.` : ""}

ABSOLUTE STRUCTURAL RULES — THESE ARE NEVER OPTIONAL:
1. basics.name MUST be copied EXACTLY, character-for-character, from the input profile's basics.name field. Do not paraphrase it, shorten it, replace it with a project name, company name, job title, or the word "Candidate"/"Professional" under any circumstance.
2. basics.email, basics.phone, basics.location, basics.linkedin MUST be copied EXACTLY from the input profile's corresponding fields, ONCE each. These are contact details only — NEVER insert education info, dates, school names, or any other fragment into these fields, and NEVER repeat the same value twice in one field (e.g. the linkedin URL must appear once, not twice). If the input value for one of these fields is empty, leave it empty in the output — do not fill it with unrelated text.
3. Copy the input "experience" array's job count, company names, and dates EXACTLY — every job that exists in the input MUST exist in the output, in the same order. Only the bullet text inside each job may be rewritten.
4. job.title must contain ONLY the job title (e.g. "Technical Support Engineer") — never the company name, never a trailing period, never a newline character, never any text duplicated from job.company. job.company must contain ONLY the company name, exactly once. If you find yourself wanting to write the company name twice or inside the title field, stop — put it only in job.company.
5. Copy the input "projects" array's project count and EXACT ORIGINAL NAMES, character-for-character — every project that exists in the input MUST exist in the output as a SEPARATE entry with its own original name unchanged, even single-word names like "Magist". NEVER merge two input projects into one output entry. NEVER replace any project's name with "Candidate", "Selected Project", "Professional", or any other placeholder — if you do not have a name for a project, use the exact name from the input, never invent a substitute.
6. Copy the input "education" array EXACTLY, unchanged — degree, institution, location, dates, with each field containing only its own content (degree field contains only the degree, institution field contains only the institution — never duplicate one into the other, never copy one education entry's degree into a different entry). Education entries are factual records, never rewritten, never omitted, never merged into other fields.
7. Every string field in the JSON must be a single clean line of text with NO embedded newline characters and NO internal duplication of the same phrase or word sequence repeated back-to-back.
8. "summary" must be a fresh 2-4 sentence overview of the candidate as a whole professional, written by you — never a copy-paste of a single job bullet, project description, or education entry.
9. Do NOT invent companies, titles, dates, employers, degrees, metrics, or achievements not present in the input. Only reframing and emphasis change — never the underlying facts.
10. Before returning, verify your own output: count the jobs, projects, and education entries in your JSON and confirm each count matches the input exactly, with no two input projects merged into one. Check that no field contains a newline or a repeated phrase. If anything is wrong, fix it before responding.

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{"basics":{"name":"","headline":"","email":"","phone":"","location":"","linkedin":""},"summary":"","experience":[{"title":"","company":"","location":"","dates":"","bullets":[""]}],"education":[{"degree":"","institution":"","location":"","dates":""}],"skills":[""],"projects":[{"name":"","bullets":[""]}],"languages":[""],"certifications":[""]}
`.trim();

      const jsonUserPrompt = `
CANDIDATE PROFILE (JSON — use these exact values for name/company/dates/education; rewrite only summary, bullets, and skills ordering):
${JSON.stringify(resumeProfileRaw)}

JOB DESCRIPTION:
${jobDescription || "No job description provided — rewrite for general professional polish using the target role only."}

TARGET ROLE: ${targetRole}
TARGET MARKET: ${targetMarket}
`.trim();

      try {
        const jsonOutput = await askOpenRouter(
          [
            { role: "system", content: jsonSystemPrompt },
            { role: "user", content: jsonUserPrompt },
          ],
          { model, temperature, maxTokens, jsonMode: true },
        );

        const parsedRaw = parseJsonLoose(jsonOutput);
        const parsed = parsedRaw ? sanitizeRewrittenProfile(parsedRaw) : null;
        if (parsed && typeof parsed === "object" && parsed.basics?.name) {
          const inputBasics = (resumeProfileRaw as Record<string, unknown>).basics as Record<string, unknown> | undefined;
          const originalName = typeof inputBasics?.name === "string" ? inputBasics.name.trim() : "";

          // Guard rail 1 — known sentinel/placeholder values. These are exact
          // fallback strings used elsewhere in the codebase when extraction
          // fails ("Candidate", "Professional", "Selected Project", "Unknown")
          // — not natural language the model would write on purpose, so an
          // exact-match denylist is more reliable than fuzzy heuristics.
          const SENTINEL_NAMES = new Set(["candidate", "professional", "selected project", "unknown", "n/a", "not specified"]);
          const returnedNameLower = String(parsed.basics.name).trim().toLowerCase();

          // Guard rail 2 — the name became a project title or a skill. This
          // was the original failure mode this guard rail was built for
          // (e.g. "GANS E-Scooter Service", "Matplotlib Seaborn Tableau").
          const inputProjects = Array.isArray((resumeProfileRaw as Record<string, unknown>).projects)
            ? ((resumeProfileRaw as Record<string, unknown>).projects as Array<Record<string, unknown>>)
            : [];
          const inputSkills = Array.isArray((resumeProfileRaw as Record<string, unknown>).skills)
            ? ((resumeProfileRaw as Record<string, unknown>).skills as unknown[]).map((s) => String(s).trim().toLowerCase())
            : [];
          const matchesProjectName = inputProjects.some(
            (p) => typeof p.name === "string" && p.name.trim().toLowerCase() === returnedNameLower,
          );
          const matchesSkill = inputSkills.includes(returnedNameLower);

          const nameLooksWrong =
            SENTINEL_NAMES.has(returnedNameLower) ||
            matchesProjectName ||
            matchesSkill ||
            (originalName && returnedNameLower !== originalName.toLowerCase());

          if (nameLooksWrong && originalName) {
            parsed.basics.name = originalName;
          }
          // If we have no verified original name to fall back to either
          // (the input profile itself was already corrupted upstream), we
          // cannot repair this here — but we no longer blindly accept a
          // known-bad sentinel value without at least having tried.

          // Guard rail 3 — never let experience or education shrink versus
          // the input. The model is asked to keep every job/education entry;
          // if it returned fewer than the input had, that's data loss, not
          // a legitimate edit — restore the input arrays for these fields
          // rather than ship a CV missing a job or a degree.
          const inputExperience = Array.isArray((resumeProfileRaw as Record<string, unknown>).experience)
            ? ((resumeProfileRaw as Record<string, unknown>).experience as unknown[])
            : [];
          const inputEducation = Array.isArray((resumeProfileRaw as Record<string, unknown>).education)
            ? ((resumeProfileRaw as Record<string, unknown>).education as unknown[])
            : [];
          if (inputExperience.length > 0 && (!Array.isArray(parsed.experience) || parsed.experience.length < inputExperience.length)) {
            console.warn("[copilot] cv_rewrite_ats dropped experience entries, restoring input experience structure with rewritten bullets where possible");
            parsed.experience = inputExperience as RewrittenResumeProfile["experience"];
          }
          if (inputEducation.length > 0 && (!Array.isArray(parsed.education) || parsed.education.length < inputEducation.length)) {
            console.warn("[copilot] cv_rewrite_ats dropped education entries, restoring input education");
            parsed.education = inputEducation as RewrittenResumeProfile["education"];
          }
          const inputProjectsTyped = inputProjects as RewrittenResumeProfile["projects"];
          if (inputProjectsTyped && inputProjectsTyped.length > 0 && (!Array.isArray(parsed.projects) || parsed.projects.length < inputProjectsTyped.length)) {
            console.warn("[copilot] cv_rewrite_ats dropped project entries, restoring input projects");
            parsed.projects = inputProjectsTyped;
          }

          // Guard rail 4 — per-project name sentinel check. The top-level
          // name guard rail above only protects basics.name; the model can
          // separately invent a placeholder name for an individual project
          // (e.g. project.name = "Candidate") while the overall project
          // count still matches, so the length-based guard rail above
          // doesn't catch it. Walk every project by position and restore
          // the corresponding input project's real name if the output name
          // is a known sentinel value or empty.
          if (inputProjectsTyped && Array.isArray(parsed.projects)) {
            const PROJECT_SENTINELS = new Set(["candidate", "professional", "selected project", "unknown", "untitled", "project", ""]);
            parsed.projects = parsed.projects.map((proj, index) => {
              const nameLower = String(proj?.name || "").trim().toLowerCase();
              const inputEquivalent = inputProjectsTyped[index];
              if (PROJECT_SENTINELS.has(nameLower) && inputEquivalent?.name) {
                return { ...proj, name: inputEquivalent.name };
              }
              return proj;
            });

            // Guard rail 5 — detect silently merged projects. If every
            // input project had a distinct name, but one of those exact
            // names no longer appears anywhere in the output project list,
            // two input projects were likely combined into one output
            // entry (count matches, but content was lost). In that case,
            // fall back to the full input project list rather than ship a
            // CV missing a named project's bullets entirely.
            const outputNamesLower = new Set(parsed.projects.map((p) => String(p?.name || "").trim().toLowerCase()));
            const missingInputProject = inputProjectsTyped.some(
              (p) => p?.name && !outputNamesLower.has(String(p.name).trim().toLowerCase()),
            );
            if (missingInputProject) {
              console.warn("[copilot] cv_rewrite_ats appears to have merged distinct input projects, restoring input projects");
              parsed.projects = inputProjectsTyped;
            }
          }

          // Normalize to a complete ResumeProfile shape before handing this
          // back to the client. The model's JSON only fills in the fields
          // listed in our schema (basics/summary/experience/education/
          // skills/projects/languages/certifications) — it never produces
          // strengths, additionalEvidence, warnings, rawText, or
          // previewText, because those aren't part of what we asked it to
          // rewrite. But buildResumeJson() and its helpers in
          // workzoWorkspaceGenerators.ts assume every ResumeProfile has all
          // of these as arrays/strings with no undefined checks (e.g.
          // `...profile.strengths` with no `|| []`), since that file's
          // contract is "always receives a complete ResumeProfile". Rather
          // than patch every unguarded access site in a shared generator
          // library, the fix belongs here: always hand back a complete,
          // valid ResumeProfile, carrying over whatever the input had for
          // fields the rewrite doesn't touch.
          const inputProfile = resumeProfileRaw as Record<string, unknown>;
          const parsedRecord = parsed as Record<string, unknown>;

          const normalizedProfile = {
            ...parsed,
            strengths: Array.isArray(parsedRecord.strengths)
              ? parsedRecord.strengths
              : Array.isArray(inputProfile.strengths)
                ? inputProfile.strengths
                : [],

            additionalEvidence: Array.isArray(parsedRecord.additionalEvidence)
              ? parsedRecord.additionalEvidence
              : Array.isArray(inputProfile.additionalEvidence)
                ? inputProfile.additionalEvidence
                : [],

            warnings: Array.isArray(parsedRecord.warnings)
              ? parsedRecord.warnings
              : Array.isArray(inputProfile.warnings)
                ? inputProfile.warnings
                : [],

            skills: Array.isArray(parsed.skills) ? parsed.skills : Array.isArray(inputProfile.skills) ? inputProfile.skills : [],
            experience: Array.isArray(parsed.experience) ? parsed.experience : [],
            education: Array.isArray(parsed.education) ? parsed.education : [],
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            languages: Array.isArray(parsed.languages) ? parsed.languages : [],
            certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
            rawText: typeof (parsed as Record<string, unknown>).rawText === "string"
              ? (parsed as Record<string, unknown>).rawText
              : (typeof inputProfile.rawText === "string" ? inputProfile.rawText : ""),
            previewText: typeof (parsed as Record<string, unknown>).previewText === "string"
              ? (parsed as Record<string, unknown>).previewText
              : (typeof inputProfile.previewText === "string" ? inputProfile.previewText : ""),
            summary: typeof parsed.summary === "string" ? parsed.summary : "",
          };

          const originalProfile = completeResumeProfile(inputProfile as any, cvText || "");
          const preservedProfile = mergePreservingOriginalStructure(originalProfile, normalizedProfile as any);
          const plainTextCv = formatResumeProfileAsPlainText(preservedProfile as RewrittenResumeProfile);
          return NextResponse.json({
            success: true,
            output: plainTextCv,
            resumeProfile: preservedProfile,
            model,
            provider: "openrouter",
            action,
          });
        }
        // If JSON parsing failed or shape was wrong, fall through to the
        // plain-text path below as a safety net rather than failing the
        // request outright.
      } catch (jsonError) {
        console.error("[copilot] structured cv_rewrite_ats failed, falling back to plain text:", jsonError);
        // Fall through to plain-text path below.
      }
    }

    const output = await askOpenRouter(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userPrompt },
      ],
      { model, temperature, maxTokens },
    );

    return NextResponse.json({
      success: true,
      output: output || buildFallback(targetRole),
      model,
      provider: "openrouter",
      action,
    });
  } catch (error) {
    console.error("Work-O-Bot API failed:", error);
    return NextResponse.json(
      { success: true, output: buildFallback("target role"), provider: "local_fallback" },
      { status: 200 },
    );
  }
}
