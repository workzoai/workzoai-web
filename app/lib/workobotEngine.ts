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

export function getWorkobotMode(input: string): WorkobotMode {
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
  if (lower.includes("stronger")) return "rewrite";
  if (lower.includes("what recruiter wants")) return "expectation";
  if (lower.includes("star")) return "star";

  return "career_chat";
}

export function buildWorkobotContextSummary(input: {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
}) {
  const hasCv = Boolean(input.cvText?.trim());
  const hasJd = Boolean(input.jobDescription?.trim());
  const role = input.targetRole?.trim() || "target role";
  const market = input.targetMarket?.trim() || "Global";

  return {
    role,
    market,
    hasCv,
    hasJd,
    contextLabel: `${role} · ${market}${hasCv ? " · CV available" : " · no CV"}${hasJd ? " · JD available" : " · no JD"}`,
    missingContextAdvice: [
      !hasCv && "Upload or paste your CV for profile-aware guidance.",
      !hasJd && "Add a job description for role-specific advice.",
    ].filter(Boolean) as string[],
  };
}
