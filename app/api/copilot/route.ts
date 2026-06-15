import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { askOpenRouter } from "@/lib/openrouter";

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
    "Analyse the candidate's CV against the target role and job description. Provide concrete, actionable rewrite recommendations.",
    "",
    "CROSS-DOMAIN ABSTRACTION: If the candidate's background is in a different domain to the target role, translate their real experience into transferable functional language that maps to the JD. Use these mappings as a guide (adapt dynamically to any domain pair):",
    "  - Physical/hardware installation work → Systems deployment & configuration",
    "  - Cross-functional engineering teams → Cross-functional stakeholder collaboration / technical consulting",
    "  - Troubleshooting equipment/machinery → Root-cause analysis, technical problem-solving, 3rd-level support",
    "  - Writing technical spec sheets / engineering docs → Creating system documentation, SOPs, integration guides",
    "  - Product lifecycle / change management (PLM) → Systems integration lifecycle, change management processes",
    "  - Quality control / compliance processes → Process governance, compliance documentation",
    "",
    "RULES:",
    "1. NO FABRICATION — only use evidence present in the CV. Do not invent tools, credentials, or achievements.",
    "2. Every rewritten bullet MUST use a strong action verb (Configured, Integrated, Coordinated, Authored, Optimised, Resolved, Deployed, Documented).",
    "3. Apply the X-Y-Z formula where evidence exists: Accomplished [X], measured by [Y], by doing [Z].",
    "4. Prioritise JD keywords the candidate has genuine evidence for — surface them prominently.",
    "5. Flag honestly which JD requirements the candidate lacks evidence for.",
  ].join("\n");
  if (action === "cv_rewrite_ats") return [
    "Rewrite the candidate's CV as plain ATS text to better match the job description.",
    "",
    "CROSS-DOMAIN REWRITING: If the candidate's background is from a different domain, translate their real experience using functional abstraction — do not fabricate, but reframe genuine skills using language that maps to the target role:",
    "  - Physical/hardware installation → systems deployment & on-site configuration",
    "  - Engineering change management → technical change control & process documentation",
    "  - Cross-functional team collaboration → stakeholder coordination & technical consulting",
    "  - Equipment troubleshooting → root-cause analysis & technical problem resolution",
    "  - Technical drawing / specification writing → system documentation & SOP authoring",
    "  - PLM / Windchill tools → product lifecycle systems & configuration management tools",
    "",
    "RULES:",
    "1. Do NOT invent companies, job titles, dates, employers, degrees, metrics, or achievements not in the original CV.",
    "2. Reword bullets into outcome-oriented language using strong action verbs.",
    "3. Naturally weave in JD keywords the candidate has genuine evidence for.",
    "4. Keep the same structure: same section order, same jobs, same number of bullets per role.",
    "5. Rewrite the summary to position the candidate for the target role using their real background.",
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
  if (action === "cv_rewrite_ats") return `OUTPUT FORMAT:\nReturn ONLY the rewritten CV as plain text, in the EXACT same structure as the input ATS CV:\n- Same section order and section headers.\n- Same number of jobs, order, company names, job titles, and dates — do not add, remove, or reorder.\n- Same number of bullets per job — rewrite wording only.\n- Same skills list, optionally reordered to surface JD-relevant skills first.\nDo NOT include any preamble, explanation, markdown fences, or commentary. Output the CV text only.`;
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
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "anonymous";
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

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

  // 3. Rate limit
  const rateLimitKey = getRateLimitKey(request);
  const rateLimit = isPro ? 80 : isPremium ? 40 : 5;
  if (!checkRateLimit(rateLimitKey, rateLimit)) {
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
        exp.slice(0, 6).forEach((e) => {
          const title = [e.title, e.company, e.dates].filter(Boolean).join(" | ");
          lines.push(`  ${title}`);
          const bullets = e.bullets as string[];
          if (Array.isArray(bullets)) bullets.slice(0, 5).forEach((b) => lines.push(`    • ${b}`));
        });
      }
      const edu = profile.education as Array<Record<string, unknown>>;
      if (Array.isArray(edu) && edu.length) {
        lines.push("\nEducation:");
        edu.slice(0, 4).forEach((e) => {
          lines.push(`  ${[e.degree, e.institution, e.dates].filter(Boolean).join(" | ")}`);
        });
      }
      const skills = profile.skills as string[];
      if (Array.isArray(skills) && skills.length) lines.push(`\nSkills: ${skills.slice(0, 24).join(", ")}`);
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
    const maxTokens = action === "cv_rewrite_ats" ? 2400 : isWriting ? 1200 : 900;
    const temperature = action === "cv_rewrite_ats" ? 0.15 : isWriting ? 0.20 : 0.25;

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
