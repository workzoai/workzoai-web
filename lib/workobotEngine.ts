// lib/workobotEngine.ts
//
// Work-O-Bot copilot intent classifier.
//
// Three-tier routing:
//   1. Narrow regex fast-path , near-zero latency, only fires on unambiguous signals
//   2. LLM classification      , async, handles paraphrases, multi-intent, non-English
//   3. Legacy heuristic fallback, original broad-keyword logic, used if LLM unavailable
//
// Exported API (drop-in replacements for the original):
//   getWorkobotMode(input)      , sync, uses fast-path then heuristic
//   getWorkobotModeAsync(input) , async, uses fast-path then LLM then heuristic
//   legacyHeuristicMode(input)  , original logic, kept for explicit use / testing

export type WorkobotMode =
  | "career_chat"
  | "interview_coach"
  | "cv_improve"
  | "job_fit"
  | "cover_letter"
  | "find_jobs_strategy"
  | "linkedin_message"
  | "email_reply"
  | "salary_negotiation"
  | "career_plan"
  | "rewrite"
  | "star"
  | "expectation"
  | "coaching";

const VALID_MODES = new Set<WorkobotMode>([
  "career_chat", "interview_coach", "cv_improve", "job_fit", "cover_letter",
  "find_jobs_strategy", "linkedin_message", "email_reply", "salary_negotiation",
  "career_plan", "rewrite", "star", "expectation", "coaching",
]);

// ---------------------------------------------------------------------------
// Tier 1, narrow regex fast-path
// Only fire when the phrase is essentially unambiguous on its own.
// Deliberately avoids broad terms like "cv" alone (could be part of anything).
// ---------------------------------------------------------------------------
function fastPathMode(input: string): WorkobotMode | null {
  const l = input.toLowerCase();

  // CV/resume, specific compound phrases only
  if (/\b(ats score|cv bullet|resume bullet|cv headline|cv summary|resume headline|cv rewrite|resume rewrite|ats optimis|ats optimiz)\b/i.test(l)) return "cv_improve";
  // Cover letter, near-universal phrasing
  if (/\b(cover letter|motivation letter|anschreiben|covering letter)\b/i.test(l)) return "cover_letter";
  // Job search strategy
  if (/\b(job search strategy|search strategy|where (should i|to) apply|7.day application plan|application plan|find (jobs|roles) (on|via|using))\b/i.test(l)) return "find_jobs_strategy";
  // LinkedIn outreach, specific action phrases
  if (/\b(linkedin (outreach|cold message|connect (note|message|request)|dm)|outreach (message|note) (on|via) linkedin|recruiter message on linkedin)\b/i.test(l)) return "linkedin_message";
  // Email reply, explicit
  if (/\b(reply to (the )?(recruiter|hr|hiring manager)|email reply|respond to (the )?(recruiter|offer|rejection) email|draft (a |an )?(email|reply) (to|for) (the )?(recruiter|hr))\b/i.test(l)) return "email_reply";
  // Salary negotiation, unambiguous
  if (/\b(salary negotiat|negotiate (salary|compensation|comp|offer|pay)|counter.offer|offer negotiat|negotiating (the )?offer)\b/i.test(l)) return "salary_negotiation";
  // STAR method, explicit
  if (/\b(star (method|format|answer|structure|technique)|situation.task.action.result)\b/i.test(l)) return "star";
  // Rewrite, explicit target
  if (/\brewrite (this|my|the) (answer|bullet|cv|resume|sentence|paragraph|section|summary)\b/i.test(l)) return "rewrite";
  // What recruiter wants, explicit
  if (/\bwhat (does |do )?(the |a |this )?recruiter (want|expect|look for|care about)\b/i.test(l)) return "expectation";
  // Job fit / should I apply, explicit
  if (/\b(should i apply|am i a (good )?fit|is this role (right|a (good )?fit) for me|job fit (analysis|check|score))\b/i.test(l)) return "job_fit";
  // Career plan, explicit long-term framing
  if (/\b(career (roadmap|plan|path|switch|pivot|transition|change)|long.term (career|goal|plan)|switch (career|industry)|career change plan)\b/i.test(l)) return "career_plan";

  return null;
}

// ---------------------------------------------------------------------------
// Tier 2, LLM classification
// Called only when fast-path returns null.
// Uses OpenRouter with the project's configured model at temperature 0.
// Falls through to the legacy heuristic on any failure.
// ---------------------------------------------------------------------------
const LLM_SYSTEM_PROMPT = `You are a career copilot intent classifier. Classify the user message into exactly one mode.

Modes and when to use them:
career_chat        - general career advice or conversation that does not fit a specific task
interview_coach    - preparing, analysing, or improving a specific interview answer or question
cv_improve         - improving CV/résumé content, ATS optimisation, positioning, bullet rewrites
job_fit            - evaluating whether a role matches the candidate's background
cover_letter       - writing or improving a cover letter or motivation letter
find_jobs_strategy - job-search strategy, where to apply, search keywords, platforms, filters
linkedin_message   - writing a LinkedIn outreach note, recruiter reply, or connection request
email_reply        - writing or improving a reply to a recruiter/HR email or offer email
salary_negotiation - negotiating salary, compensation, or a job offer
career_plan        - long-term career roadmap, role transitions, or industry switch planning
rewrite            - rewriting an existing answer, bullet point, or text block
star               - structuring an answer using the STAR or similar behavioural framework
expectation        - explaining what a recruiter is looking for or expects from this answer
coaching           - ongoing coaching loop, feedback, or incremental improvement plan

Reply with ONLY the mode name. Nothing else, no explanation, no punctuation, no markdown.`;

async function classifyWithLLM(input: string): Promise<WorkobotMode> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return legacyHeuristicMode(input);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://workzoai.com",
        "X-Title": "WorkZo AI",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: LLM_SYSTEM_PROMPT },
          { role: "user", content: input.slice(0, 600) },
        ],
        temperature: 0,
        max_tokens: 12,
      }),
    });

    if (!res.ok) return legacyHeuristicMode(input);

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "") as WorkobotMode;

    return VALID_MODES.has(raw) ? raw : legacyHeuristicMode(input);
  } catch {
    return legacyHeuristicMode(input);
  }
}

// ---------------------------------------------------------------------------
// Tier 3, legacy heuristic (original logic, unchanged)
// Kept as the always-available sync fallback.
// ---------------------------------------------------------------------------
export function legacyHeuristicMode(input: string): WorkobotMode {
  const lower = input.toLowerCase();

  if (/\b(cv|resume|ats|profile|headline|summary|bullet)\b/i.test(lower)) return "cv_improve";
  if (/\b(job fit|should i apply|apply|jd|job description|requirements|match|gap)\b/i.test(lower)) return "job_fit";
  if (/\b(cover letter|motivation letter|anschreiben)\b/i.test(lower)) return "cover_letter";
  if (/\b(find jobs|job search|where to apply|search strategy|keywords|linkedin jobs)\b/i.test(lower)) return "find_jobs_strategy";
  if (/\b(linkedin|connect message|outreach|networking)\b/i.test(lower)) return "linkedin_message";
  if (/\b(email|reply|respond|recruiter mail|hr mail)\b/i.test(lower)) return "email_reply";
  if (/\b(salary|offer|negotiate|compensation|pay)\b/i.test(lower)) return "salary_negotiation";
  if (/\b(plan|roadmap|next steps|career path|switch career|transition)\b/i.test(lower)) return "career_plan";
  if (/\b(interview|answer|question|follow up|follow-up|recruiter)\b/i.test(lower)) return "interview_coach";
  if (lower.includes("rewrite")) return "rewrite";
  if (lower.includes("what recruiter wants")) return "expectation";
  if (lower.includes("star")) return "star";

  return "career_chat";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synchronous mode detection.
 * Fast-path regex → legacy heuristic.
 * Zero network calls. Use when you need a result immediately (e.g. UI pre-fill).
 */
export function getWorkobotMode(input: string): WorkobotMode {
  return fastPathMode(input) ?? legacyHeuristicMode(input);
}

/**
 * Async mode detection.
 * Fast-path regex → LLM classification → legacy heuristic fallback.
 * Best accuracy for ambiguous, multilingual, or paraphrased inputs.
 * Use in API routes where you can afford an await.
 */
export async function getWorkobotModeAsync(input: string): Promise<WorkobotMode> {
  return fastPathMode(input) ?? classifyWithLLM(input);
}
