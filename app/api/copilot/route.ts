import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CopilotRequest = {
  action?: string;
  question?: string;
  answer?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterName?: string;
  recruiterRole?: string;
};

function clean(value: unknown, max = 5000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY is missing.",
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as CopilotRequest;

    const action = clean(body.action, 80) || "recruiter_analysis";
    const question = clean(body.question, 2000);
    const answer = clean(body.answer, 2500);
    const cvText = clean(body.cvText, 4500);
    const jobDescription = clean(body.jobDescription, 3500);
    const targetRole = clean(body.targetRole, 200) || "target role";
    const targetMarket = clean(body.targetMarket, 120) || "Global";
    const recruiterName = clean(body.recruiterName, 80) || "Recruiter";
    const recruiterRole = clean(body.recruiterRole, 120) || "AI Recruiter";

    const prompt = `
You are ${recruiterName}, a ${recruiterRole}.
You are NOT a generic career coach.
You are an experienced recruiter giving live interview copilot guidance while the candidate is speaking.

TASK:
Analyze the answer for action: ${action}.

STRICT RULES:
- NEVER invent candidate experience.
- ONLY use the CV, job description, question, and answer provided.
- If evidence is missing, say it is missing.
- Do NOT praise weak answers.
- Challenge vague answers.
- Focus on recruiter trust, not motivation.
- Keep every section short enough to read during a live interview.
- Do not return long paragraphs or a full report.

EVALUATE:
- measurable impact
- ownership
- clarity
- STAR structure
- role fit
- confidence
- likely recruiter doubts
- likely follow-up questions

RETURN IN THIS EXACT FORMAT ONLY:

Say next:
...

Add proof:
...

Recruiter concern:
...

Likely follow-up:
...

Signal:
Good / Neutral / Risky

QUESTION:
${question || "No question provided."}

CANDIDATE ANSWER:
${answer || "No answer provided."}

TARGET ROLE:
${targetRole}

TARGET MARKET:
${targetMarket}

CV CONTEXT:
${cvText || "No CV text provided."}

JOB DESCRIPTION:
${jobDescription || "No job description provided."}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.22,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      output: completion.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error("Copilot API failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Copilot failed",
      },
      { status: 500 },
    );
  }
}
