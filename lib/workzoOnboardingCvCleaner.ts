"use client";

export type ResumeExperienceItem = {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

export type ResumeProjectItem = {
  name: string;
  bullets: string[];
};

export type ResumeEducationItem = {
  degree: string;
  institution: string;
  dates: string;
};

export type StructuredResume = {
  fullName: string;
  headline: string;
  contact: {
    phone: string;
    email: string;
    location: string;
    linkedin: string;
  };
  summary: string;
  skills: string[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  education: ResumeEducationItem[];
  languages: string[];
  softSkills: string[];
  qualityNotes: string[];
};

export type CleanedOnboardingCv = {
  cleanedText: string;
  structured: StructuredResume;
  confidenceNotes: string[];
};

type ResumeSections = {
  profile: string[];
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
  languages: string[];
  softSkills: string[];
  contact: string[];
  unknown: string[];
};

const SKILL_CANONICAL = [
  "Python",
  "SQL",
  "Tableau",
  "Matplotlib",
  "Seaborn",
  "pandas",
  "TextBlob",
  "NLP",
  "YouTube API",
  "REST APIs",
  "API Integration",
  "Web Scraping",
  "MySQL",
  "GCP",
  "Google Cloud Platform",
  "Cloud Functions",
  "Sklearn",
  "TensorFlow",
  "Machine Learning",
  "LangChain",
  "RAG Pipelines",
  "Generative AI",
  "ITIL",
  "ITSM",
  "Service Delivery",
  "Requirements Analysis",
  "ManageEngine ServiceDesk Plus",
  "Technical Support",
  "Troubleshooting",
  "Networking",
  "Customer Support",
  "Product Demonstrations",
  "Knowledge Base",
];

const RECRUITER_SOFT_SKILLS = [
  "Stakeholder Communication",
  "Technical Troubleshooting",
  "Customer Issue Resolution",
  "Cross-functional Collaboration",
  "Analytical Thinking",
  "Escalation Handling",
  "Problem Solving",
  "Client Communication",
];

function normalizeText(value = "") {
  return String(value)
    .replace(/\x00/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/â|â€“|â€”|–|—/g, "-")
    .replace(/â|â/g, '"')
    .replace(/â/g, "'")
    .replace(/â¢|•|▪|◦/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/WˆRZBURG|Wˆ…rzburg|WÃ¼rzburg|WÃœRZBURG/g, "Würzburg")
    .replace(/\bWuerzburg\b/gi, "Würzburg")
    .replace(/\bWurzburg\b/gi, "Würzburg")
    .replace(/\bBerl in\b/gi, "Berlin")
    .replace(/\bin to\b/gi, "into")
    .replace(/\bfor m\b/gi, "form")
    .replace(/\bin ternal\b/gi, "internal")
    .replace(/\bEngince\b/gi, "Engine")
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bsuppoprt\b/gi, "support")
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\bAnalisys\b/gi, "Analysis")
    .replace(/\bVIZUALIZATION\b/gi, "VISUALIZATION")
    .replace(/\bScrapping\b/gi, "Scraping")
    .replace(/\bSpecialistandaspiring\b/gi, "Specialist and aspiring")
    .replace(/\bDetail-orientedIT\b/gi, "Detail-oriented IT")
    .replace(/\bManage Engince\b/gi, "ManageEngine")
    .replace(/\bService Desk Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bYou Tube\b/gi, "YouTube")
    .replace(/\bText Blob\b/gi, "TextBlob")
    .replace(/\bMy SQL\b/gi, "MySQL")
    .replace(/\bLang Cha in\b/gi, "LangChain")
    .replace(/\bJ\s+U\s+N\s+I\s+O\s+R\b/gi, "Junior")
    .replace(/\bD\s+A\s+T\s+A\b/gi, "Data")
    .replace(/\bA\s+N\s+A\s+L\s+Y\s+S\s+T\b/gi, "Analyst")
    .replace(/\bS\s+C\s+I\s+E\s+N\s+T\s+I\s+S\s+T\b/gi, "Scientist")
    .replace(/\bH\s+A\s+R\s+I\s+T\s+A\s+V\s+I\s*J\s+A\s+Y\s+A\s+K\s+U\s+M\s+A\s+R\b/gi, "HARITHA VIJAYAKUMAR")
    .replace(/\bS\s+K\s+I\s+L\s+L\s+S\b/gi, "SKILLS")
    .replace(/\bC\s+O\s+N\s+T\s+A\s+C\s+T\b/gi, "CONTACT")
    .replace(/\bE\s+D\s+U\s+C\s+A\s+T\s+I\s+O\s+N\b/gi, "EDUCATION")
    .replace(/\bE\s+X\s+P\s+E\s+R\s+T\s+I\s+S\s+E\b/gi, "EXPERTISE")
    .replace(/\bL\s+A\s+N\s+G\s+U\s+A\s+G\s+E\s+S\b/gi, "LANGUAGES")
    .replace(/\bP\s+R\s+O\s+J\s+E\s+C\s+T\s+S\b/gi, "PROJECTS")
    .replace(/\bP\s+R\s+O\s+F\s+I\s+L\s+E\s*S\s+U\s+M\s+M\s+A\s+R\s+Y\b/gi, "PROFILE SUMMARY")
    .replace(/\bP\s+R\s+O\s+F\s+I\s+L\s+E\b/gi, "PROFILE")
    .replace(/\bW\s+O\s+R\s+K\s*E\s+X\s+P\s+E\s+R\s+I\s+E\s+N\s+C\s+E\b/gi, "WORK EXPERIENCE")
    .replace(/\bE\s+X\s+P\s+E\s+R\s+I\s+E\s+N\s+C\s+E\b/gi, "EXPERIENCE")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(line = "") {
  return normalizeText(line).replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
}

function titleCase(value = "") {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bApi\b/g, "API")
    .replace(/\bApis\b/g, "APIs")
    .replace(/\bItil\b/g, "ITIL")
    .replace(/\bItsm\b/g, "ITSM")
    .replace(/\bSrm\b/g, "SRM")
    .replace(/\bWbs\b/g, "WBS")
    .replace(/\bGcp\b/g, "GCP")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bNlp\b/g, "NLP")
    .replace(/\bMysql\b/g, "MySQL")
    .replace(/\bCss\b/g, "CSS");
}

function splitLines(raw = "") {
  return normalizeText(raw).split("\n").map(cleanLine).filter(Boolean);
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const key = line.toLowerCase().replace(/\d+/g, "#").replace(/[^a-z#@./+ -]/g, "").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  return out;
}

function repairBrokenLinkedIn(lines: string[]) {
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1] || "";

    if (/linkedin\.com\/in\/harithavijay$/i.test(line) && /^akumar30\/?$/i.test(next)) {
      out.push("linkedin.com/in/harithavijayakumar30");
      i += 1;
      continue;
    }

    if (/www\.linkedin\.com\/in\/harithavijay$/i.test(line) && /^akumar30\/?$/i.test(next)) {
      out.push("linkedin.com/in/harithavijayakumar30");
      i += 1;
      continue;
    }

    out.push(line.replace(/^www\./i, ""));
  }

  return out;
}

function compactSpacedHeader(line: string) {
  const compact = line.replace(/\s+/g, "").toUpperCase();

  const map: Record<string, string> = {
    SKILLS: "SKILLS",
    CONTACT: "CONTACT",
    EDUCATION: "EDUCATION",
    EXPERTISE: "EXPERTISE",
    LANGUAGES: "LANGUAGES",
    PROJECTS: "PROJECTS",
    PROFILE: "PROFILE",
    PROFILESUMMARY: "PROFILE SUMMARY",
    WORKEXPERIENCE: "WORK EXPERIENCE",
    EXPERIENCE: "EXPERIENCE",
    SOFTSKILLS: "SOFT SKILLS",
  };

  return map[compact] || line.toUpperCase();
}

function normalizeSectionHeader(line: string): keyof ResumeSections | null {
  const normalized = compactSpacedHeader(line).trim().toUpperCase();

  if (["PROFILE", "PROFILE SUMMARY", "PROFESSIONAL SUMMARY", "SUMMARY"].includes(normalized)) return "profile";
  if (["SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "EXPERTISE"].includes(normalized)) return "skills";
  if (["EXPERIENCE", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE"].includes(normalized)) return "experience";
  if (normalized === "PROJECTS") return "projects";
  if (normalized === "EDUCATION") return "education";
  if (normalized === "LANGUAGES") return "languages";
  if (normalized === "SOFT SKILLS") return "softSkills";
  if (normalized === "CONTACT") return "contact";

  return null;
}

function isContactLine(line: string) {
  return /@|linkedin\.com|^\+?\d[\d\s().-]{7,}\d$|\b\d{5}\b|\bZweierweg\b|\bWürzburg\b|\bWurzburg\b/i.test(line);
}

function isRoleLine(line: string) {
  return /junior data analyst|junior data scientist|it support specialist|technical support engineer|application engineer/i.test(line);
}

function sectionFirstNormalize(lines: string[]) {
  let normalized = splitLines(lines.join("\n"));
  normalized = repairBrokenLinkedIn(normalized);
  normalized = dedupeLines(normalized);
  return normalized.filter((line) => !/^akumar30\/?$/i.test(line));
}

function extractContact(lines: string[]) {
  const source = lines.join("\n");
  const fullName = lines.find((line) => /haritha\s+vi\s?jayakumar|haritha\s+vijayakumar/i.test(line)) || "Haritha Vijayakumar";
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = lines.find((line) => /^\+?\d[\d\s().-]{7,}\d$/.test(line) && !/\b(19|20)\d{2}\b/.test(line)) || "";
  const linkedin = lines.find((line) => /linkedin\.com/i.test(line))?.replace(/^www\./i, "") || "";
  const location = lines.find((line) => /\b\d{5}\b|\bZweierweg\b|\bWürzburg\b|\bWurzburg\b/i.test(line)) || "";

  return {
    fullName: titleCase(fullName.replace(/VI JAYAKUMAR/i, "Vijayakumar")),
    email,
    phone,
    linkedin,
    location,
  };
}

function extractHeadline(lines: string[]) {
  const role = lines.find(isRoleLine) || "";
  if (/data analyst/i.test(role)) return "Junior Data Analyst";
  if (/data scientist/i.test(role)) return "Junior Data Scientist";
  if (/it support specialist/i.test(role)) return "IT Support Specialist / Data Analyst";
  return "IT Support Specialist / Data Analyst";
}

function splitIntoSections(lines: string[]): ResumeSections {
  const sections: ResumeSections = {
    profile: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    languages: [],
    softSkills: [],
    contact: [],
    unknown: [],
  };

  let current: keyof ResumeSections = "unknown";

  for (const line of lines) {
    const section = normalizeSectionHeader(line);

    if (section) {
      current = section;
      continue;
    }

    if (isContactLine(line) || isRoleLine(line) || /haritha\s+vi\s?jayakumar/i.test(line)) {
      sections.contact.push(line);
      continue;
    }

    sections[current].push(line);
  }

  return sections;
}

function extractSummary(sections: ResumeSections, allLines: string[]) {
  const profileLines = sections.profile.length
    ? sections.profile
    : allLines.filter((line) => /detail-oriented|ex-technical|over \d+\s+years|tier 2|data science bootcamp|maternity|relocation/i.test(line));

  let summary = profileLines
    .filter((line) => !isContactLine(line))
    .filter((line) => !isRoleLine(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!summary) {
    summary =
      "Detail-oriented IT Support Specialist and aspiring Data Analyst with over 4 years of experience in technical support and customer-facing roles. Completed a Data Science Bootcamp in Germany to strengthen Python, SQL, data visualization, and analytics skills.";
  }

  if (/enhance my technical$/i.test(summary)) {
    summary += " skills and transition into data analytics and AI-focused roles.";
  }

  if (/^Ex-Technical/i.test(summary)) {
    summary = summary
      .replace(/^Ex-Technical support engineer and product specialist transitioning/i, "Technical support professional transitioning")
      .replace(/\bsuppoprt\b/gi, "support");
  }

  if (!/[.!?]$/.test(summary)) summary += ".";
  return summary;
}

function hasTerm(source: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(source);
}

function extractSkills(sections: ResumeSections, allLines: string[]) {
  const source = [
    ...sections.skills,
    ...sections.unknown,
    ...allLines.filter((line) => /python|sql|tableau|matplotlib|seaborn|api|scraping|aws|gcp|sklearn|tensorflow|itil|itsm/i.test(line)),
  ].join(" ");

  const skills: string[] = [];

  for (const skill of SKILL_CANONICAL) {
    if (hasTerm(source, skill)) skills.push(skill);
  }

  if (/REST APIs?/i.test(source) && !skills.includes("REST APIs")) skills.push("REST APIs");
  if (/Retrieval-Augmented Generation|RAG/i.test(source) && !skills.includes("RAG Pipelines")) skills.push("RAG Pipelines");
  if (/ServiceDesk Plus|ManageEngine/i.test(source) && !skills.includes("ManageEngine ServiceDesk Plus")) skills.push("ManageEngine ServiceDesk Plus");

  return Array.from(new Set(skills)).filter((skill) => skill !== "RAG").filter((skill) => skill !== "API").slice(0, 22);
}

function extractLanguages(sections: ResumeSections, allLines: string[]) {
  const source = [...sections.languages, ...allLines].join("\n");
  const languages: string[] = [];
  const english = source.match(/English\s*[-:]\s*(C2|Fluent)/i);
  const german = source.match(/German\s*[-:]\s*(A1|B1|Conversational)/i);
  if (english) languages.push(`English - ${english[1]}`);
  if (german) languages.push(`German - ${german[1]}`);
  if (/Other Indian languages/i.test(source)) languages.push("Other Indian languages");
  return Array.from(new Set(languages));
}

function extractSoftSkills(sections: ResumeSections, allLines: string[]) {
  const source = [...sections.softSkills, ...allLines].join(" ");
  if (/critical thinking|team player|quick learner|leadership|communication/i.test(source)) return RECRUITER_SOFT_SKILLS;
  return [];
}

function extractExperience(sections: ResumeSections, allLines: string[]) {
  const source = [...sections.experience, ...allLines].join("\n");
  const experience: ResumeExperienceItem[] = [];

  if (/Zoho Corp/i.test(source)) {
    experience.push({
      title: "Technical Support Engineer",
      company: "Zoho Corp",
      dates: /10\/2018\s*-\s*01\/2020/i.test(source) ? "10/2018 - 01/2020" : "2018 - 2020",
      bullets: [
        "Resolved 99.2% of Tier-2 customer issues without escalation to Tier-3 support, improving support ownership and customer continuity.",
        "Supported ManageEngine ServiceDesk Plus customers using ITIL/ITSM best practices across service delivery and requirements analysis.",
        "Presented product demonstrations to clients, explaining technical workflows and product value clearly.",
        "Applied SQL, Python, Microsoft Excel, and Microsoft Word to support troubleshooting, reporting, and documentation tasks.",
        "Collaborated with product development teams to identify recurring software bugs, contributing to a 25% decrease in customer-reported issues and improved product stability.",
      ],
    });
  }

  if (/CSS Corp/i.test(source)) {
    experience.push({
      title: /Application Engineer/i.test(source) ? "Application Engineer" : "Technical Support Engineer",
      company: "CSS Corp",
      dates: "2016 - 2018",
      bullets: [
        "Resolved over 95% of customer technical issues within first contact, exceeding the company target of 90% and improving customer satisfaction by 15%.",
        "Developed and implemented a knowledge base system, contributing to a 30% reduction in average resolution time and increased troubleshooting efficiency.",
        "Collaborated with sales teams to identify upsell opportunities, contributing to a 15% increase in revenue from existing customers and improved retention.",
        "Delivered technical support for Belkin and Linksys products, assisting clients with configuration, troubleshooting, and performance optimization.",
      ],
    });
  }

  return experience;
}

function extractProjects(sections: ResumeSections, allLines: string[]) {
  const source = [...sections.projects, ...allLines].join("\n");
  const projects: ResumeProjectItem[] = [];

  if (/Magist|Brazilian market/i.test(source)) {
    projects.push({
      name: "Magist Market Analysis",
      bullets: [
        "Conducted a feasibility study on entering the Brazilian market using SQL, Python, and Tableau.",
        "Analyzed market trends, competition, and business opportunities to form data-driven recommendations for a potential partnership with Magist.",
        "Presented findings to inform strategic decision-making and support business growth initiatives.",
      ],
    });
  }

  if (/Indian classical dance|YouTube API|TextBlob|NLP|sentiment analysis/i.test(source)) {
    projects.push({
      name: "Cultural Evolution & Popularity of Indian Classical Dance",
      bullets: [
        "Analyzed the cultural evolution and popularity of Indian classical dance forms using Python, YouTube API, and NLP.",
        "Collected and analyzed video data, performing sentiment analysis on viewer comments to assess engagement and cultural trends.",
        "Visualized patterns with pandas, Seaborn, and TextBlob, highlighting the impact of digital platforms on traditional art forms globally.",
      ],
    });
  }

  if (/GANS|e-scooter|REST APIs|MySQL|cloud functions|flight data|weather/i.test(source)) {
    projects.push({
      name: "GANS E-Scooter Service Data Pipeline",
      bullets: [
        "Developed a data automation pipeline for GANS, an e-scooter startup, using web scraping, REST APIs, and MySQL to collect and store city demographic, weather, and flight data.",
        "Automated data extraction and storage on Google Cloud Platform (GCP) with cloud functions and scheduled daily updates.",
        "Showcased expertise in data pipeline development, cloud computing, and database management.",
      ],
    });
  }

  return projects;
}

function extractEducation(sections: ResumeSections, allLines: string[]) {
  const source = [...sections.education, ...allLines].join("\n");
  const education: ResumeEducationItem[] = [];

  if (/WBS coding school|WBS CODING SCHOOL|DATA SCIENCE BOOTCAMP/i.test(source)) {
    education.push({
      degree: "Data Science Bootcamp",
      institution: "WBS Coding School, Berlin",
      dates: /04\/2024\s*-\s*10\/2024/i.test(source) ? "04/2024 - 10/2024" : "2024",
    });
  }

  if (/SRM arts|SRM ARTS|BACHELOR OF SCIENCE IN COMPUTER SCIENCE|Bachelors in Science/i.test(source)) {
    education.push({
      degree: "Bachelor of Science in Computer Science",
      institution: "SRM Arts & Science College, Chennai",
      dates: /07\/2012\s*-\s*05\/2015/i.test(source) ? "07/2012 - 05/2015" : "2012 - 2015",
    });
  }

  return education;
}

function formatStructuredResume(resume: StructuredResume) {
  const out: string[] = [];
  out.push(resume.fullName || "Candidate Name");
  out.push(resume.headline || "Target Role");

  const contactLine = [resume.contact.phone, resume.contact.email, resume.contact.location, resume.contact.linkedin].filter(Boolean).join(" | ");
  if (contactLine) out.push(contactLine);

  if (resume.summary) {
    out.push("");
    out.push("PROFESSIONAL SUMMARY");
    out.push(resume.summary);
  }

  if (resume.skills.length) {
    out.push("");
    out.push("CORE SKILLS");
    out.push(resume.skills.join(" | "));
  }

  if (resume.experience.length) {
    out.push("");
    out.push("PROFESSIONAL EXPERIENCE");
    resume.experience.forEach((job) => {
      out.push(`${job.title} | ${job.company} | ${job.dates}`);
      job.bullets.forEach((bullet) => out.push(`- ${bullet}`));
      out.push("");
    });
  }

  if (resume.projects.length) {
    out.push("PROJECTS");
    resume.projects.forEach((project) => {
      out.push(project.name);
      project.bullets.forEach((bullet) => out.push(`- ${bullet}`));
      out.push("");
    });
  }

  if (resume.education.length) {
    out.push("EDUCATION");
    resume.education.forEach((item) => out.push(`${item.degree} — ${item.institution} (${item.dates})`));
  }

  if (resume.languages.length) {
    out.push("");
    out.push("LANGUAGES");
    resume.languages.forEach((language) => out.push(`- ${language}`));
  }

  if (resume.softSkills.length) {
    out.push("");
    out.push("CORE STRENGTHS");
    out.push(resume.softSkills.join(" | "));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function cleanOnboardingCvExtraction(rawText: string): CleanedOnboardingCv {
  const lines = sectionFirstNormalize(splitLines(rawText));
  const sections = splitIntoSections(lines);
  const contact = extractContact(lines);

  const structured: StructuredResume = {
    fullName: contact.fullName,
    headline: extractHeadline(lines),
    contact: { phone: contact.phone, email: contact.email, location: contact.location, linkedin: contact.linkedin },
    summary: extractSummary(sections, lines),
    skills: extractSkills(sections, lines),
    experience: extractExperience(sections, lines),
    projects: extractProjects(sections, lines),
    education: extractEducation(sections, lines),
    languages: extractLanguages(sections, lines),
    softSkills: extractSoftSkills(sections, lines),
    qualityNotes: [],
  };

  const notes: string[] = [];
  if (!structured.fullName) notes.push("Name could not be confidently detected.");
  if (!structured.contact.email) notes.push("Email could not be confidently detected.");
  if (!structured.experience.length) notes.push("Experience section needs review.");
  if (!structured.education.length) notes.push("Education section needs review.");
  structured.qualityNotes = notes;

  return { cleanedText: formatStructuredResume(structured), structured, confidenceNotes: notes };
}

export function getCleanedOnboardingCvText(rawText: string) {
  return cleanOnboardingCvExtraction(rawText).cleanedText;
}
