import OpenAI from "openai";
import {
  extractResumeProfileComplex,
  normalizeResumeText,
  sanitizeResumeProfileIdentity,
  splitGroupedSkillEntries,
  separateLanguagesFromSkills,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProfile,
  type ResumeProject,
} from "@/lib/workzoResumeParser";

type WorkZoCvParserSource =
  | "openai_structured_cv"
  | "local_fallback_no_openai_key"
  | "local_fallback_invalid_ai_json"
  | "local_fallback_ai_error"
  | "empty";

type AiResumeExperience = {
  title?: unknown;
  company?: unknown;
  location?: unknown;
  dates?: unknown;
  bullets?: unknown;
};

type AiResumeEducation = {
  degree?: unknown;
  institution?: unknown;
  location?: unknown;
  dates?: unknown;
};

type AiResumeProject = {
  name?: unknown;
  bullets?: unknown;
};

type AiResumeJson = {
  basics?: {
    name?: unknown;
    headline?: unknown;
    email?: unknown;
    phone?: unknown;
    location?: unknown;
    linkedin?: unknown;
  };
  summary?: unknown;
  experience?: AiResumeExperience[];
  education?: AiResumeEducation[];
  skills?: unknown;
  projects?: AiResumeProject[];
  languages?: unknown;
  certifications?: unknown;
  strengths?: unknown;
  additionalEvidence?: unknown;
  warnings?: unknown;
};

export type WorkZoAiCvParserResult = {
  ok: boolean;
  source: WorkZoCvParserSource;
  resumeProfile: ResumeProfile;
  error: string;
};

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  return normalizeResumeText(value).replace(/\s+/g, " ").trim();
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function unique(items: string[], limit = 50) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const value = clean(item);
    const key = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }

  return out;
}

function safeName(value: unknown) {
  const name = clean(value)
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || name.length < 3 || name.length > 60) return "";
  if (
    /\b(cv|resume|profile|summary|experience|education|skills|project|engineer|analyst|manager|specialist|support|tier|product|developer|consultant|professional|email|phone|linkedin|english|german|dutch|french|fluent|native|bachelor|master|university|college|school|bootcamp|public\s+relations|project\s+management|communication|leadership|teamwork|time\s+management|critical\s+thinking)\b/i.test(
      name,
    )
  ) {
    return "";
  }

  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return "";

  return name;
}

function coerceExperience(items: unknown): ResumeExperience[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter(
      (item): item is AiResumeExperience =>
        Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      title: clean(item.title),
      company: clean(item.company),
      location: clean(item.location),
      dates: clean(item.dates),
      bullets: unique(asList(item.bullets), 8),
    }))
    .filter((item) => {
      const joined = `${item.title} ${item.company}`.toLowerCase();
      if (
        /\b(bachelor|master|university|college|school|bootcamp|education)\b/.test(
          joined,
        ) &&
        !item.bullets.length
      ) {
        return false;
      }
      return item.title || item.company || item.bullets.length;
    })
    .slice(0, 10);
}

function coerceEducation(items: unknown): ResumeEducation[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter(
      (item): item is AiResumeEducation =>
        Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      degree: clean(item.degree),
      institution: clean(item.institution),
      location: clean(item.location),
      dates: clean(item.dates),
    }))
    .filter((item) => item.degree || item.institution)
    .slice(0, 8);
}

function coerceProjects(items: unknown): ResumeProject[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter(
      (item): item is AiResumeProject => Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      name: clean(item.name) || "Project",
      bullets: unique(asList(item.bullets), 6),
    }))
    .filter((item) => item.name || item.bullets.length)
    .slice(0, 8);
}

function extractJsonObject(raw: string) {
  const text = raw.trim();

  try {
    return JSON.parse(text) as AiResumeJson;
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as AiResumeJson;
  } catch {
    return null;
  }
}


function normalizeForCompare(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9äöüßéèêëàâîïôûùçñ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GLOBAL_PROJECT_HINTS =
  /\b(project|capstone|case study|dashboard|pipeline|analysis|analy[sz]ed|visuali[sz]ed|youtube|api|sentiment|textblob|magist|gans|e-scooter|scooter|market feasibility|brazilian market|web scraping|cloud functions|mysql|database|portfolio|nlp|rag|automation pipeline)\b/i;

const GLOBAL_EXPERIENCE_HINTS =
  /\b(customer|client|ticket|support|troubleshoot|troubleshooting|configuration|router|switch|wireless|network|service desk|servicedesk|itil|itsm|escalation|knowledge base|first-call|sla|on-premise|on-premises|product stability|resolution time|technical training|technical support)\b/i;

function sanitizeParsedSections(ai: AiResumeJson): AiResumeJson {
  const experience = Array.isArray(ai.experience) ? ai.experience : [];
  const projects = Array.isArray(ai.projects) ? ai.projects : [];

  const projectBulletKeys = new Set<string>();
  const projectKeywordHints: string[] = [];

  for (const project of projects) {
    const name = clean(project?.name);
    if (name) projectKeywordHints.push(name);

    for (const bullet of asList(project?.bullets)) {
      const key = normalizeForCompare(bullet);
      if (key) projectBulletKeys.add(key);
    }
  }

  const sanitizedExperience = experience.map((job) => {
    const title = clean(job?.title);
    const company = clean(job?.company);
    const jobIdentity = `${title} ${company}`;

    const bullets = asList(job?.bullets).filter((bullet) => {
      const normalized = normalizeForCompare(bullet);

      if (projectBulletKeys.has(normalized)) return false;

      const mentionsProjectName = projectKeywordHints.some((hint) => {
        const normalizedHint = normalizeForCompare(hint);
        return normalizedHint.length >= 4 && normalized.includes(normalizedHint);
      });

      if (mentionsProjectName && GLOBAL_PROJECT_HINTS.test(bullet) && !GLOBAL_EXPERIENCE_HINTS.test(bullet)) {
        return false;
      }

      if (GLOBAL_PROJECT_HINTS.test(bullet) && !GLOBAL_EXPERIENCE_HINTS.test(bullet) && !GLOBAL_PROJECT_HINTS.test(jobIdentity)) {
        return false;
      }

      return true;
    });

    return {
      ...job,
      bullets,
    };
  });

  const movedProjectBullets: string[] = [];

  for (const job of experience) {
    for (const bullet of asList(job?.bullets)) {
      const normalized = normalizeForCompare(bullet);
      const alreadyInProject = projectBulletKeys.has(normalized);
      const projectLike = GLOBAL_PROJECT_HINTS.test(bullet) && !GLOBAL_EXPERIENCE_HINTS.test(bullet);

      if (projectLike && !alreadyInProject) {
        movedProjectBullets.push(bullet);
      }
    }
  }

  const nextProjects = [...projects];

  for (const bullet of movedProjectBullets) {
    const lower = bullet.toLowerCase();

    let targetName = "Selected Project";
    if (/magist|brazilian market/i.test(lower)) targetName = "Magist";
    else if (/gans|e-scooter|scooter|web scraping|flight|weather|mysql|cloud functions/i.test(lower)) targetName = "GANS E-Scooter Service";
    else if (/classical dance|youtube|sentiment|textblob|traditional art|cultural evolution/i.test(lower)) targetName = "Cultural Evolution & Popularity of Indian Classical Dance";

    let target = nextProjects.find((project) => clean(project.name).toLowerCase() === targetName.toLowerCase());
    if (!target) {
      target = { name: targetName, bullets: [] };
      nextProjects.push(target);
    }

    target.bullets = unique([...asList(target.bullets), bullet], 8);
  }

  return {
    ...ai,
    experience: sanitizedExperience,
    projects: nextProjects,
    warnings: unique([
      ...asList(ai.warnings),
      ...(movedProjectBullets.length
        ? ["Some project-like bullets were moved out of experience to prevent section contamination."]
        : []),
    ]),
  };
}


function sourceContainsMetric(rawText: string, metricText: string) {
  const raw = normalizeForCompare(rawText);
  const metric = normalizeForCompare(metricText);
  if (!metric) return false;
  return raw.includes(metric);
}

function extractMetricFragments(value: string) {
  const text = clean(value);
  const fragments = new Set<string>();

  const patterns = [
    /\b\d+(?:\.\d+)?\s*%/gi,
    /\b\d+(?:\.\d+)?\s*(?:users|customers|clients|tickets|calls|cases|issues|hours|days|weeks|months|years|projects|reports|dashboards|pipelines|apis|revenue|sales|leads|accounts|teams|members|stakeholders)\b/gi,
    /\b(?:increased|reduced|improved|decreased|boosted|cut|saved|grew|raised|lowered)\b[^.!?]{0,80}\b\d+(?:\.\d+)?\s*%/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) fragments.add(match);
  }

  return [...fragments];
}

function removeInventedMetricsFromProfile(profile: ResumeProfile, rawText: string): ResumeProfile {
  const raw = rawText || profile.rawText || "";
  const warnings = new Set(profile.warnings || []);
  let removedCount = 0;

  const cleanBullets = (bullets: string[]) =>
    bullets.filter((bullet) => {
      const metrics = extractMetricFragments(bullet);
      if (!metrics.length) return true;

      const allMetricsExistInSource = metrics.every((metric) =>
        sourceContainsMetric(raw, metric),
      );

      if (allMetricsExistInSource) return true;

      removedCount += 1;
      return false;
    });

  const experience = profile.experience.map((job) => ({
    ...job,
    bullets: cleanBullets(job.bullets),
  }));

  const projects = profile.projects.map((project) => ({
    ...project,
    bullets: cleanBullets(project.bullets),
  }));

  if (removedCount > 0) {
    warnings.add(
      "Removed AI-generated metrics not found in the original CV source. Onboarding uses factual extraction only.",
    );
  }

  return {
    ...profile,
    experience,
    projects,
    warnings: [...warnings],
  };
}

function removeGeneratedAchievementLanguage(profile: ResumeProfile, rawText: string): ResumeProfile {
  const raw = normalizeForCompare(rawText || profile.rawText || "");
  const warnings = new Set(profile.warnings || []);
  let removedCount = 0;

  const riskyAchievementPattern =
    /\b(?:increased|decreased|reduced|improved|boosted|grew|saved|generated|delivered|achieved|exceeded|cut|raised|optimized|enhanced)\b/i;

  const keepIfSupported = (bullet: string) => {
    if (!riskyAchievementPattern.test(bullet)) return true;

    const normalizedBullet = normalizeForCompare(bullet);
    if (raw.includes(normalizedBullet)) return true;

    const importantPhrases = clean(bullet)
      .split(/[,.]/)
      .map((part) => normalizeForCompare(part))
      .filter((part) => part.length >= 18);

    if (importantPhrases.some((part) => raw.includes(part))) return true;

    // Keep ordinary factual support/project wording if it does not invent impact.
    if (!extractMetricFragments(bullet).length && /\b(supported|provided|worked|used|utilized|collaborated|conducted|presented|analyzed|developed|built|created|collected|visualized|configured|troubleshot|managed)\b/i.test(bullet)) {
      return true;
    }

    removedCount += 1;
    return false;
  };

  const experience = profile.experience.map((job) => ({
    ...job,
    bullets: job.bullets.filter(keepIfSupported),
  }));

  const projects = profile.projects.map((project) => ({
    ...project,
    bullets: project.bullets.filter(keepIfSupported),
  }));

  if (removedCount > 0) {
    warnings.add(
      "Removed achievement-style wording that was not directly supported by the original CV source.",
    );
  }

  return {
    ...profile,
    experience,
    projects,
    warnings: [...warnings],
  };
}

function enforceCanonicalExtractionOnly(profile: ResumeProfile, rawText: string): ResumeProfile {
  return removeGeneratedAchievementLanguage(
    removeInventedMetricsFromProfile(profile, rawText),
    rawText,
  );
}


function validateExperienceProjectSeparation(profile: ResumeProfile): ResumeProfile {
  const projectBullets = new Set(
    profile.projects.flatMap((project) => project.bullets.map((bullet) => normalizeForCompare(bullet))),
  );

  const projectNames = profile.projects.map((project) => normalizeForCompare(project.name)).filter(Boolean);

  const experience = profile.experience.map((job) => {
    const jobIdentity = `${job.title} ${job.company}`;

    const bullets = job.bullets.filter((bullet) => {
      const normalized = normalizeForCompare(bullet);
      if (projectBullets.has(normalized)) return false;

      const mentionsProjectName = projectNames.some((name) => name.length >= 4 && normalized.includes(name));

      if (mentionsProjectName && GLOBAL_PROJECT_HINTS.test(bullet) && !GLOBAL_EXPERIENCE_HINTS.test(bullet)) {
        return false;
      }

      if (GLOBAL_PROJECT_HINTS.test(bullet) && !GLOBAL_EXPERIENCE_HINTS.test(bullet) && !GLOBAL_PROJECT_HINTS.test(jobIdentity)) {
        return false;
      }

      return true;
    });

    return {
      ...job,
      bullets,
    };
  });

  return {
    ...profile,
    experience,
    warnings: unique([
      ...profile.warnings,
      "Section separation guard applied: project evidence is kept out of work experience.",
    ]),
  };
}


function mergeAiWithFallback(ai: AiResumeJson, fallback: ResumeProfile, rawText: string): ResumeProfile {
  const basics = ai.basics && typeof ai.basics === "object" ? ai.basics : {};
  const name = safeName(basics.name) || fallback.basics.name || "Candidate";

  const experience = coerceExperience(ai.experience);
  const education = coerceEducation(ai.education);
  const projects = coerceProjects(ai.projects);
  // Safety net — regardless of what the AI model returns, apply the same
  // grouped-category splitting and language separation the local parser uses.
  // This guards against the AI returning "Programming: Python, SQL" or
  // "English: Fluent" inside the skills array despite prompt instructions.
  const rawAiSkills = asList(ai.skills);
  const rawAiLanguages = asList(ai.languages);

  const { skills: splitAiSkills, languages: extractedFromSkills } = separateLanguagesFromSkills(
    splitGroupedSkillEntries(rawAiSkills),
  );

  const skills = unique(splitAiSkills, 30);
  const languages = unique([...rawAiLanguages, ...extractedFromSkills], 12);
  const certifications = unique(asList(ai.certifications), 12);
  const strengths = unique(asList(ai.strengths), 12);
  const additionalEvidence = unique(asList(ai.additionalEvidence), 18);
  const warnings = unique(asList(ai.warnings), 10);

  const headline =
    clean(basics.headline) ||
    experience[0]?.title ||
    fallback.basics.headline ||
    "Professional";

  const summary = clean(ai.summary) || fallback.summary;

  const finalExperience = experience.length ? experience : fallback.experience;
  const finalEducation = education.length ? education : fallback.education;
  const finalSkills = skills.length ? skills : fallback.skills;
  const finalProjects = projects.length ? projects : fallback.projects;
  const finalLanguages = languages.length ? languages : fallback.languages;

  const merged: ResumeProfile = {
    ...fallback,
    rawText,
    basics: {
      name,
      headline,
      email: clean(basics.email) || fallback.basics.email,
      phone: clean(basics.phone) || fallback.basics.phone,
      location: clean(basics.location) || fallback.basics.location,
      linkedin: clean(basics.linkedin) || fallback.basics.linkedin,
    },
    summary,
    experience: finalExperience,
    education: finalEducation,
    skills: finalSkills,
    projects: finalProjects,
    languages: finalLanguages,
    certifications: certifications.length
      ? certifications
      : fallback.certifications,
    strengths: strengths.length ? strengths : fallback.strengths,
    additionalEvidence: additionalEvidence.length
      ? additionalEvidence
      : fallback.additionalEvidence,
    warnings: unique([
      ...fallback.warnings,
      ...warnings,
      "AI-assisted CV structure used. Please verify extracted details before continuing.",
    ]),
    previewText: "",
  };

  const identitySafe = sanitizeResumeProfileIdentity(merged, { rawText });

  return {
    ...identitySafe,
    previewText: [
      identitySafe.basics.name,
      identitySafe.basics.headline,
      identitySafe.basics.email,
      identitySafe.basics.phone,
      identitySafe.basics.location,
      "",
      identitySafe.summary,
      "",
      "Experience:",
      ...identitySafe.experience.flatMap((job) => [
        [job.title, job.company, job.dates].filter(Boolean).join(" • "),
        ...job.bullets.map((bullet) => `- ${bullet}`),
      ]),
      "",
      "Skills:",
      identitySafe.skills.join(", "),
      "",
      "Education:",
      ...identitySafe.education.map((edu) =>
        [edu.degree, edu.institution, edu.dates].filter(Boolean).join(" • "),
      ),
      "",
      "Projects:",
      ...identitySafe.projects.flatMap((project) => [
        project.name,
        ...project.bullets.map((bullet) => `- ${bullet}`),
      ]),
      "",
      "Languages:",
      identitySafe.languages.join(", "),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function truncateCvText(text: string) {
  return text.length > 45000 ? text.slice(0, 45000) : text;
}

export async function parseResumeWithAiStructure(input: {
  cvText: string;
  layoutText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
}): Promise<WorkZoAiCvParserResult> {
  const rawText = normalizeResumeText(
    [input.layoutText, input.cvText].filter(Boolean).join("\n\n"),
  );

  const fallback = extractResumeProfileComplex(rawText);

  if (!rawText.trim()) {
    return {
      ok: false,
      source: "empty",
      resumeProfile: fallback,
      error: "No CV text provided.",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      source: "local_fallback_no_openai_key",
      resumeProfile: fallback,
      error: "OPENAI_API_KEY is not configured.",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: process.env.WORKZO_CV_AI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are WorkZo AI's global factual resume extraction engine. This is CV EXTRACTION ONLY, not CV improvement. Convert messy, multi-column, OCR-damaged, international CV text into accurate structured JSON. Do not improve wording. Do not rewrite bullets into ATS language. Do not invent employers, dates, degrees, achievements, tools, metrics, KPIs, percentages, business impact, languages, or certifications. Use only evidence present in the CV text. If uncertain, leave the field empty or add a warning.",
        },
        {
          role: "user",
          content: `Return ONLY valid JSON with this exact shape:
{
  "basics": {
    "name": "",
    "headline": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "summary": "",
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "location": "",
      "dates": ""
    }
  ],
  "skills": [],
  "projects": [
    {
      "name": "",
      "bullets": []
    }
  ],
  "languages": [],
  "certifications": [],
  "strengths": [],
  "additionalEvidence": [],
  "warnings": []
}

CRITICAL FACTUALITY RULES:
- This step is CV EXTRACTION ONLY.
- Do not improve wording.
- Do not rewrite bullets.
- Do not generate ATS content.
- Do not generate achievements.
- Do not invent percentages, KPIs, metrics, business impact, revenue impact, time savings, or customer counts.
- If the CV says "provided technical support", return that meaning only. Never transform it into "resolved 90% of customer issues" unless the CV explicitly contains "90%".
- Onboarding canonical profile must remain factual. JD tailoring belongs only in Improve CV, not here.

Global CV rules:
- Works for any country and any profession. Do not overfit to one sample CV.
- CVs may be one-column, two-column, sidebar, visual, ATS, European, Indian, US, UK, German, Dutch, French, Spanish, Italian, Portuguese, or mixed format.
- If the source text order is scrambled by PDF extraction, reconstruct the most likely section order from headings and evidence.
- Read sidebar sections as their own sections. Do not merge skills/languages/education into experience or summary.
- Name must be a real human name from the CV header or email. Never use a role, skill, section title, language, or word like "Tier" as a name.
- Keep experience, education, skills, languages, projects, and certifications separate.
- Attach dates to the correct job or education item only.
- Preserve all facts, but clean obvious extraction spacing issues.
- Never invent employers, dates, degrees, achievements, tools, metrics, languages, certifications, or project names.
- Add warnings for uncertain section assignments.
- Before returning JSON, verify every experience bullet belongs to the company/role immediately above it.
- SKILLS FORMAT: the "skills" array must contain individual skill names only — never category labels with grouped items. If the CV groups skills like "Programming: Python, SQL" or "Machine Learning: Sklearn, TensorFlow", split them into separate entries: "Python", "SQL", "Sklearn", "TensorFlow". Do not include the category label itself (e.g. do not include "Programming" or "Machine Learning" as a skill).
- LANGUAGES FORMAT: the "languages" array must contain language + proficiency pairs as single strings, e.g. "English - FLUENT", "German - B1". If the CV lists "English: Fluent" or "German: Conversational" anywhere (including inside a skills or sidebar section), move it to "languages", not "skills". Never duplicate a language entry in both "skills" and "languages".
- SOFT SKILLS: items like "Teamwork", "Leadership", "Communication", "Time Management", "Critical Thinking", "Public Relations", "Project Management" are valid skills entries — keep them in "skills" as individual items, not grouped.
- If a bullet mentions project names, feasibility studies, dashboards, YouTube/API/NLP, e-scooters, Magist, GANS, market analysis, cloud pipeline, or other portfolio work, place it under PROJECTS unless it is explicitly tied to an employer role.
- Do not place project bullets under Zoho, CSS Corp, or any employer unless the CV clearly says that project happened inside that job.
- Experience bullets should describe employment responsibilities, customer support, technical support, troubleshooting, escalations, product support, service delivery, stakeholder support, or role duties.
- Project bullets should describe portfolio, bootcamp, capstone, market studies, dashboards, scraping, APIs, ML/NLP, cloud pipelines, or analysis projects.

Target role, if provided: ${input.targetRole || ""}
Target market, if provided: ${input.targetMarket || ""}
Job description, if provided for context only: ${(input.jobDescription || "").slice(0, 3000)}

CV text:
${truncateCvText(rawText)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const json = extractJsonObject(content);

    if (!json) {
      return {
        ok: false,
        source: "local_fallback_invalid_ai_json",
        resumeProfile: fallback,
        error: "AI CV parser returned invalid JSON.",
      };
    }

    return {
      ok: true,
      source: "openai_structured_cv",
      resumeProfile: enforceCanonicalExtractionOnly(
        validateExperienceProjectSeparation(
          mergeAiWithFallback(sanitizeParsedSections(json), fallback, rawText),
        ),
        rawText,
      ),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      source: "local_fallback_ai_error",
      resumeProfile: fallback,
      error: error instanceof Error ? error.message : "AI CV parser failed.",
    };
  }
}
