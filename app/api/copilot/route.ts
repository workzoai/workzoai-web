import { NextResponse } from "next/server";
import { askOpenRouter } from "@/lib/openrouter";

type CopilotAction =
  | "career_chat"
  | "interview_coach"
  | "magic"
  | "cv_improve"
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
};

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
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return "Recruiter memory could not be serialized.";
  }
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
  if (action === "cv_improve") return "Improve the user's CV positioning for the target role. Give concrete bullet rewrite suggestions without inventing experience.";
  if (action === "cover_letter") return "Draft or improve a concise, role-specific cover letter using only the CV and job description. Use placeholders where facts are missing.";
  if (action === "find_jobs_strategy") return "Create a practical job-search strategy: target titles, keywords, platforms, filters, outreach ideas, and a 7-day application plan.";
  if (action === "linkedin_message") return "Write a concise LinkedIn outreach message or recruiter reply. Keep it natural, specific, and not desperate.";
  if (action === "magic") return "Do a complete recruiter-aware improvement: diagnose, rewrite, score, predict follow-ups, and give the next practice step.";
  if (action === "job_fit") return "Evaluate job fit honestly. Compare CV evidence with the job description. Show strengths, gaps, and apply/tailor/skip verdict.";
  return "Act as a senior career guidance coach. Give practical, honest, context-aware advice using the user's CV, target role, job description, market, and recent conversation.";
}

function outputFormat(action: CopilotAction) {
  if (action === "cv_improve") return "OUTPUT FORMAT:\n1. CV positioning diagnosis\n2. Strong bullets to keep\n3. Bullets to rewrite\n4. Missing proof / metrics\n5. Recommended CV headline\n6. Next step";
  if (action === "cover_letter") return "OUTPUT FORMAT:\n1. Quick fit note\n2. Cover letter draft\n3. What to personalize before sending\n4. One stronger alternative opening";
  if (action === "find_jobs_strategy") return "OUTPUT FORMAT:\n1. Best target job titles\n2. Search keywords\n3. Where to search\n4. Filters to use\n5. 7-day application plan";
  if (action === "magic") return "OUTPUT FORMAT:\n1. Recruiter diagnosis\n2. Stronger answer\n3. Trust score /100\n4. What is still missing\n5. Likely follow-up questions\n6. Next practice step";
  return "OUTPUT FORMAT:\n1. Direct answer\n2. Recruiter / career perspective\n3. Recommended action\n4. Example wording or example step\n5. What to avoid\n6. One action to do today";
}

function buildFallback(targetRole: string) {
  return `1. Direct answer
Work-O-Bot could not reach the AI model, but here is a safe fallback.

2. Recruiter / career perspective
Recruiters trust specific evidence more than broad claims.

3. Recommended action
For ${targetRole}, add one real example, one personal action, and one measurable result.

4. Example wording
"In my previous role, I handled [specific situation], took [personal action], and achieved [measurable result]."

5. What to avoid
Avoid vague claims like "I worked on many things" without proof.

6. One action today
Rewrite one CV bullet or interview answer with a clear result.`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ success: false, error: "OPENROUTER_API_KEY is missing." }, { status: 500 });
    }

    const body = (await request.json()) as CopilotRequest;
    const action = normalizeAction(body.action, body.mode);
    const message = cleanMultiline(body.message || body.prompt, 4000);
    const question = cleanMultiline(body.question, 2500);
    const answer = cleanMultiline(body.answer, 6000);
    const cvText = cleanMultiline(body.cvText, 9000);
    const jobDescription = cleanMultiline(body.jobDescription, 7000);
    const targetRole = cleanText(body.targetRole, 180) || "target role";
    const targetMarket = cleanText(body.targetMarket, 120) || "Global";
    const recruiterName = cleanText(body.recruiterName, 80) || "Work-O-Bot";
    const recruiterRole = cleanText(body.recruiterRole, 120) || "Career Copilot";
    const recruiterMemory = safeJson(body.recruiterMemory, 3500);

    const systemPrompt = `
You are Work-O-Bot, the intelligent career guidance copilot inside WorkZo AI.

You are NOT a generic chatbot.
You are a senior career strategist, recruiter-aware interview coach, and practical job-search guide.

STRICT TRUTH + QUALITY RULES:
- Never invent candidate experience, companies, tools, projects, metrics, education, or achievements.
- Only use facts clearly present in the candidate answer, CV text, job description, or user message.
- Use placeholders like [add measurable result] when facts are missing.
- Give honest guidance, including when a role is a weak fit.
- Be specific, practical, and immediately usable.
- Always include one concrete action the user can do today.

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

    const userPrompt = `
USER MESSAGE:
${message || "No separate user message provided."}

RECRUITER QUESTION:
${question || "No recruiter question provided."}

CANDIDATE ANSWER:
${answer || "No candidate answer provided."}

CANDIDATE CV CONTEXT:
${cvText || "No CV context provided."}

JOB DESCRIPTION:
${jobDescription || "No job description provided."}

RECRUITER MEMORY:
${recruiterMemory}
`.trim();

    const output = await askOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.22, maxTokens: 900 },
    );

    return NextResponse.json({
      success: true,
      output: output || buildFallback(targetRole),
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      provider: "openrouter",
      action,
    });
  } catch (error) {
    console.error("Work-O-Bot API failed:", error);
    return NextResponse.json({ success: true, output: buildFallback("target role"), provider: "local_fallback" }, { status: 200 });
  }
}
