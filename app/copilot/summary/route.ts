import { NextResponse } from "next/server";
import { askOpenRouter } from "@/lib/openrouter";

type CopilotAction =
  | "career_chat"
  | "interview_coach"
  | "recruiter_intent"
  | "expectation"
  | "rewrite"
  | "star"
  | "metrics"
  | "ownership"
  | "concise"
  | "followups"
  | "score"
  | "magic"
  | "cv_improve"
  | "cover_letter"
  | "job_fit"
  | "find_jobs_strategy"
  | "linkedin_message"
  | "email_reply"
  | "salary_negotiation"
  | "career_plan";

type CopilotRequest = {
  action?: CopilotAction;
  message?: string;
  question?: string;
  answer?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterName?: string;
  recruiterRole?: string;
  recruiterState?: string;
  recruiterMemory?: unknown;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
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

function actionInstruction(action: CopilotAction) {
  const instructions: Record<CopilotAction, string> = {
    career_chat:
      "Act as a senior career guidance coach. Give practical, honest, context-aware advice using the user's CV, target role, job description, market, and recent conversation.",
    interview_coach:
      "Act as a live interview copilot. Give short, real-time guidance: what to say next, what to avoid, one stronger phrase, and one likely recruiter follow-up.",
    recruiter_intent:
      "Explain what the recruiter is really testing behind the question and what a strong answer must prove.",
    expectation:
      "Explain the hidden recruiter expectation behind the question and the proof the candidate should show.",
    rewrite:
      "Rewrite the candidate answer to sound clearer, stronger, more confident, and recruiter-ready without inventing facts.",
    star:
      "Convert the answer into concise STAR format. Preserve facts. Use placeholders where facts are missing.",
    metrics:
      "Find where measurable impact is missing and suggest safe metric placeholders such as [add number], [time saved], [tickets reduced], or [customer impact].",
    ownership:
      "Improve ownership language so the candidate's personal contribution is clearer and not hidden behind team language.",
    concise:
      "Shorten the answer to a strong 45-75 second interview response while keeping proof, ownership, and role relevance.",
    followups:
      "Predict likely recruiter follow-up questions and give short preparation notes for each.",
    score:
      "Score the answer using recruiter trust, ownership, measurable impact, clarity, STAR structure, and role fit.",
    magic:
      "Do a complete recruiter-aware improvement: diagnose, rewrite, score, predict follow-ups, and give the next practice step.",
    cv_improve:
      "Improve the user's CV positioning for the target role and market. Give concrete bullet rewrite suggestions without inventing experience.",
    cover_letter:
      "Draft or improve a concise, role-specific cover letter using only the CV and job description. Use placeholders where facts are missing.",
    job_fit:
      "Evaluate job fit honestly. Compare CV evidence with the job description. Show strengths, gaps, and whether the user should apply, tailor first, or skip for now.",
    find_jobs_strategy:
      "Create a practical job-search strategy: target titles, keywords, platforms, filters, outreach ideas, and a 7-day application plan based on the user's CV, role, and market.",
    linkedin_message:
      "Write a concise LinkedIn outreach message tailored to the role, company, or recruiter. Keep it natural, specific, and not desperate.",
    email_reply:
      "Draft or improve a professional email reply for career, recruiter, application, or interview situations.",
    salary_negotiation:
      "Help the user prepare a salary negotiation response. Be realistic, polite, and avoid legal or financial certainty.",
    career_plan:
      "Create a clear short-term career plan with immediate next steps, skill gaps, portfolio ideas, application strategy, and interview preparation.",
  };

  return instructions[action] || instructions.career_chat;
}

function outputFormat(action: CopilotAction) {
  if (action === "cover_letter") {
    return `OUTPUT FORMAT:
1. Quick fit note
2. Cover letter draft
3. What to personalize before sending
4. One stronger alternative opening`;
  }

  if (action === "job_fit") {
    return `OUTPUT FORMAT:
1. Fit verdict: Apply / Tailor first / Skip for now
2. Strong matches
3. Gaps or risks
4. CV changes before applying
5. Interview risks to prepare`;
  }

  if (action === "find_jobs_strategy") {
    return `OUTPUT FORMAT:
1. Best target job titles
2. Search keywords
3. Where to search
4. Filters to use
5. 7-day application plan`;
  }

  if (action === "cv_improve") {
    return `OUTPUT FORMAT:
1. CV positioning diagnosis
2. Strong bullets to keep
3. Bullets to rewrite
4. Missing proof / metrics
5. Recommended CV headline
6. Next step`;
  }

  if (action === "career_plan") {
    return `OUTPUT FORMAT:
1. Current position
2. Best next role direction
3. 7-day plan
4. 30-day plan
5. Skills to strengthen
6. Proof / portfolio ideas
7. One action to do today`;
  }

  if (action === "interview_coach") {
    return `OUTPUT FORMAT:
1. Say next: one short sentence the user can say now
2. Improve: one specific fix
3. Avoid: one risk or unsupported claim
4. Likely follow-up: one recruiter question
5. Score signal: Good / Neutral / Risky`;
  }

  if (action === "magic") {
    return `OUTPUT FORMAT:
1. Recruiter diagnosis
2. Stronger answer
3. Trust score /100
4. What is still missing
5. Likely follow-up questions
6. Next practice step`;
  }

  return `OUTPUT FORMAT:
1. Direct answer
2. Recruiter / career perspective
3. Recommended action
4. Example wording or example step
5. What to avoid
6. One action to do today`;
}

function buildLocalFallback(action: CopilotAction, targetRole: string) {
  if (action === "career_plan") {
    return `1. Current position
You are preparing for ${targetRole}. Make your CV, job search, and interview preparation point toward the same role.

2. Best next role direction
Choose 1-2 target titles and avoid applying too broadly.

3. 7-day plan
Day 1: Clean your CV headline and summary.
Day 2: Pick 10 matching jobs.
Day 3: Tailor your CV for 3 jobs.
Day 4: Practice 5 interview questions.
Day 5: Rewrite weak answers with metrics.
Day 6: Send applications.
Day 7: Review what worked and adjust.

4. One action today
Pick one target job and tailor your CV summary for it.`;
  }

  if (action === "job_fit") {
    return `1. Fit verdict
Tailor first.

2. Strong matches
Use your CV evidence that directly matches the role.

3. Gaps or risks
Any requirement not clearly proven in your CV may create recruiter doubt.

4. CV changes before applying
Add measurable results, tools, role keywords, and stronger ownership.

5. Interview risks to prepare
Prepare examples that prove impact, ownership, and decision-making.`;
  }

  return `1. Direct answer
Work-O-Bot could not reach the AI model, but here is a safe fallback.

2. Recruiter / career perspective
Recruiters trust specific evidence more than broad claims.

3. Recommended action
Add one real example, one personal action, and one measurable result.

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
      return NextResponse.json(
        { success: false, error: "OPENROUTER_API_KEY is missing." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as CopilotRequest;

    const action = body.action || "career_chat";
    const message = cleanMultiline(body.message, 4000);
    const question = cleanMultiline(body.question, 2500);
    const answer = cleanMultiline(body.answer, 6000);
    const cvText = cleanMultiline(body.cvText, 9000);
    const jobDescription = cleanMultiline(body.jobDescription, 7000);
    const targetRole = cleanText(body.targetRole, 180) || "target role";
    const targetMarket = cleanText(body.targetMarket, 120) || "Global";
    const recruiterName = cleanText(body.recruiterName, 80) || "Recruiter";
    const recruiterRole = cleanText(body.recruiterRole, 120) || "AI Recruiter";
    const recruiterState = cleanText(body.recruiterState, 120) || "Evaluating";
    const recruiterMemory = safeJson(body.recruiterMemory, 3500);

    const conversation = Array.isArray(body.conversation)
      ? body.conversation
          .slice(-8)
          .map((item) => `${item.role.toUpperCase()}: ${cleanMultiline(item.content, 900)}`)
          .join("\n")
      : "No prior copilot conversation.";

    const hasCv = Boolean(cvText);
    const hasJob = Boolean(jobDescription);

    const systemPrompt = `
You are Work-O-Bot, the intelligent career guidance copilot inside WorkZo AI.

You are NOT a generic chatbot.
You are a senior career strategist, recruiter-aware interview coach, and practical job-search guide.

You help with:
- career direction and role choice
- interview answer rescue and follow-up preparation
- CV positioning and ATS-aware bullet improvements
- cover letters and recruiter messages
- job-fit decisions based on evidence
- job-search strategy with keywords and filters
- salary/interview preparation
- short-term career planning with realistic next steps

STRICT TRUTH + QUALITY RULES:
- Never invent candidate experience.
- Never invent company names, employers, projects, metrics, education, tools, or achievements.
- Only use facts clearly present in the candidate answer, CV text, job description, or user message.
- If a useful fact is missing, use a clear placeholder like [add measurable result] or [add specific project].
- If evidence is unclear, say it is unclear.
- Give honest guidance, including when a role is a weak fit.
- Be specific, practical, and immediately usable.
- Do not sound motivational-only.
- Do not over-explain.
- Use short sections with clear next actions.
- Always include at least one concrete action the user can do today.
- If CV or JD context is missing, say what extra information would improve the advice, but still answer usefully.

RECRUITER / CAREER CONTEXT:
Recruiter name: ${recruiterName}
Recruiter role: ${recruiterRole}
Recruiter state: ${recruiterState}
Target role: ${targetRole}
Target market: ${targetMarket}
CV context available: ${hasCv ? "Yes" : "No"}
Job description available: ${hasJob ? "Yes" : "No"}

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

RECENT COPILOT CONVERSATION:
${conversation}
`.trim();

    const output = await askOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.22,
        maxTokens: 900,
      },
    );

    return NextResponse.json({
      success: true,
      output: output || buildLocalFallback(action, targetRole),
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      provider: "openrouter",
      action,
    });
  } catch (error) {
    console.error("Work-O-Bot OpenRouter API failed:", error);

    return NextResponse.json(
      {
        success: true,
        output: buildLocalFallback("career_chat", "target role"),
        provider: "local_fallback",
        action: "career_chat",
      },
      { status: 200 },
    );
  }
}
