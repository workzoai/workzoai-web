/*
 * WorkZo AI - Free Tools Engine
 * Global backend utilities for public/free career tools.
 *
 * This file is intentionally deterministic and dependency-free so the free tools
 * can run safely without OpenAI cost. Premium routes can still use deeper LLM
 * logic elsewhere.
 */

export type FreeToolAction =
  | "cv_review"
  | "resume_tailor"
  | "cover_letter"
  | "interview_questions"
  | "professional_summary"
  | "star_story"
  | "resume_headline"
  | "ats_check";

export type FreeToolInput = {
  cvText?: string;
  resumeText?: string;
  jobDescription?: string;
  jdText?: string;
  targetRole?: string;
  role?: string;
  companyName?: string;
  language?: string;
  tone?: string;
  industry?: string;
  experienceText?: string;
};

function cleanText(value: unknown, max = 12000): string {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function titleCase(value: string): string {
  return compact(value)
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const SKILL_LIBRARY = [
  "sql", "python", "excel", "tableau", "power bi", "pandas", "numpy", "matplotlib", "seaborn",
  "statistics", "machine learning", "data analysis", "data visualization", "dashboard", "kpi", "etl",
  "api", "aws", "azure", "gcp", "git", "javascript", "typescript", "react", "node", "java",
  "project management", "stakeholder management", "customer success", "sales", "crm", "communication",
  "leadership", "agile", "scrum", "jira", "figma", "marketing", "seo", "content", "finance",
  "accounting", "risk", "compliance", "healthcare", "teaching", "training", "operations", "support",
];

const ACTION_VERBS = [
  "improved", "reduced", "increased", "built", "created", "analysed", "analyzed", "managed",
  "led", "delivered", "designed", "automated", "optimized", "resolved", "collaborated", "implemented",
];

function extractSkills(text: string): string[] {
  const l = text.toLowerCase();
  return unique(
    SKILL_LIBRARY.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(l))
      .map(titleCase),
  );
}

function extractKeywords(text: string, limit = 18): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "from", "that", "this", "will", "you", "are", "our", "your", "have", "has",
    "was", "were", "can", "all", "any", "job", "role", "work", "team", "about", "into", "using", "their",
    "candidate", "experience", "skills", "ability", "knowledge", "strong", "good", "excellent", "required",
  ]);
  const words = cleanText(text, 20000)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !stop.has(w));

  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => titleCase(word));
}

function inferRole(input: FreeToolInput): string {
  const explicit = cleanText(input.targetRole || input.role, 100);
  if (explicit) return explicit;
  const jd = cleanText(input.jobDescription || input.jdText, 4000);
  const match = jd.match(/(?:job title|title|role)[:\s-]+([^\n.]{3,80})/i);
  if (match?.[1]) return compact(match[1]);
  const common = [
    "Data Analyst", "Software Engineer", "Product Manager", "Customer Success Manager", "Sales Manager",
    "Project Manager", "Marketing Manager", "Business Analyst", "Technical Support Engineer", "HR Manager",
  ];
  const l = jd.toLowerCase();
  return common.find((r) => l.includes(r.toLowerCase())) || "the target role";
}

function splitSentences(text: string, limit = 8): string[] {
  return unique(
    cleanText(text, 12000)
      .split(/(?<=[.!?])\s+|\n+/)
      .map(compact)
      .filter((s) => s.length >= 30 && s.length <= 240),
  ).slice(0, limit);
}

function scoreCv(cvText: string, jdText: string) {
  const cv = cvText.toLowerCase();
  const jdSkills = extractSkills(jdText).map((s) => s.toLowerCase());
  const cvSkills = extractSkills(cvText).map((s) => s.toLowerCase());
  const matched = jdSkills.filter((s) => cvSkills.includes(s));
  const missing = jdSkills.filter((s) => !cvSkills.includes(s));
  const hasMetrics = /\b\d+\s*(%|percent|k|m|x|hours?|days?|users?|customers?|tickets?|projects?)\b/i.test(cvText);
  const hasActionVerbs = ACTION_VERBS.some((v) => cv.includes(v));
  const hasEducation = /\b(education|degree|bachelor|master|university|college|bootcamp|certification)\b/i.test(cvText);
  const hasExperience = /\b(experience|employment|work history|project|internship|volunteer)\b/i.test(cvText);
  const hasTools = cvSkills.length >= 5;

  let score = 45;
  score += Math.min(25, matched.length * 5);
  if (hasMetrics) score += 10;
  if (hasActionVerbs) score += 8;
  if (hasEducation) score += 5;
  if (hasExperience) score += 7;
  if (hasTools) score += 5;
  if (cvText.length < 900) score -= 10;
  if (cvText.length > 6000) score -= 5;

  return {
    score: Math.max(25, Math.min(96, score)),
    matchedSkills: matched.map(titleCase),
    missingSkills: missing.map(titleCase),
    cvSkills: cvSkills.map(titleCase),
    hasMetrics,
    hasActionVerbs,
    hasEducation,
    hasExperience,
  };
}

export function buildFreeCvReview(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText);
  const jdText = cleanText(input.jobDescription || input.jdText);
  const role = inferRole(input);

  if (!cvText) {
    return { ok: false, code: "missing_cv", message: "Please provide CV or resume text." };
  }

  const analysis = scoreCv(cvText, jdText);
  const strengths = [
    analysis.hasExperience ? "Includes work or project experience." : "Can still be positioned through projects, training, or transferable experience.",
    analysis.hasActionVerbs ? "Uses action-oriented language in parts of the CV." : "Has room to use stronger action verbs.",
    analysis.hasMetrics ? "Includes measurable impact, which helps credibility." : "Would become stronger with numbers, outcomes, or scale.",
    analysis.cvSkills.length ? `Mentions relevant skills such as ${analysis.cvSkills.slice(0, 5).join(", ")}.` : "Skills can be made more explicit.",
  ];

  const improvements = [
    !analysis.hasMetrics ? "Add measurable outcomes such as percentages, time saved, ticket volume, revenue, users, or project size." : "Keep measurable achievements close to the most relevant role bullets.",
    analysis.missingSkills.length ? `Add honest evidence for missing JD keywords: ${analysis.missingSkills.slice(0, 8).join(", ")}.` : "The CV already covers many visible JD keywords; focus on proof and clarity.",
    "Rewrite generic responsibilities into achievement bullets using action + task + tool + measurable outcome.",
    "Move the most role-relevant tools, projects, and achievements into the top third of the CV.",
  ];

  return {
    ok: true,
    tool: "Free CV Review",
    role,
    score: analysis.score,
    verdict: analysis.score >= 80 ? "Strong starting point" : analysis.score >= 65 ? "Good, but needs tailoring" : "Needs clearer role alignment",
    strengths,
    improvements,
    matchedSkills: analysis.matchedSkills,
    missingSkills: analysis.missingSkills,
    suggestedHeadline: role === "the target role" ? "Role-focused professional" : role,
    nextSteps: [
      "Tailor the summary to the target role.",
      "Add 3-5 role-specific keywords from the job description.",
      "Make at least two bullets measurable.",
      "Prepare one interview story for each major achievement.",
    ],
  };
}

export function buildAiResumeTailor(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText);
  const jdText = cleanText(input.jobDescription || input.jdText);
  const role = inferRole(input);

  if (!cvText) return { ok: false, code: "missing_cv", message: "Please provide CV or resume text." };
  if (!jdText) return { ok: false, code: "missing_jd", message: "Please provide a job description." };

  const review = scoreCv(cvText, jdText);
  const jdKeywords = unique([...extractSkills(jdText), ...extractKeywords(jdText, 10)]).slice(0, 14);
  const sourceSentences = splitSentences(cvText, 10);

  const tailoredSummary = `Motivated ${role} candidate with experience applying ${review.cvSkills.slice(0, 4).join(", ") || "analytical and problem-solving skills"} to solve practical business problems. Brings transferable experience, clear communication, and a strong interest in using data, tools, and structured thinking to support better decisions.`;

  const tailoredBullets = sourceSentences.slice(0, 5).map((s) => {
    const cleaned = s.replace(/^[-•*]\s*/, "");
    if (/\b(improved|reduced|increased|built|created|analysed|analyzed|managed|led|delivered|resolved)\b/i.test(cleaned)) return cleaned;
    return `Contributed to ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  });

  return {
    ok: true,
    tool: "AI Resume Tailor",
    role,
    tailoredSummary,
    tailoredBullets,
    keywordAlignment: {
      matched: review.matchedSkills,
      recommendedToAddWithProof: review.missingSkills.slice(0, 10),
      jdKeywords,
    },
    atsSuggestions: [
      "Use the exact target role title near the top of the CV if it is honest and relevant.",
      "Add a dedicated skills section with tools and methods from the JD.",
      "Keep formatting simple for ATS: standard headings, clear dates, and no important text only inside images.",
      "Do not add skills you cannot explain in an interview.",
    ],
  };
}

export function buildFreeCoverLetter(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText);
  const jdText = cleanText(input.jobDescription || input.jdText);
  const role = inferRole(input);
  const company = cleanText(input.companyName, 80) || "your organisation";
  const skills = unique([...extractSkills(cvText), ...extractSkills(jdText)]).slice(0, 6);
  const proof = splitSentences(cvText, 4);

  if (!cvText) return { ok: false, code: "missing_cv", message: "Please provide CV or resume text." };

  const body = [
    `Dear Hiring Team,`,
    `I am excited to apply for the ${role} position at ${company}. My background combines practical professional experience with a growing skill set in ${skills.slice(0, 4).join(", ") || "role-relevant tools and structured problem solving"}. I am especially interested in this opportunity because it matches my motivation to contribute to meaningful work while continuing to grow in a focused team environment.`,
    proof[0]
      ? `In my previous experience, ${proof[0].charAt(0).toLowerCase()}${proof[0].slice(1)} This helped me build strong communication, ownership, and problem-solving habits that I can bring into this role.`
      : `In my previous experience, I developed strong communication, ownership, and problem-solving habits that I can bring into this role.`,
    jdText
      ? `What attracts me to this role is the focus on ${extractKeywords(jdText, 5).join(", ").toLowerCase() || "practical impact and collaboration"}. I would welcome the opportunity to apply my skills, learn from the team, and contribute with reliability, curiosity, and attention to detail.`
      : `I would welcome the opportunity to apply my skills, learn from the team, and contribute with reliability, curiosity, and attention to detail.`,
    `Thank you for considering my application. I would be happy to discuss how my background and motivation fit this opportunity.`,
    `Kind regards,\n[Your Name]`,
  ].join("\n\n");

  return {
    ok: true,
    tool: "Cover Letter Generator",
    role,
    company,
    letter: body,
    checklist: [
      "Replace [Your Name] before sending.",
      "Add one company-specific sentence if you know why you like the employer.",
      "Keep it under one page.",
      "Verify every claim is true and interview-ready.",
    ],
  };
}

export function buildInterviewQuestionGenerator(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText);
  const jdText = cleanText(input.jobDescription || input.jdText);
  const role = inferRole(input);
  const skills = unique([...extractSkills(jdText), ...extractSkills(cvText)]).slice(0, 8);
  const keywords = extractKeywords(jdText || cvText, 8);

  const roleSpecific = skills.slice(0, 5).map((skill) => ({
    category: "Role-specific",
    question: `Tell me about a time you used ${skill} to solve a practical problem. What was the situation, what did you do, and what was the result?`,
    followUp: `What would you do differently if you had to repeat that work today?`,
  }));

  const questions = [
    {
      category: "Opening",
      question: `Could you briefly introduce yourself and explain how your experience connects to the ${role} role?`,
      followUp: "Which part of your background is most relevant for this position?",
    },
    {
      category: "Motivation",
      question: `Why are you interested in this ${role} opportunity, and what are you hoping to contribute?`,
      followUp: "What would make you successful in the first three months?",
    },
    ...roleSpecific,
    {
      category: "Business scenario",
      question: `Imagine the team is facing a problem related to ${keywords.slice(0, 3).join(", ").toLowerCase() || "a key business priority"}. How would you structure your approach?`,
      followUp: "What information would you ask for first?",
    },
    {
      category: "Collaboration",
      question: "Tell me about a time you worked with people from different teams or backgrounds to solve a problem.",
      followUp: "How did you handle disagreement or unclear ownership?",
    },
    {
      category: "Strengths and gaps",
      question: `What is one strength you bring to this ${role} role, and one area you are actively improving?`,
      followUp: "What are you doing to close that gap?",
    },
    {
      category: "Closing",
      question: "Is there anything important about your experience that we have not covered yet?",
      followUp: "What questions do you have about the role, team, or next steps?",
    },
  ];

  return {
    ok: true,
    tool: "Interview Question Generator",
    role,
    recommendedQuestions: questions.slice(0, 12),
    // Grouped view so a candidate can prepare by type, not just scroll a list.
    byCategory: {
      behavioural: questions.filter((q) => ["Opening", "Motivation", "Collaboration", "Strengths and gaps", "Closing"].includes(q.category)).map((q) => q.question),
      roleSpecific: roleSpecific.map((q) => q.question),
      scenario: questions.filter((q) => q.category === "Business scenario").map((q) => q.question),
    },
    // Reverse questions: what a strong candidate asks the interviewer back.
    questionsToAskThem: [
      `What does success look like for this ${role} in the first 90 days?`,
      "What is the biggest challenge the team is facing right now?",
      "How is performance measured, and how often is it reviewed?",
      "What do the people who do well in this team have in common?",
      "What are the next steps in the process after this conversation?",
    ],
    practiceTips: [
      "Answer with a specific example, not only general statements.",
      "Use a simple STAR structure: Situation, Task, Action, Result.",
      "Add numbers, tools, stakeholders, and outcomes where possible.",
      "Prepare one honest answer for gaps or career changes.",
    ],
  };
}

function detectYears(text: string): number {
  const match = text.match(/(\d{1,2})\+?\s*(?:years|yrs)\b/i);
  const years = match ? parseInt(match[1], 10) : 0;
  return years > 45 ? 0 : years;
}

function seniorityPrefix(years: number): string {
  if (years >= 8) return "Senior ";
  if (years >= 4) return "Experienced ";
  return "";
}

export function buildProfessionalSummary(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText);
  const jdText = cleanText(input.jobDescription || input.jdText);
  const role = inferRole(input);

  if (!cvText) {
    return { ok: false, code: "missing_cv", message: "Please provide CV or resume text." };
  }

  const cvSkills = extractSkills(cvText);
  const jdSkills = jdText ? extractSkills(jdText) : [];
  // Front-load skills the target role cares about, then fill from the CV.
  const orderedSkills = unique([...jdSkills.filter((s) => cvSkills.includes(s)), ...cvSkills]);
  const topSkills = orderedSkills.slice(0, 3);
  const skillPhrase = topSkills.length
    ? topSkills.join(", ")
    : "analytical thinking, communication, and structured problem solving";

  const years = detectYears(cvText);
  const hasMetrics = /\b\d+\s*(%|percent|k|m|x|hours?|days?|users?|customers?|tickets?|projects?)\b/i.test(cvText);
  const hasLeadership = /\b(led|managed|mentored|coordinated|owned|headed)\b/i.test(cvText);

  const roleLabel = role === "the target role" ? "professional" : role;
  const prefix = seniorityPrefix(years);

  // Sentence 1: identity + front-loaded keywords.
  const opener = `${prefix}${roleLabel} with ${years >= 1 ? `${years}+ years of ` : "hands-on "}experience across ${skillPhrase}.`;

  // Sentence 2: value and evidence.
  const value = hasMetrics
    ? "Track record of delivering measurable outcomes and translating day-to-day work into results the business can see."
    : hasLeadership
      ? "Comfortable taking ownership, coordinating with others, and turning unclear problems into clear, workable plans."
      : "Known for turning practical experience into dependable, well-communicated work under real deadlines.";

  // Sentence 3: direction toward the target role.
  const direction = role === "the target role"
    ? "Looking to bring that experience into a focused team where I can keep growing and contribute quickly."
    : `Now focused on applying that background to a ${roleLabel} role where clear thinking and reliable delivery matter.`;

  const summary = compact(`${opener[0].toUpperCase()}${opener.slice(1)} ${value} ${direction}`);

  // A tight LinkedIn-style one-liner as a bonus, still deterministic.
  const shortSummary = topSkills.length
    ? `${roleLabel === "professional" ? "Professional" : titleCase(roleLabel)} | ${topSkills.map(titleCase).join(" | ")}`
    : `${roleLabel === "professional" ? "Professional" : titleCase(roleLabel)} | Problem Solving | Communication`;

  return {
    ok: true,
    tool: "Professional Summary Generator",
    role,
    summary,
    shortSummary,
    highlights: topSkills.map(titleCase),
    whyItWorks: [
      "Leads with your role and seniority, so a recruiter places you in the first line.",
      "Front-loads the skills most relevant to the target role for keyword scanning and ATS.",
      hasMetrics
        ? "Signals measurable impact, which is what turns a summary from generic to credible."
        : "Add one real number to the value sentence (a percentage, a volume, a result) to make it credible.",
      "Ends with direction, so it reads as intentional rather than a list of traits.",
    ],
    tips: [
      "Keep it to 2-3 sentences. Anything longer gets skimmed past.",
      "Swap in the exact target role title when it is honest and relevant.",
      "Mirror 2-3 keywords from the job description you are applying to.",
      "Replace any adjective you cannot back up with an example in an interview.",
    ],
  };
}

/* ─────────────── STAR Story Generator (deterministic) ─────────────── */
export function buildStarStory(input: FreeToolInput) {
  const raw = cleanText(input.experienceText || input.cvText || input.resumeText, 4000);
  const role = inferRole(input);

  if (!raw) {
    return { ok: false, code: "missing_experience", message: "Describe the situation or achievement you want to turn into a STAR story." };
  }

  const skills = extractSkills(raw).slice(0, 5);
  const numbers = unique((raw.match(/\b\d+(?:[.,]\d+)?\s*(?:%|percent|k|m|x|hours?|days?|weeks?|months?|users?|customers?|tickets?|projects?|people|clients?|eur|usd|\$|€)?\b/gi) || []).map(compact)).slice(0, 4);
  const verbs = ACTION_VERBS.filter((v) => raw.toLowerCase().includes(v)).slice(0, 4);
  const sentences = splitSentences(raw, 6);

  const roleLabel = role === "the target role" ? "the role" : role;
  const context = sentences[0] || raw.slice(0, 180);
  const task = sentences[1] || "I was responsible for moving it forward and owning the outcome.";
  const actionBase = verbs.length
    ? `I ${verbs.join(", then ")} the work`
    : "I broke the problem down, agreed a plan, and drove it to completion";
  const skillClause = skills.length ? `, drawing on ${skills.join(", ")}` : "";
  const resultClause = numbers.length
    ? `The result was measurable: ${numbers.join(", ")}.`
    : "The result was a clear, positive outcome the team could point to.";

  const story = compact(
    `Situation: ${context}. ` +
    `Task: ${task} ` +
    `Action: ${actionBase}${skillClause}. ` +
    `Result: ${resultClause}`,
  );

  return {
    ok: true,
    tool: "STAR Story Generator",
    role,
    starStory: {
      situation: compact(context),
      task: compact(task),
      action: compact(`${actionBase}${skillClause}.`),
      result: compact(resultClause),
    },
    story,
    highlights: skills.map(titleCase),
    whyItWorks: [
      "Each label (Situation, Task, Action, Result) is answered in one clear beat, so an interviewer can follow it.",
      numbers.length
        ? "Keeps the numbers you provided in the Result, which is where evidence carries the most weight."
        : "Add one real number to the Result. A story without a measurable outcome reads as effort, not impact.",
      `Frames the story toward ${roleLabel}, so it lands as relevant rather than a random anecdote.`,
    ],
    tips: [
      "Say the Result first in your head, then work backwards. The strongest stories are built around the outcome.",
      "Keep Situation and Task to two sentences combined. Interviewers care most about Action and Result.",
      "Use 'I', not 'we', when describing the Action. They are assessing what you did.",
      "Have a number ready even if it is an estimate you can defend.",
    ],
  };
}

/* ─────────────── Resume Headline Generator (deterministic) ─────────────── */
export function buildResumeHeadline(input: FreeToolInput) {
  const role = inferRole(input);
  const cvText = cleanText(input.cvText || input.resumeText, 8000);
  const jdText = cleanText(input.jobDescription || input.jdText, 4000);

  if (role === "the target role" && !cvText) {
    return { ok: false, code: "missing_role", message: "Add a target role (or paste your CV) so the headline is specific to you." };
  }

  const cvSkills = extractSkills(cvText);
  const jdSkills = jdText ? extractSkills(jdText) : [];
  const ordered = unique([...jdSkills.filter((s) => cvSkills.includes(s)), ...cvSkills, ...jdSkills]);
  const topSkills = ordered.slice(0, 3).map(titleCase);
  const years = detectYears(cvText);
  const roleTitle = role === "the target role" ? "Professional" : titleCase(role);
  const seniority = years >= 8 ? "Senior " : years >= 4 ? "" : "";

  const skillTail = topSkills.length ? topSkills.join(" | ") : "Problem Solving | Communication | Delivery";
  const yearTail = years >= 1 ? ` | ${years}+ yrs` : "";

  const headlines = unique([
    `${seniority}${roleTitle} | ${skillTail}`,
    `${seniority}${roleTitle}${yearTail} | ${topSkills.slice(0, 2).join(" & ") || "Results-Driven"}`,
    `${roleTitle} turning ${topSkills[0] || "data"} into measurable business outcomes`,
    `${seniority}${roleTitle} focused on ${topSkills[0] || "impact"}, ${topSkills[1] || "ownership"}, and clear delivery`,
    `${roleTitle} | Helping teams ${years >= 4 ? "scale" : "ship"} with ${topSkills.slice(0, 2).join(" and ") || "reliable execution"}`,
  ]).slice(0, 5);

  return {
    ok: true,
    tool: "Resume Headline Generator",
    role,
    headlines,
    highlights: topSkills,
    whyItWorks: [
      "Leads with the role title, so an ATS and a recruiter both place you in the first two words.",
      topSkills.length
        ? "Front-loads the skills most relevant to the role, which is what a six-second skim looks for."
        : "Paste your CV or a job description to pull in the specific skills that make a headline land.",
      "Kept short. A headline over ~12 words stops being scannable.",
    ],
    tips: [
      "Use the pipe ( | ) format for a CV or LinkedIn headline; use the sentence versions for a summary opener.",
      "Swap in the exact job title from the posting when it is honest.",
      "Keep only skills you can prove in an interview.",
    ],
  };
}

/* ─────────────── ATS Resume Checker (deterministic scorer) ─────────────── */
export function buildAtsChecker(input: FreeToolInput) {
  const cvText = cleanText(input.cvText || input.resumeText, 20000);
  const jdText = cleanText(input.jobDescription || input.jdText, 8000);

  if (!cvText) {
    return { ok: false, code: "missing_cv", message: "Paste your resume text to run the ATS check." };
  }

  const lower = cvText.toLowerCase();
  const checks: { label: string; pass: boolean; detail: string }[] = [];

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(cvText);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(cvText);
  const hasExperience = /\b(experience|employment|work history|professional experience)\b/i.test(cvText);
  const hasEducation = /\b(education|degree|bachelor|master|university|college|diploma|certification)\b/i.test(cvText);
  const hasSkills = /\b(skills|technologies|tools|competencies)\b/i.test(cvText);
  const hasDates = /\b(19|20)\d{2}\b/.test(cvText) && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current|\d{1,2}\/\d{4})\b/i.test(lower);
  const hasBullets = /(^|\n)\s*[-•*▪]/.test(cvText) || (cvText.match(/\n\s*[-•*]/g) || []).length >= 3;
  const hasMetrics = /\b\d+\s*(%|percent|k|m|x|hours?|days?|users?|customers?|tickets?|projects?|eur|usd|\$|€)\b/i.test(cvText);
  const hasActionVerbs = ACTION_VERBS.some((v) => lower.includes(v));
  const wordCount = cvText.split(/\s+/).filter(Boolean).length;
  const reasonableLength = wordCount >= 250 && wordCount <= 1200;
  // Characters that commonly break naive ATS text extraction.
  const riskyChars = (cvText.match(/[│┃▏▕|]{2,}|\t{2,}/g) || []).length > 0;

  checks.push({ label: "Contact email present", pass: hasEmail, detail: hasEmail ? "An email address was found." : "Add a plain-text email near the top." });
  checks.push({ label: "Phone number present", pass: hasPhone, detail: hasPhone ? "A phone number was found." : "Add a phone number in plain text." });
  checks.push({ label: "Experience section", pass: hasExperience, detail: hasExperience ? "A clear experience section is present." : "Add a heading like 'Experience' or 'Work History'." });
  checks.push({ label: "Education section", pass: hasEducation, detail: hasEducation ? "Education or certification is present." : "Add an 'Education' or 'Certifications' heading." });
  checks.push({ label: "Skills section", pass: hasSkills, detail: hasSkills ? "A skills/tools section is present." : "Add a dedicated 'Skills' section for keyword matching." });
  checks.push({ label: "Dated roles", pass: hasDates, detail: hasDates ? "Roles appear to include dates." : "Add month/year date ranges to each role." });
  checks.push({ label: "Bulleted achievements", pass: hasBullets, detail: hasBullets ? "Bulleted content detected." : "Use bullet points; ATS and recruiters both parse them better than paragraphs." });
  checks.push({ label: "Quantified impact", pass: hasMetrics, detail: hasMetrics ? "Numbers/metrics detected." : "Add measurable results (%, volume, time saved)." });
  checks.push({ label: "Strong action verbs", pass: hasActionVerbs, detail: hasActionVerbs ? "Action verbs detected." : "Start bullets with verbs like led, built, reduced, increased." });
  checks.push({ label: "Reasonable length", pass: reasonableLength, detail: reasonableLength ? `Length looks right (~${wordCount} words).` : wordCount < 250 ? "Too short. Add detail to your roles." : "Long. Trim to the most relevant content." });
  checks.push({ label: "Clean, parseable text", pass: !riskyChars, detail: riskyChars ? "Detected characters that can break ATS parsing (likely tables or columns). Use a single-column layout." : "No obvious parsing hazards found." });

  const passed = checks.filter((c) => c.pass).length;
  const structureScore = Math.round((passed / checks.length) * 100);

  // Keyword match against a job description, if provided.
  let keywordScore = 0;
  let matchedSkills: string[] = [];
  let missingSkills: string[] = [];
  if (jdText) {
    const jdSkills = extractSkills(jdText).map((s) => s.toLowerCase());
    const cvSkills = extractSkills(cvText).map((s) => s.toLowerCase());
    matchedSkills = jdSkills.filter((s) => cvSkills.includes(s)).map(titleCase);
    missingSkills = jdSkills.filter((s) => !cvSkills.includes(s)).map(titleCase);
    keywordScore = jdSkills.length ? Math.round((matchedSkills.length / jdSkills.length) * 100) : 0;
  }

  // Overall: structure-weighted, blended with keyword match when a JD is given.
  const atsScore = jdText
    ? Math.max(20, Math.min(98, Math.round(structureScore * 0.6 + keywordScore * 0.4)))
    : Math.max(20, Math.min(98, structureScore));

  const verdict = atsScore >= 80 ? "ATS-ready" : atsScore >= 60 ? "Nearly there" : "Needs work";

  const fixes = checks.filter((c) => !c.pass).map((c) => c.detail);
  if (jdText && missingSkills.length) {
    fixes.unshift(`Add these role keywords where you can honestly back them up: ${missingSkills.slice(0, 8).join(", ")}.`);
  }

  return {
    ok: true,
    tool: "ATS Resume Checker",
    atsScore,
    verdict,
    structureScore,
    keywordScore: jdText ? keywordScore : null,
    checks,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 12),
    fixes: fixes.length ? fixes : ["No blocking issues found. Tailor keywords per job for the best match."],
    nextSteps: [
      jdText ? "Mirror the exact wording of the top missing keywords, only where true." : "Paste a job description to also get a keyword-match score.",
      "Keep a single-column layout and standard section headings.",
      "Re-run after edits to confirm the score moved.",
    ],
  };
}

export function runWorkZoFreeTool(action: FreeToolAction, input: FreeToolInput) {
  switch (action) {
    case "cv_review":
      return buildFreeCvReview(input);
    case "resume_tailor":
      return buildAiResumeTailor(input);
    case "cover_letter":
      return buildFreeCoverLetter(input);
    case "interview_questions":
      return buildInterviewQuestionGenerator(input);
    case "professional_summary":
      return buildProfessionalSummary(input);
    case "star_story":
      return buildStarStory(input);
    case "resume_headline":
      return buildResumeHeadline(input);
    case "ats_check":
      return buildAtsChecker(input);
    default:
      return { ok: false, code: "unknown_tool", message: "Unknown free tool." };
  }
}
