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
  currentRole?: string;
  currentCompany?: string;
  careerStage?: "entry" | "early" | "experienced" | "senior" | "unknown";
  estimatedYearsExperience?: number;
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

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeRole(value: string) {
  return normalize(value)
    .replace(/\b(senior|junior|lead|principal|associate|assistant|trainee|intern|graduate|entry level)\b/g, " ")
    .replace(/\b(role|position|job|career|profession|field)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roleTokens(value: string) {
  return normalizeRole(value)
    .split(" ")
    .filter((token) => token.length > 2 && !/^(and|the|for|with|from|into|toward|towards)$/.test(token));
}

function roleLooksSupported(claimedRole: string, facts: CandidateFacts, cvText: string) {
  const claimed = normalizeRole(claimedRole);
  if (!claimed || claimed.length < 3) return true;
  const cv = normalizeRole(cvText);
  if (cv.includes(claimed)) return true;

  const claimedTokens = roleTokens(claimedRole);
  if (!claimedTokens.length) return true;

  return facts.roles.some((role) => {
    const roleNorm = normalizeRole(role);
    if (!roleNorm) return false;
    if (roleNorm.includes(claimed) || claimed.includes(roleNorm)) return true;
    const tokens = roleTokens(role);
    const overlap = claimedTokens.filter((token) => tokens.includes(token)).length;
    return overlap / Math.max(claimedTokens.length, tokens.length || 1) >= 0.58;
  });
}

function extractLikelyCurrentRoleAndCompany(cvText: string) {
  const lines = cvText
    .split(/\n|\r/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rolePattern = /\b(?:technical support engineer|support engineer|application engineer|data analyst|business analyst|data scientist|software engineer|frontend developer|backend developer|full stack developer|customer success manager|customer support specialist|it support specialist|qa engineer|project manager|product manager|sales executive|business development executive|production supervisor|operations manager|manufacturing operations professional|product design engineer|graduate intern|cybersecurity engineer|security analyst)\b/i;

  let currentRole = "";
  let currentCompany = "";

  for (let i = 0; i < Math.min(lines.length, 80); i += 1) {
    const line = lines[i];
    const hasCurrentDate = /\b(?:present|current|heute|now)\b/i.test(line);
    const hasRole = rolePattern.test(line);

    if (hasCurrentDate || hasRole) {
      const nearby = [lines[i - 1], line, lines[i + 1], lines[i + 2]].filter(Boolean).join(" | ");
      const roleMatch = nearby.match(rolePattern);
      if (roleMatch?.[0]) currentRole = titleCase(roleMatch[0]);

      const companyMatch = nearby.match(/\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\s+(?:GmbH|Inc|Corp|Corporation|Ltd|Limited|LLC|AG|PLC|Pvt|Technologies|Technology|Solutions|Systems|Services))\b/);
      if (companyMatch?.[1]) currentCompany = companyMatch[1];

      if (currentRole || currentCompany) break;
    }
  }

  return { currentRole, currentCompany };
}

function estimateTotalExperienceYears(cvText: string) {
  const text = cvText.replace(/\s+/g, " ");
  const explicit = text.match(/\b(?:over|more than|around|about|nearly)?\s*(\d{1,2})\+?\s+years?\s+of\s+(?:professional\s+)?experience\b/i);
  const explicitYears = explicit ? Number(explicit[1]) : 0;
  const currentYear = new Date().getFullYear();
  const ranges: Array<[number, number]> = [];

  const patterns = [
    /\b(?:\d{1,2}\/)?((?:19|20)\d{2})\s*(?:-|-|-|to)\s*(?:present|current|heute|now|((?:19|20)\d{2}))/gi,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\s*(?:-|-|-|to)\s*(?:present|current|heute|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2}))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : currentYear;
      if (start >= 1980 && end >= start && end <= currentYear + 1) ranges.push([start, end]);
    }
  }

  const rangeYears = ranges.reduce((sum, [start, end]) => sum + Math.max(0.5, end - start), 0);
  const estimated = Math.max(explicitYears, rangeYears);
  return estimated > 0 ? Math.round(estimated * 10) / 10 : 0;
}

function deriveCareerStage(years: number, roles: string[]) {
  const roleText = normalize(roles.join(" "));
  if (/\b(senior|lead|principal|manager|head|director)\b/.test(roleText) || years >= 8) return "senior" as const;
  if (years >= 3) return "experienced" as const;
  if (years > 0) return "early" as const;
  if (/\b(intern|trainee|junior|entry)\b/.test(roleText)) return "entry" as const;
  return "unknown" as const;
}

function extractCareerEntryRoleClaim(answer: string) {
  const cleanAnswer = answer.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:trying|hoping|looking|want|planning|aiming|interested)\s+(?:to\s+)?(?:move|transition|switch|shift|get|become|enter|start|break)\s+(?:into|towards?|as|in|a|an|the)?\s+([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/i,
    /\b(?:my\s+)?(?:first|entry[- ]level)\s+([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})\s+(?:role|job|position)\b/i,
    /\b(?:new|beginner|starting out|just starting)\s+(?:in|with|as)?\s+([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/i,
    /\b(?:after|following)\s+(?:my\s+)?(?:bootcamp|course|training|degree)\s+(?:i\s+)?(?:want|wanted|hope|would like|am interested)\s+(?:to\s+)?(?:become|work as|get into|move into)\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/i,
  ];

  for (const pattern of patterns) {
    const match = cleanAnswer.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const role = raw
      .replace(/\b(?:now|next|soon|because|and|but|with|where|when|for|from|job|role|position|field|career)\b.*$/i, "")
      .replace(/[,.!?;:]+$/g, "")
      .replace(/^\s*(?:a|an|the)\s+/i, "")
      .trim();
    if (role && role.length >= 3) return titleCase(role);
  }

  return "";
}

export function extractCandidateFacts(cvTextInput?: string, resumeProfileInput?: unknown): CandidateFacts {
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

  // PRIMARY: read companies and roles directly from resumeProfile.experience.
  // The hardcoded brand regex and line-scanning approach below misses companies
  // any employer whose name isn't a
  // globally famous brand. resumeProfile is the authoritative structured source.
  const rp = resumeProfileInput as Record<string, unknown> | null | undefined;
  if (rp && typeof rp === "object" && Array.isArray(rp.experience)) {
    for (const exp of rp.experience as Array<Record<string, unknown>>) {
      const co = String(exp.company || "").trim();
      if (co.length >= 2) companies.add(co);
      const title = String(exp.title || "").trim();
      if (title.length >= 2) roles.add(title);
    }
  }

  // SECONDARY: structural extraction from "- Title • Company • Dates" format.
  // Split on bullet/pipe separators; skip segments that look like titles or dates.
  const _jobTitlePfx = /^(technical support|application engineer|software engineer|data analyst|business analyst|product manager|project manager|qa engineer|marketing|intern|trainee|frontend|backend|customer success|customer support|it support)/i;
  const _datePfx = /^(19|20)\d{2}|^(present|current|today|heute)/i;
  for (const _line of cvText.split(/\n|\r/).filter(Boolean)) {
    const _segs = _line.split(/[•·|]/).map((s) =>
      s.replace(/^[-*\s]+/, "").replace(/\d{4}.*$/, "").replace(/\s{2,}/g, " ").trim(),
    );
    for (const _seg of _segs) {
      if (_seg.length < 2 || _seg.length > 70) continue;
      if (/^[0-9\-/ .]+$/.test(_seg)) continue;
      if (_datePfx.test(_seg)) continue;
      if (_jobTitlePfx.test(_seg)) continue;
      // Only accept capitalized multi-character tokens that look like proper names
      if (/^[A-Z]/.test(_seg) && /[a-zA-Z]{2}/.test(_seg)) {
        // If it matches a role pattern, add as role; otherwise treat as company candidate
        const _rm = _seg.match(/\b(technical support engineer|support engineer|product specialist|data analyst|business analyst|data scientist|software engineer|frontend developer|backend developer|full stack developer|customer success manager|customer support specialist|it support|qa engineer|project manager|product manager)\b/i);
        if (_rm?.[1]) roles.add(_rm[1]);
        else companies.add(_seg);
      }
    }
  }

  // TERTIARY: well-known brand fallback (supplements structural extraction)
  const knownCompanyPattern =
    /\b(Zoho|Google|Microsoft|Amazon|Accenture|TCS|Infosys|Cognizant|Capgemini|Deloitte|IBM|SAP|Salesforce|Oracle|Meta|Facebook|Apple|Netflix|Adobe|Siemens|Bosch|Mercedes|BMW)\b/gi;

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

  const { currentRole, currentCompany } = extractLikelyCurrentRoleAndCompany(cvText);
  const estimatedYearsExperience = estimateTotalExperienceYears(cvText) || undefined;
  const rolesArr = unique(Array.from(roles)).slice(0, 12);
  const careerStage = deriveCareerStage(estimatedYearsExperience || 0, rolesArr);

  return {
    fullName: Array.from(likelyNames)[0],
    likelyNames: Array.from(likelyNames).slice(0, 5),
    locations,
    companies: unique(Array.from(companies)).slice(0, 16),
    roles: rolesArr,
    years,
    skills,
    education: unique(Array.from(education)).slice(0, 8),
    rawEvidence: firstLines(cvText, 12),
    currentRole: currentRole || undefined,
    currentCompany: currentCompany || undefined,
    careerStage,
    estimatedYearsExperience,
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
  resumeProfile,
}: {
  answer: string;
  cvText: string;
  previousUserAnswers?: string[];
  sensitivity?: number;
  resumeProfile?: unknown;
}): MemoryCheck {
  const cleanAnswer = clean(answer);
  const cleanCv = clean(cvText);
  const facts = extractCandidateFacts(cleanCv, resumeProfile);
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
        clarificationQuestion: `Let me stop you there, you said your name is ${claimed}, but the CV appears to show ${facts.likelyNames[0]}. Which name should I use?`,
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
        clarificationQuestion: `Let me stop you there, you said "${match}", but I do not see that level of ${claim.label} in your CV. What exactly did you personally own?`,
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


  const entryRoleClaim = extractCareerEntryRoleClaim(cleanAnswer);
  if (
    entryRoleClaim &&
    sensitivity >= 0.72 &&
    facts.roles.length > 0 &&
    roleLooksSupported(entryRoleClaim, facts, cleanCv) &&
    (facts.careerStage === "experienced" || facts.careerStage === "senior" || (facts.estimatedYearsExperience || 0) >= 2)
  ) {
    const currentRole = facts.currentRole || facts.roles[0];
    const experienceLine = facts.estimatedYearsExperience
      ? `CV suggests about ${facts.estimatedYearsExperience} years of experience.`
      : "CV already shows experience in this area.";

    issues.push({
      field: "career narrative consistency",
      candidateClaim: `moving into / becoming ${entryRoleClaim}`,
      resumeEvidence: `CV shows ${currentRole || entryRoleClaim}${facts.currentCompany ? ` at ${facts.currentCompany}` : ""}. ${experienceLine}`,
      severity: "high",
      clarificationQuestion: `I want to clarify your career story. Your CV suggests you already have experience as ${currentRole || entryRoleClaim}, but your answer sounds like you are only now moving into ${entryRoleClaim}. Can you explain that timeline?`,
    });
  }

  if (
    /\b(?:first\s+(?:job|role|position)|no\s+(?:professional\s+)?experience|completely\s+new|just\s+starting)\b/i.test(cleanAnswer) &&
    (facts.estimatedYearsExperience || 0) >= 2
  ) {
    issues.push({
      field: "career stage consistency",
      candidateClaim: cleanAnswer.slice(0, 180),
      resumeEvidence: `CV suggests about ${facts.estimatedYearsExperience} years of experience${facts.currentRole ? ` and a role as ${facts.currentRole}` : ""}.`,
      severity: "high",
      clarificationQuestion: `Let me clarify something before we continue. Your answer sounds like you are just starting out, but your CV suggests prior professional experience${facts.currentRole ? ` as ${facts.currentRole}` : ""}. How should I understand that?`,
    });
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
    `Current role: ${facts.currentRole || "unknown"}`,
    `Current company: ${facts.currentCompany || "unknown"}`,
    `Career stage: ${facts.careerStage || "unknown"}`,
    `Estimated experience: ${facts.estimatedYearsExperience || "unknown"}`,
    `Years: ${facts.years.join(", ") || "unknown"}`,
    `Skills: ${facts.skills.join(", ") || "unknown"}`,
    `Education: ${facts.education.join(" | ") || "unknown"}`,
  ].join("\n");
}
