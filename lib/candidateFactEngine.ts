export type Severity = "low" | "medium" | "high";

export type CandidateFacts = {
  fullName?: string;
  likelyNames: string[];
  locations: string[];
  companies: string[];
  roles: string[];
  years: string[];
  skills: string[];
  education: string[];
  rawEvidence: string[];
};

export type Contradiction = {
  field: string;
  candidateClaim: string;
  resumeEvidence: string;
  severity: Severity;
  clarificationQuestion: string;
};

export type MemoryCheck = {
  contradictions: Contradiction[];
  confidenceSignals: string[];
  riskSignals: string[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean))
  );
}

function firstLines(text: string, count = 22) {
  return text
    .split(/\n|\r|•|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

export function extractCandidateFacts(cvTextInput?: string): CandidateFacts {
  const cvText = clean(cvTextInput);
  const lines = firstLines(cvText, 30);
  const likelyNames = new Set<string>();
  const companies = new Set<string>();
  const roles = new Set<string>();
  const education = new Set<string>();

  for (const line of lines) {
    const words = line.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
    if (words.length >= 2 && words.length <= 4) {
      const candidate = words.slice(0, 3).join(" ");
      if (
        !/(university|school|engineer|analyst|developer|manager|germany|india|email|phone|linkedin|resume|curriculum|profile|summary|experience|education|skills)/i.test(
          candidate
        )
      ) {
        likelyNames.add(candidate);
      }
    }
  }

  const knownCompanyPattern =
    /\b(Zoho|Google|Microsoft|Amazon|WBS Coding School|Accenture|TCS|Infosys|Cognizant|Capgemini|Deloitte|IBM|SAP|Salesforce|Oracle|Meta|Facebook|Apple|Netflix|Adobe|Siemens|Bosch|Mercedes|BMW)\b/gi;

  for (const match of cvText.match(knownCompanyPattern) || []) {
    companies.add(match);
  }

  const companyLines = cvText
    .split(/\n|\r/)
    .filter((line) =>
      /(engineer|analyst|developer|support|consultant|manager|specialist|intern|company|corp|ltd|gmbh|inc|school)/i.test(
        line
      )
    )
    .slice(0, 30);

  for (const line of companyLines) {
    const words = line.match(/\b[A-Z][A-Za-z0-9&.\-]{1,}\b/g) || [];
    const phrase = words.slice(0, 4).join(" ");
    if (phrase && phrase.length > 2) companies.add(phrase);

    const roleMatch = line.match(
      /\b(technical support engineer|support engineer|product specialist|data analyst|business analyst|data scientist|software engineer|frontend developer|backend developer|full stack developer|customer success manager|customer support specialist|it support|qa engineer|project manager|product manager)\b/i
    );

    if (roleMatch?.[1]) roles.add(roleMatch[1]);
  }

  const years = unique(cvText.match(/\b(19|20)\d{2}\b/g) || []);

  const locations = extractLocations(cvText);

  const skills = extractSkills(cvText);

  const educationLines = cvText
    .split(/\n|\r/)
    .filter((line) =>
      /(university|college|school|bootcamp|bachelor|master|degree|certification|course|academy)/i.test(
        line
      )
    )
    .slice(0, 10);

  for (const line of educationLines) {
    education.add(line.trim());
  }

  return {
    fullName: Array.from(likelyNames)[0],
    likelyNames: Array.from(likelyNames).slice(0, 5),
    locations,
    companies: unique(Array.from(companies)).slice(0, 16),
    roles: unique(Array.from(roles)).slice(0, 12),
    years,
    skills,
    education: unique(Array.from(education)).slice(0, 8),
    rawEvidence: firstLines(cvText, 12),
  };
}

export function extractLocations(textInput?: string) {
  const text = normalize(clean(textInput));

  const locations = [
    "germany",
    "berlin",
    "munich",
    "hamburg",
    "nuremberg",
    "nürnberg",
    "frankfurt",
    "india",
    "chennai",
    "bangalore",
    "bengaluru",
    "coimbatore",
    "hyderabad",
    "delhi",
    "mumbai",
    "london",
    "uk",
    "united kingdom",
    "netherlands",
    "amsterdam",
    "usa",
    "united states",
    "canada",
    "singapore",
    "dubai",
    "uae",
  ];

  return locations.filter((place) => text.includes(normalize(place)));
}

export function extractSkills(textInput?: string) {
  const text = normalize(clean(textInput));

  const skills = [
    "python",
    "sql",
    "excel",
    "tableau",
    "power bi",
    "javascript",
    "typescript",
    "react",
    "next.js",
    "streamlit",
    "machine learning",
    "deep learning",
    "generative ai",
    "openai",
    "langchain",
    "data analysis",
    "technical support",
    "customer support",
    "customer success",
    "api",
    "crm",
    "zoho",
    "html",
    "css",
    "tailwind",
    "firebase",
    "supabase",
  ];

  return skills.filter((skill) => text.includes(normalize(skill)));
}

function extractCompaniesFromAnswer(answer: string) {
  const companies = new Set<string>();
  const known =
    /\b(Zoho|Google|Microsoft|Amazon|WBS Coding School|Accenture|TCS|Infosys|Cognizant|Capgemini|Deloitte|IBM|SAP|Salesforce|Oracle|Meta|Facebook|Apple|Netflix|Adobe|Siemens|Bosch|Mercedes|BMW)\b/gi;

  for (const match of answer.match(known) || []) {
    companies.add(match);
  }

  return Array.from(companies);
}

function hasCvEvidence(cvText: string, claim: string) {
  return normalize(cvText).includes(normalize(claim));
}

function issueKey(issue: Contradiction) {
  return `${issue.field}:${normalize(issue.candidateClaim)}:${issue.severity}`;
}

export function detectCandidateContradictions({
  answer,
  cvText,
  previousUserAnswers = [],
  sensitivity = 0.8,
}: {
  answer: string;
  cvText: string;
  previousUserAnswers?: string[];
  sensitivity?: number;
}): MemoryCheck {
  const cleanAnswer = clean(answer);
  const cleanCv = clean(cvText);
  const facts = extractCandidateFacts(cleanCv);
  const issues: Contradiction[] = [];
  const confidenceSignals: string[] = [];
  const riskSignals: string[] = [];

  if (!cleanAnswer || !cleanCv) {
    return { contradictions: [], confidenceSignals, riskSignals };
  }

  const nameClaim =
    cleanAnswer.match(/\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    cleanAnswer.match(/\bi am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i) ||
    cleanAnswer.match(/\bi'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i);

  if (nameClaim?.[1] && facts.likelyNames.length > 0) {
    const claimed = nameClaim[1];
    const matches = facts.likelyNames.some(
      (name) =>
        normalize(name).includes(normalize(claimed)) ||
        normalize(claimed).includes(normalize(name))
    );

    if (!matches) {
      issues.push({
        field: "candidate name",
        candidateClaim: claimed,
        resumeEvidence: `CV appears to show: ${facts.likelyNames.join(", ")}`,
        severity: "high",
        clarificationQuestion: `Let me stop you there — you said your name is ${claimed}, but the CV appears to show ${facts.likelyNames[0]}. Which name should I use?`,
      });
    }
  }

  const answerLocations = extractLocations(cleanAnswer);
  for (const location of answerLocations) {
    const cvHasLocation = facts.locations.includes(location);
    const otherCvLocations = facts.locations.filter((item) => item !== location);

    if (!cvHasLocation && otherCvLocations.length > 0 && sensitivity >= 0.7) {
      issues.push({
        field: "location",
        candidateClaim: location,
        resumeEvidence: `CV mentions: ${otherCvLocations.join(", ")}`,
        severity: sensitivity >= 0.9 ? "high" : "medium",
        clarificationQuestion: `You mentioned ${location}, but your CV mentions ${otherCvLocations[0]}. Are you referring to your current location, previous location, or target market?`,
      });
    }
  }

  const answerYears = unique(cleanAnswer.match(/\b(19|20)\d{2}\b/g) || []);
  for (const year of answerYears) {
    if (facts.years.length > 0 && !facts.years.includes(year) && sensitivity >= 0.78) {
      issues.push({
        field: "timeline",
        candidateClaim: year,
        resumeEvidence: `CV timeline includes: ${facts.years.slice(0, 8).join(", ")}`,
        severity: "medium",
        clarificationQuestion: `You mentioned ${year}, but I do not see that year in your CV timeline. Can you clarify where it fits?`,
      });
    }
  }

  const companies = extractCompaniesFromAnswer(cleanAnswer);
  for (const company of companies) {
    if (
      facts.companies.length > 0 &&
      !facts.companies.some((cvCompany) =>
        normalize(cvCompany).includes(normalize(company))
      ) &&
      sensitivity >= 0.8
    ) {
      issues.push({
        field: "company/employer",
        candidateClaim: company,
        resumeEvidence: `CV company/context includes: ${facts.companies.slice(0, 7).join(", ")}`,
        severity: "medium",
        clarificationQuestion: `You mentioned ${company}, but I do not clearly see that in your CV. Was this a job, client, project, or example?`,
      });
    }
  }

  const leadershipClaims = [
    {
      regex: /\bmanaged\s+([0-9]+|a|the)?\s*(team|people|members|engineers|analysts)/i,
      label: "team management",
    },
    {
      regex: /\bled\s+(a|the)?\s*(team|project|migration|implementation|initiative)/i,
      label: "leadership",
    },
    {
      regex: /\bowned\s+(the|a)?\s*(project|product|process|pipeline|system)/i,
      label: "ownership",
    },
  ];

  for (const claim of leadershipClaims) {
    const match = cleanAnswer.match(claim.regex)?.[0];
    if (match && !claim.regex.test(cleanCv)) {
      issues.push({
        field: claim.label,
        candidateClaim: match,
        resumeEvidence: `CV does not clearly support this ${claim.label} claim.`,
        severity: "high",
        clarificationQuestion: `Let me stop you there — you said "${match}", but I do not see that level of ${claim.label} in your CV. What exactly did you personally own?`,
      });
    }
  }

  const experienceClaim = cleanAnswer.match(
    /\b(\d+)\+?\s*(years|yrs)\s+(of\s+)?(experience|work experience|professional experience)\b/i
  );

  if (experienceClaim && sensitivity >= 0.72) {
    const claim = experienceClaim[0];
    const yearNumber = experienceClaim[1];
    const cvHasSameClaim =
      hasCvEvidence(cleanCv, claim) ||
      hasCvEvidence(cleanCv, `${yearNumber} years`) ||
      hasCvEvidence(cleanCv, `${yearNumber}+ years`);

    if (!cvHasSameClaim) {
      issues.push({
        field: "experience duration",
        candidateClaim: claim,
        resumeEvidence: "CV does not clearly show that exact experience duration.",
        severity: "medium",
        clarificationQuestion: `You mentioned ${claim}, but I do not see that exact duration in your CV. Can you clarify your real experience timeline?`,
      });
    }
  }

  const seniorityClaim = cleanAnswer.match(
    /\b(senior|lead|principal|manager|head of|director)\b/i
  );

  if (
    seniorityClaim &&
    sensitivity >= 0.8 &&
    !new RegExp(`\\b${seniorityClaim[1]}\\b`, "i").test(cleanCv)
  ) {
    issues.push({
      field: "seniority level",
      candidateClaim: seniorityClaim[1],
      resumeEvidence: "CV does not clearly show this seniority level.",
      severity: "high",
      clarificationQuestion: `You used the word "${seniorityClaim[1]}", but I do not see that seniority level in your CV. Were you officially in that role, or are you describing responsibility level?`,
    });
  }

  const metricMatches = [
    ...(cleanAnswer.match(/\b\d+%/g) || []),
    ...(cleanAnswer.match(
      /\b\d+\s*(users|customers|tickets|cases|projects|people|team members|hours|days|weeks|months|years)\b/gi
    ) || []),
  ];

  for (const metric of metricMatches) {
    if (!hasCvEvidence(cleanCv, metric) && sensitivity >= 0.7) {
      issues.push({
        field: "measurable impact",
        candidateClaim: metric,
        resumeEvidence: "This exact metric is not visible in the CV context.",
        severity: "medium",
        clarificationQuestion: `You mentioned ${metric}, but I do not see that number in your CV. Is this a real metric from your work, or are you estimating it?`,
      });
    }
  }

  for (const previous of previousUserAnswers.slice(-5)) {
    const previousLocations = extractLocations(previous);
    for (const location of answerLocations) {
      const conflict = previousLocations.find((oldLocation) => oldLocation !== location);
      if (conflict) {
        issues.push({
          field: "answer consistency",
          candidateClaim: location,
          resumeEvidence: `Earlier answer mentioned ${conflict}.`,
          severity: "medium",
          clarificationQuestion: `Earlier you mentioned ${conflict}, but now you mentioned ${location}. Which one is accurate?`,
        });
      }
    }
  }

  if (/\bmaybe|i think|probably|not sure|kind of\b/i.test(cleanAnswer)) {
    riskSignals.push("uncertain language");
  }

  if (/\b(i did everything|handled everything|fully owned everything)\b/i.test(cleanAnswer)) {
    riskSignals.push("possible overclaiming");
  }

  if (/\b\d+%|\b\d+\s*(customers|users|tickets|projects|cases)\b/i.test(cleanAnswer)) {
    confidenceSignals.push("uses measurable evidence");
  }

  const contradictions = Array.from(
    new Map(issues.map((issue) => [issueKey(issue), issue])).values()
  ).slice(0, 8);

  return {
    contradictions,
    confidenceSignals,
    riskSignals,
  };
}

export function factsToPrompt(facts: CandidateFacts) {
  return [
    `Likely name: ${facts.fullName || "unknown"}`,
    `Names: ${facts.likelyNames.join(", ") || "unknown"}`,
    `Locations: ${facts.locations.join(", ") || "unknown"}`,
    `Companies: ${facts.companies.join(", ") || "unknown"}`,
    `Roles: ${facts.roles.join(", ") || "unknown"}`,
    `Years: ${facts.years.join(", ") || "unknown"}`,
    `Skills: ${facts.skills.join(", ") || "unknown"}`,
    `Education: ${facts.education.join(" | ") || "unknown"}`,
  ].join("\n");
}
