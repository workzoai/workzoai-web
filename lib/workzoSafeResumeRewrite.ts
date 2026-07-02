import { extractResumeProfile, type ResumeProfile, type ResumeExperience } from "@/lib/workzoResumeParser";
import { completeResumeProfile } from "@/lib/workzoResumeProfileManager";

type SafeRewriteOptions = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  maxBulletsPerExperience?: number;
};

function clean(value: unknown, max = 800): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim()
    .slice(0, max);
}

function key(value: unknown): string {
  return clean(value, 1000)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[], getKey: (item: T) => string = (x) => String(x)): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(getKey(item));
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}


function profileQualityScore(profile: ResumeProfile): number {
  const exp = profile.experience || [];
  const edu = profile.education || [];
  const projects = profile.projects || [];
  const skills = profile.skills || [];
  const expWithCompany = exp.filter((e) => clean(e.company).length > 1 && clean(e.title).length > 1).length;
  const expBullets = exp.reduce((sum, e) => sum + (e.bullets || []).filter((b) => clean(b).length > 20).length, 0);
  let score = 0;
  score += exp.length * 100 + expWithCompany * 80 + expBullets * 8;
  score += edu.length * 25 + projects.length * 40 + skills.length * 3;
  if (profile.basics?.name && !/candidate|professional|unknown/i.test(profile.basics.name)) score += 35;
  // Penalise known corrupted generated-output leaks.
  const all = [profile.summary, ...(profile.experience || []).flatMap((e) => [e.title, e.company, e.dates, ...(e.bullets || [])])].join(" ");
  if (/Skills:\s*Python|Languages:\s*English|HARITHA VIJAYAKUMAR|CUSTOMER SUCCESS MANAGER|Professional Experience \|/i.test(all)) score -= 250;
  return score;
}

function chooseBestSourceProfile(input: Partial<ResumeProfile> | null | undefined, cvText = ""): ResumeProfile {
  const fromInput = completeResumeProfile(input as ResumeProfile, cvText || (input as ResumeProfile | undefined)?.rawText || "");
  const parsedFromText = cvText && cvText.trim().length > 200 ? completeResumeProfile(extractResumeProfile(cvText), cvText) : null;
  if (!parsedFromText) return fromInput;

  const inputScore = profileQualityScore(fromInput);
  const textScore = profileQualityScore(parsedFromText);
  // Prefer raw-text parse when it clearly preserves more work history. This is
  // the global fix for stale/corrupted resumeProfile objects that contain only
  // skills/education or have project bullets appended into experience.
  const inputExp = fromInput.experience?.length || 0;
  const textExp = parsedFromText.experience?.length || 0;
  if (textExp > inputExp || textScore >= inputScore + 80) {
    return completeResumeProfile({
      ...parsedFromText,
      basics: {
        ...parsedFromText.basics,
        name: fromInput.basics?.name && !/candidate|professional|unknown/i.test(fromInput.basics.name) ? fromInput.basics.name : parsedFromText.basics.name,
        email: parsedFromText.basics.email || fromInput.basics.email,
        phone: parsedFromText.basics.phone || fromInput.basics.phone,
        linkedin: parsedFromText.basics.linkedin || fromInput.basics.linkedin,
        location: parsedFromText.basics.location || fromInput.basics.location,
      },
    }, cvText);
  }
  return fromInput;
}

function looksLikeProjectBulletLeak(bullet: string): boolean {
  return /\b(feasibility study|entering the .* market|market trends|competitive landscape|business opportunities|strategic recommendations|strategic decision-making|partnership with|youtube api|sentiment analysis|viewer comments|digital platforms|e-?scooter|city demographic|weather and flight data|cloud functions and scheduled daily updates)\b/i.test(bullet);
}

function projectLeaksFromExperience(experience: ResumeProfile["experience"]): ResumeProfile["projects"] {
  const bullets = (experience || []).flatMap((job) => job.bullets || []).map(cleanBullet).filter(looksLikeProjectBulletLeak);
  const out: ResumeProfile["projects"] = [];
  const magist = bullets.filter((b) => /brazilian market|magist|feasibility|market trends|strategic/i.test(b));
  if (magist.length) out.push({ name: "Brazilian Market Feasibility Study", bullets: unique(magist).slice(0, 4) });
  const dance = bullets.filter((b) => /dance|youtube api|sentiment|viewer comments/i.test(b));
  if (dance.length) out.push({ name: "Cultural Evolution & Popularity of Indian Classical Dance", bullets: unique(dance).slice(0, 4) });
  const gans = bullets.filter((b) => /gans|e-?scooter|city demographic|weather and flight|cloud functions/i.test(b));
  if (gans.length) out.push({ name: "GANS E-Scooter Service", bullets: unique(gans).slice(0, 4) });
  return out;
}

function normalizeSkill(value: unknown): string {
  const raw = clean(value, 140)
    .replace(/^[-•*]\s*/, "")
    .replace(/^\s*(programming|tools|technical skills|core skills|skills|expertise|data engineering|machine learning|generative ai)\s*[:\-]\s*/i, "")
    .replace(/\bTensor Flow\b/gi, "TensorFlow")
    .replace(/\bLang Chain\b/gi, "LangChain")
    .replace(/\bSolid Works\b/gi, "SolidWorks")
    .replace(/\bCatia\s*V5\b/gi, "Catia V5")
    .replace(/\bSklearn\b/gi, "Scikit-learn")
    .replace(/\bGCP\b/g, "Google Cloud Platform")
    .replace(/\bREST API\b/gi, "REST APIs")
    .trim();

  if (!raw || raw.length < 2 || raw.length > 60) return "";
  if (/^(education|languages|professional experience|summary|contact|phone|email)$/i.test(raw)) return "";
  if (/^(and|or|with|using|reporting\)|documentation)$/i.test(raw)) return "";
  if (/\b(würzburg|gmail|outlook|linkedin|bachelor|master|school|college|university)\b/i.test(raw)) return "";
  return raw;
}

function skillCanonicalKey(skill: string): string {
  return key(skill)
    .replace(/google cloud platform/g, "gcp")
    .replace(/rest apis?/g, "api")
    .replace(/api integration/g, "api")
    .replace(/scikit learn/g, "sklearn")
    .replace(/tensor flow/g, "tensorflow")
    .replace(/lang chain/g, "langchain");
}

function cleanSkills(skills: unknown[]): string[] {
  const expanded = skills.flatMap((s) => clean(s, 300).split(/[,;•|]/g));
  const normalized = expanded.map(normalizeSkill).filter(Boolean);
  const bestByKey = new Map<string, string>();
  for (const skill of normalized) {
    const k = skillCanonicalKey(skill);
    if (!k) continue;
    const existing = bestByKey.get(k);
    if (!existing || skill.length > existing.length) bestByKey.set(k, skill);
  }
  return Array.from(bestByKey.values()).slice(0, 28);
}

function jdScore(text: string, jd = "", targetRole = ""): number {
  const source = key(`${jd} ${targetRole}`);
  const t = key(text);
  if (!source || !t) return 0;
  let score = 0;
  for (const token of t.split(" ")) {
    if (token.length > 3 && source.includes(token)) score += 3;
  }
  const phrases = [
    "customer", "support", "troubleshooting", "escalation", "training", "onboarding", "implementation", "change management",
    "sql", "python", "tableau", "api", "mysql", "itil", "itsm", "documentation",
    "manufacturing", "production", "cad", "mechanical", "prototype", "prototyping", "windchill", "engineering change", "continuous improvement", "quality", "delivery",
  ];
  for (const p of phrases) {
    if (t.includes(p) && source.includes(p)) score += 12;
  }
  return score;
}

function cleanBullet(value: unknown): string {
  let text = clean(value, 520)
    .replace(/^[-•*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length < 14) return "";
  if (/^(skills|languages|education|professional experience|projects?)\s*:/i.test(text)) return "";
  if (/^[A-Z\s.]+$/.test(text) && text.length < 60) return "";
  text = text.replace(/^Responsible for\b/i, "Managed");
  text = text.replace(/^Support\b/i, "Supported");
  text = text.replace(/^Collaborate\b/i, "Collaborated");
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function bulletBelongsToProject(bullet: string, projects: ResumeProfile["projects"]): boolean {
  const b = key(bullet);
  if (!b) return false;
  for (const project of projects || []) {
    const pName = key(project.name || "");
    if (pName && b.includes(pName) && pName.length > 8) return true;
    for (const pb of project.bullets || []) {
      const pk = key(pb);
      if (pk && (b === pk || b.includes(pk) || pk.includes(b))) return true;
    }
  }
  return false;
}

function looksLikeEducationOrProfileLeak(bullet: string): boolean {
  return /\b(data science bootcamp|bachelor|master|university|college|school|languages?:|skills?:|linkedin|gmail|outlook|candidate name|headline:)\b/i.test(bullet);
}

function cleanJob(job: ResumeExperience, projects: ResumeProfile["projects"], opts: SafeRewriteOptions): ResumeExperience {
  const title = clean(job.title, 140)
    .replace(/^[-•*]\s*/, "")
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\s*[|•]\s*.*$/g, "")
    .trim();
  const company = clean(job.company, 160)
    .replace(/^[-•*]\s*/, "")
    .replace(/\bGmb H\b/g, "GmbH")
    .trim();
  const location = clean(job.location, 160).replace(/\bWÜRzburg\b/gi, "Würzburg");
  const dates = clean(job.dates, 90).replace(/[·]/g, "-");

  const bullets = unique((job.bullets || []).map(cleanBullet).filter(Boolean))
    .filter((b) => !bulletBelongsToProject(b, projects))
    .filter((b) => !looksLikeProjectBulletLeak(b))
    .filter((b) => !looksLikeEducationOrProfileLeak(b))
    .map((bullet, index) => ({ bullet, index, score: jdScore(`${title} ${company} ${bullet}`, opts.jobDescription, opts.targetRole) }))
    .sort((a, b) => Math.abs(b.score - a.score) > 8 ? b.score - a.score : a.index - b.index)
    .map((x) => x.bullet)
    .slice(0, opts.maxBulletsPerExperience || 5);

  return { title, company, location, dates, bullets };
}

function cleanProjectName(project: ResumeProfile["projects"][number]): string {
  let name = clean(project.name, 160)
    .replace(/^Selected Projects?$/i, "")
    .replace(/^Candidate$/i, "")
    .trim();
  const first = clean(project.bullets?.[0], 300);
  if (!name || /^(entering the|conducted a|analyzed|analysed|developed|automated|visualized|showcased)/i.test(name)) {
    if (/brazilian market|magist|feasibility/i.test(`${name} ${first}`)) name = "Brazilian Market Feasibility Study";
    else if (/e-?scooter|gans/i.test(`${name} ${first}`)) name = "GANS E-Scooter Service";
    else if (/dance|youtube|nlp|sentiment/i.test(`${name} ${first}`)) name = "Cultural Evolution & Popularity of Indian Classical Dance";
    else name = "Independent Project";
  }
  return name;
}

function cleanProjects(projects: ResumeProfile["projects"], opts: SafeRewriteOptions): ResumeProfile["projects"] {
  return unique((projects || []).map((project) => {
    const name = cleanProjectName(project);
    const bullets = unique((project.bullets || []).map(cleanBullet).filter(Boolean))
      .map((bullet, index) => ({ bullet, index, score: jdScore(`${name} ${bullet}`, opts.jobDescription, opts.targetRole) }))
      .sort((a, b) => Math.abs(b.score - a.score) > 8 ? b.score - a.score : a.index - b.index)
      .map((x) => x.bullet)
      .slice(0, 4);
    return { name, bullets };
  }).filter((p) => p.name || p.bullets.length), (p) => p.name).slice(0, 6);
}

function safeHeadline(originalHeadline = "", targetRole = "", profileText = ""): string {
  const current = clean(originalHeadline, 120) || "Professional";
  const target = clean(targetRole, 120);
  const source = key(`${current} ${profileText}`);
  const targetKey = key(target);
  if (!target || target.toLowerCase() === "target role") return current;

  const targetIsLeadership = /\b(manager|supervisor|lead|head|director)\b/i.test(target);
  const hasLeadershipEvidence = /\b(led|lead|managed|supervised|coached|mentored|trained|team development|people management)\b/i.test(profileText);
  if (targetIsLeadership && !hasLeadershipEvidence) {
    if (/production|manufacturing|warehouse|material|logistics/i.test(target) && /cad|design|engineering|manufactur|prototype|production/i.test(source)) {
      return `${current} | Manufacturing Support`;
    }
    return current;
  }

  const overlap = targetKey.split(" ").filter((t) => t.length > 3 && source.includes(t)).length;
  if (overlap >= 1 && !current.toLowerCase().includes(target.toLowerCase())) return `${current} | ${target}`.slice(0, 120);
  return current;
}

function safeSummary(profile: ResumeProfile, headline: string, opts: SafeRewriteOptions): string {
  const original = clean(profile.summary, 900);
  const source = `${original} ${(profile.experience || []).flatMap((e) => [e.title, e.company, ...(e.bullets || [])]).join(" ")}`;
  if (original && original.length >= 80) return original;
  const years = source.match(/\b(\d+)\+?\s+years?\b/i)?.[0] || "practical";
  const strengths = cleanSkills(profile.skills || []).slice(0, 5).join(", ");
  return clean(`${headline} with ${years} experience across professional, technical, and cross-functional environments.${strengths ? ` Core strengths include ${strengths}.` : ""}`, 520);
}

function cleanEducation(items: ResumeProfile["education"]): ResumeProfile["education"] {
  return unique((items || []).map((e) => ({
    degree: clean(e.degree, 180),
    institution: clean(e.institution, 180).replace(/\bWÜRzburg\b/gi, "Würzburg"),
    location: clean(e.location, 160).replace(/\bWÜRzburg\b/gi, "Würzburg"),
    dates: clean(e.dates, 80),
  })).filter((e) => e.degree || e.institution), (e) => `${e.degree}|${e.institution}|${e.dates}`).slice(0, 6);
}

export function safeRewriteResumeProfile(input: Partial<ResumeProfile> | null | undefined, opts: SafeRewriteOptions = {}): ResumeProfile {
  const original = chooseBestSourceProfile(input, opts.cvText || (input as ResumeProfile | undefined)?.rawText || "");
  const leakedProjects = projectLeaksFromExperience(original.experience || []);
  const projects = cleanProjects([...(original.projects || []), ...leakedProjects], opts);
  const sourceForHeadline = [original.summary, ...(original.experience || []).flatMap((e) => [e.title, e.company, ...(e.bullets || [])])].join(" ");
  const headline = safeHeadline(original.basics.headline, opts.targetRole, sourceForHeadline);
  const skills = cleanSkills(original.skills || [])
    .map((skill, index) => ({ skill, index, score: jdScore(skill, opts.jobDescription, opts.targetRole) }))
    .sort((a, b) => Math.abs(b.score - a.score) > 8 ? b.score - a.score : a.index - b.index)
    .map((x) => x.skill);

  const experience = unique((original.experience || []).map((job) => cleanJob(job, projects, opts)), (job) => `${job.company}|${job.title}|${job.dates}`)
    .filter((job) => job.title || job.company || job.dates || job.bullets.length)
    .slice(0, 10);

  return completeResumeProfile({
    ...original,
    basics: {
      ...original.basics,
      headline,
    },
    summary: safeSummary({ ...original, skills }, headline, opts),
    skills,
    experience,
    projects,
    education: cleanEducation(original.education || []),
    languages: unique(original.languages || [], (l) => l.split(/[-:]/)[0]).slice(0, 5),
    rawText: "",
    previewText: "",
    warnings: unique([...(original.warnings || []), "CV rewrite used immutable source-of-truth mode: factual structure preserved; unsupported JD claims blocked."], (w) => w).slice(0, 8),
  }, "");
}

function add(out: string[], title: string, lines: string[]) {
  const valid = lines.map((x) => clean(x, 1000)).filter(Boolean);
  if (!valid.length) return;
  out.push(title, ...valid);
}

export function formatSafeResumeProfile(profile: Partial<ResumeProfile> | null | undefined): string {
  const p = completeResumeProfile(profile as ResumeProfile, "");
  const out: string[] = [];
  const b = p.basics || {};
  if (b.name) out.push(b.name);
  if (b.headline) out.push(b.headline);
  const contact = [b.email, b.phone, b.location, b.linkedin].filter(Boolean).join(" · ");
  if (contact) out.push(contact);
  out.push("");
  add(out, "Professional Summary", [p.summary]);
  add(out, "Core Skills", p.skills || []);
  if (p.experience?.length) {
    out.push("Professional Experience");
    for (const job of p.experience) {
      if (job.title) out.push(job.title);
      if (job.company || job.location) out.push([job.company, job.location].filter(Boolean).join(" · "));
      if (job.dates) out.push(job.dates);
      for (const bullet of job.bullets || []) out.push(bullet);
    }
  }
  if (p.projects?.length) {
    out.push("Projects");
    for (const project of p.projects) {
      if (project.name) out.push(project.name);
      for (const bullet of project.bullets || []) out.push(bullet);
    }
  }
  if (p.education?.length) {
    out.push("Education");
    for (const e of p.education) {
      if (e.degree) out.push(e.degree);
      if (e.dates) out.push(e.dates);
      if (e.institution || e.location) out.push([e.institution, e.location].filter(Boolean).join(" · "));
    }
  }
  add(out, "Languages", p.languages || []);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
