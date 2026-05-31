import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      "Act as a practical career copilot. Answer the user's question using the CV, role, market, and job context when relevant.",
    interview_coach:
      "Act as Live Copilot during an interview. Give short real-time suggestions: what to say next, what to avoid, one stronger phrase, and one likely follow-up. Keep it compact and usable while speaking.",
    recruiter_intent:
      "Explain what the recruiter is really testing behind the question and what a strong answer must prove.",
    expectation:
      "Explain the hidden recruiter expectation behind the question and the proof the candidate should show.",
    rewrite:
      "Rewrite the candidate answer to sound clearer, stronger, more confident, and recruiter-ready without inventing facts.",
    star:
      "Convert the answer into concise STAR format. Preserve facts. Use placeholders for missing facts.",
    metrics:
      "Find where measurable impact is missing and suggest safe metric placeholders such as [add number], [time saved], [tickets reduced], or [customer impact].",
    ownership:
      "Improve ownership language so the candidate's personal contribution is clearer and not hidden behind team language.",
    concise:
      "Shorten the answer to a strong 45–75 second interview response while keeping proof, ownership, and role relevance.",
    followups:
      "Predict likely recruiter follow-up questions and give short preparation notes for each.",
    score:
      "Score the answer using recruiter trust, ownership, measurable impact, clarity, STAR structure, and role fit.",
    magic:
      "Do a complete recruiter-aware improvement: diagnose, rewrite, score, predict follow-ups, and give the next practice step.",
    cv_improve:
      "Improve the user's CV positioning for the target role and market. Give concrete bullet rewrite suggestions without inventing experience.",
    cover_letter:
      "Draft a concise, role-specific cover letter using only the CV and job description. Use placeholders where facts are missing.",
    job_fit:
      "Evaluate job fit honestly. Compare CV evidence with the job description. Show strengths, gaps, and whether the user should apply, tailor, or skip.",
    find_jobs_strategy:
      "Create a practical job-search strategy: target titles, keywords, platforms, filters, and search phrases based on the user's CV, role, and market.",
    linkedin_message:
      "Write a concise LinkedIn outreach message tailored to the role or company. Keep it natural and not desperate.",
    email_reply:
      "Draft or improve a professional email reply for career, recruiter, application, or interview situations.",
    salary_negotiation:
      "Help the user prepare a salary negotiation response. Be realistic, polite, and avoid legal/financial certainty.",
    career_plan:
      "Create a clear short-term career plan with immediate next steps, skill gaps, portfolio ideas, and application strategy.",
  };

  return instructions[action] || instructions.career_chat;
}

function outputFormat(action: CopilotAction) {
  if (action === "cover_letter") {
    return `
OUTPUT FORMAT:
1. Quick fit note
2. Cover letter draft
3. What to personalize before sending
4. One stronger alternative opening
`.trim();
  }

  if (action === "job_fit") {
    return `
OUTPUT FORMAT:
1. Fit verdict: Apply / Tailor first / Skip for now
2. Strong matches
3. Gaps or risks
4. CV changes before applying
5. Interview risks to prepare
`.trim();
  }

  if (action === "find_jobs_strategy") {
    return `
OUTPUT FORMAT:
1. Best target job titles
2. Search keywords
3. Where to search
4. Filters to use
5. 7-day application plan
`.trim();
  }

  if (action === "cv_improve") {
    return `
OUTPUT FORMAT:
1. CV positioning diagnosis
2. Strong bullets to keep
3. Bullets to rewrite
4. Missing proof / metrics
5. Recommended CV headline
6. Next step
`.trim();
  }

  if (action === "career_plan") {
    return `
OUTPUT FORMAT:
1. Current position
2. Best next role direction
3. 30-day plan
4. Skills to strengthen
5. Portfolio / proof ideas
6. Next action today
`.trim();
  }

  if (action === "interview_coach" || action === "magic") {
    return `
OUTPUT FORMAT:
1. Say next: one short sentence the user can say now
2. Improve: one specific fix
3. Avoid: one risk or unsupported claim to avoid
4. Likely follow-up: one recruiter question
5. Score signal: Good / Neutral / Risky
`.trim();
  }

  return `
OUTPUT FORMAT:
1. Recruiter intent
2. What is weak or risky
3. Improved answer or response
4. Likely follow-up questions
5. Trust score /100
6. One next practice step
`.trim();
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is missing." },
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

    const systemPrompt = `
You are Work-O-Bot, the premium career copilot inside WorkZo AI.

You are NOT a generic chatbot.
You are a recruiter-aware career assistant that helps with:
- interview answer rescue
- CV improvement
- cover letters
- job-fit decisions
- job-search strategy
- recruiter messages and professional replies
- salary/interview preparation
- next-step career planning

STRICT TRUTH RULES:
- Never invent candidate experience.
- Never invent company names, employers, projects, metrics, education, tools, or achievements.
- Only use facts clearly present in the candidate answer, CV text, job description, or user message.
- If a useful fact is missing, use a clear placeholder like [add measurable result] or [add specific project].
- If evidence is unclear, say it is unclear.
- Be direct, practical, and immediately usable.
- Do not sound motivational-only. Give concrete edits and next steps.
- Keep the response structured and easy to copy.

RECRUITER / CAREER CONTEXT:
Recruiter name: ${recruiterName}
Recruiter role: ${recruiterRole}
Recruiter state: ${recruiterState}
Target role: ${targetRole}
Target market: ${targetMarket}

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.22,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const output = completion.choices[0]?.message?.content || "Work-O-Bot could not generate a response.";

    return NextResponse.json({
      success: true,
      output,
      model: "gpt-4o-mini",
      action,
    });
  } catch (error) {
    console.error("Work-O-Bot API failed:", error);

    return NextResponse.json(
      { success: false, error: "Work-O-Bot could not generate a response." },
      { status: 500 },
    );
  }
}
