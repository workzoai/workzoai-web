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
  | "interview_questions";

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
    practiceTips: [
      "Answer with a specific example, not only general statements.",
      "Use a simple STAR structure: Situation, Task, Action, Result.",
      "Add numbers, tools, stakeholders, and outcomes where possible.",
      "Prepare one honest answer for gaps or career changes.",
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
    default:
      return { ok: false, code: "unknown_tool", message: "Unknown free tool." };
  }
}
