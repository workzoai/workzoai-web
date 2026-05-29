import { NextResponse } from "next/server";
import {
  decideUnifiedRecruiterResponse,
  type TranscriptItem,
} from "@/lib/unifiedRecruiterIntelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandidateFactProfile = {
  companies?: string[];
  titles?: string[];
  skills?: string[];
  education?: string[];
  evidenceText?: string;
  estimatedYearsExperience?: number;
  factVersion?: string;
};

type ClaimValidationResult = {
  hasIssue: boolean;
  claimedCompany?: string;
  claimedTitle?: string;
  claimedYears?: number;
  verifiedCompanies: string[];
  verifiedTitles?: string[];
  estimatedYearsExperience?: number;
  issue?: "unverified_company" | "unverified_title" | "inflated_years" | "title_and_years";
  concern?: string;
  challenge?: string;
};

type InterviewRequest = {
  answer?: string;
  currentQuestion?: string;
  transcript?: TranscriptItem[];
  setup?: {
    cvText?: string;
    candidateProfileSummary?: string;
    jobDescription?: string;
    jobProfileSummary?: string;
    candidateFactProfile?: CandidateFactProfile;
    targetRole?: string;
    targetMarket?: string;
    companyStyle?: string;
    recruiterPersonality?: string;
    language?: string;
    recruiterMemoryProfile?: unknown;
    jobMemoryProfile?: unknown;
  };
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  recruiterTrust?: number;
  recruiterState?: string | null;
  recruiterMemorySummary?: string;
};

function text(value: unknown, maxChars = 1200) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean.slice(0, maxChars);
}

function compactInterviewContext(value: unknown, maxChars = 900) {
  const clean = text(value, maxChars * 2);
  if (clean.length <= maxChars) return clean;

  const priorityPatterns = [
    /\b(?:experience|worked|responsible|managed|led|handled|supported|resolved|built|created|developed|implemented|improved|analyzed|designed|collaborated|trained|coached)\b/i,
    /\b(?:customer|client|stakeholder|team|support|sales|data|analytics|manufacturing|warehouse|logistics|quality|safety|delivery|KPI|CRM|SaaS|SQL|Python|Excel|Tableau)\b/i,
    /\b\d+%|\b\d+\s*(?:years?|customers?|tickets?|projects?|months?)\b/i,
  ];

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);

  const selected = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: priorityPatterns.reduce((sum, pattern) => sum + (pattern.test(sentence) ? 2 : 0), 0) + (index < 6 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ");

  return (selected || clean).slice(0, maxChars).trim();
}


function normalizeCompany(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:gmbh|inc|corp|corporation|company|co|ltd|limited|llc|ag|plc|pvt|private|technologies|technology|solutions|systems|services)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueCompanies(values: string[], limit = 24) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/^[•\-–—|:]+|[•\-–—|:]+$/g, "")
      .trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 90) continue;
    const key = normalizeCompany(cleaned);
    if (!key || key.length < 2 || seen.has(key)) continue;
    if (/\b(?:data analyst|software engineer|technical support|product design|project manager|sales executive|customer success|candidate|recruiter|company|role|team|english|german|global|remote|hybrid)\b/i.test(cleaned)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}


function uniqueTitleFacts(values: string[], limit = 24) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = String(raw || "")
      .replace(/\s+/g, " ")
      .replace(/^[•\-–—|:]+|[•\-–—|:]+$/g, "")
      .trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 90) continue;
    if (/\b(?:candidate|recruiter|company|english|german|global|remote|hybrid|resume|cv|email|phone|linkedin)\b/i.test(cleaned)) continue;
    const key = normalizeRoleTitle(cleaned);
    if (!key || key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}


function extractCompanyLikeNames(sourceText: string, limit = 18) {
  const source = (sourceText || "").replace(/\s+/g, " ");
  const out: string[] = [];
  const patterns = [
    /\b(?:at|with|for|from)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5})\b/g,
    /\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\s+(?:GmbH|Inc|Corp|Corporation|Ltd|Limited|LLC|AG|PLC|Pvt|Technologies|Technology|Solutions|Systems|Services|University|School|College))\b/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const candidate = (match[1] || "")
        .replace(/\b(?:as|where|when|and|but|because|for|from|in|on|during|between|with|using|to|the|a|an|i|we|my|our)\b.*$/i, "")
        .replace(/[,.!?;:]+$/g, "")
        .trim();
      if (candidate) out.push(candidate);
      if (out.length >= limit) break;
    }
  }

  return uniqueCompanies(out, limit);
}

function companyMatchesClaim(claimed: string, verifiedCompanies: string[]) {
  const claimedKey = normalizeCompany(claimed);
  if (!claimedKey) return false;
  const claimedTokens = new Set(claimedKey.split(" ").filter((token) => token.length > 2));

  return verifiedCompanies.some((company) => {
    const key = normalizeCompany(company);
    if (!key) return false;
    if (key === claimedKey || key.includes(claimedKey) || claimedKey.includes(key)) return true;
    const tokens = key.split(" ").filter((token) => token.length > 2);
    if (!tokens.length || !claimedTokens.size) return false;
    const overlap = tokens.filter((token) => claimedTokens.has(token)).length;
    return overlap / Math.max(tokens.length, claimedTokens.size) >= 0.67;
  });
}


function normalizeRoleTitle(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+.# ]+/g, " ")
    .replace(/\b(?:senior|junior|lead|principal|associate|assistant|trainee|intern|graduate|professional|specialist)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatchesClaim(claimed: string, verifiedTitles: string[], evidenceText: string) {
  const claimedKey = normalizeRoleTitle(claimed);
  if (!claimedKey || claimedKey.length < 3) return true;

  const evidenceKey = normalizeRoleTitle(evidenceText || "");
  if (evidenceKey.includes(claimedKey)) return true;

  const claimedTokens = claimedKey.split(" ").filter((token) => token.length > 2);
  if (!claimedTokens.length) return true;

  return verifiedTitles.some((title) => {
    const key = normalizeRoleTitle(title);
    if (!key) return false;
    if (key === claimedKey || key.includes(claimedKey) || claimedKey.includes(key)) return true;
    const tokens = key.split(" ").filter((token) => token.length > 2);
    if (!tokens.length) return false;
    const overlap = claimedTokens.filter((token) => tokens.includes(token)).length;
    return overlap / Math.max(claimedTokens.length, tokens.length) >= 0.58;
  });
}

function cleanClaimedTitle(value: string) {
  return (value || "")
    .replace(/\b(?:for|at|with|in|where|when|and|but|because|during|from|to|the|a|an|my|our|their|this|that)\b.*$/i, "")
    .replace(/[,.!?;:]+$/g, "")
    .replace(/^\s*(?:a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExperienceTitleClaims(answer: string) {
  const clean = (answer || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const patterns = [
    /\b(?:i\s+)?(?:have|had)\s+(?:about\s+|around\s+|over\s+|more than\s+|nearly\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s*(?:\+\s*)?(?:years?|yrs?)\s+(?:of\s+)?(?:experience\s+)?(?:as|working as)\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/gi,
    /\b(?:i\s+)?(?:worked|work|was working|have worked|had worked|served|am working|was employed)\s+as\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/gi,
    /\b(?:my\s+)?(?:role|position|job|title)\s+(?:was|is|as)\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z][a-zA-Z0-9+.#/& -]{2,70})/gi,
  ];

  const claims: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clean))) {
      const title = cleanClaimedTitle(match[1] || "");
      if (!title) continue;
      if (/\b(?:experience|years|company|team|role|job|background|career|field|industry)\b/i.test(title)) continue;
      claims.push(title);
    }
  }

  return Array.from(new Set(claims.map((item) => item.toLowerCase()))).map((lower) => {
    const original = claims.find((item) => item.toLowerCase() === lower) || lower;
    return original.charAt(0).toUpperCase() + original.slice(1);
  }).slice(0, 4);
}

const numberWordMap: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

function parseNumberLike(value: string) {
  const clean = (value || "").toLowerCase().trim();
  if (/^\d+$/.test(clean)) return Number(clean);
  return numberWordMap[clean] || 0;
}

function extractClaimedYears(answer: string) {
  const clean = (answer || "").replace(/\s+/g, " ").trim().toLowerCase();
  const claims: number[] = [];
  const patterns = [
    /\b(?:i\s+)?(?:have|had|bring|possess)\s+(?:about\s+|around\s+|over\s+|more than\s+|nearly\s+|almost\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*(?:\+\s*)?(?:years?|yrs?)\s+(?:of\s+)?(?:experience|background)/gi,
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*(?:\+\s*)?(?:years?|yrs?)\s+(?:of\s+)?(?:experience|background)\b/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clean))) {
      const value = parseNumberLike(match[1] || "");
      if (value > 0) claims.push(value);
    }
  }

  return claims.length ? Math.max(...claims) : 0;
}


function answerDirectlyAsksForCvVerification(answer: string) {
  const lower = (answer || "").replace(/\s+/g, " ").toLowerCase();
  return /\b(do you see|can you see|is that on|does it show|is it mentioned|do i have|does my)\b.*\b(cv|resume|profile)\b/.test(lower) ||
    /\b(cv|resume|profile)\b.*\b(show|mention|see|support|verify|confirm)\b/.test(lower);
}

function evidenceMentionsClaimedYears(evidenceText: string, claimedYears: number) {
  if (!claimedYears || claimedYears <= 0) return false;
  const source = (evidenceText || "").toLowerCase();
  const wordsByNumber: Record<number, string[]> = {
    1: ["one"], 2: ["two"], 3: ["three"], 4: ["four"], 5: ["five"], 6: ["six"], 7: ["seven"], 8: ["eight"], 9: ["nine"], 10: ["ten"],
    11: ["eleven"], 12: ["twelve"], 13: ["thirteen"], 14: ["fourteen"], 15: ["fifteen"], 16: ["sixteen"], 17: ["seventeen"], 18: ["eighteen"], 19: ["nineteen"], 20: ["twenty"],
  };
  const wordOptions = wordsByNumber[claimedYears] || [];
  const yearPatterns = [String(claimedYears), ...wordOptions]
    .map((value) => new RegExp(`\\b${value}\\+?\\s*(?:years?|yrs?)\\b`, "i"));
  return yearPatterns.some((pattern) => pattern.test(source));
}

function estimateYearsFromEvidence(text: string) {
  const source = (text || "").replace(/\s+/g, " ");
  const explicit = source.match(/(?:over|more than|around|about|nearly)?\s*(\d{1,2})\+?\s+years?\s+of\s+experience/i);
  const explicitYears = explicit ? Number(explicit[1]) : 0;

  const currentYear = new Date().getFullYear();
  const ranges: Array<[number, number]> = [];
  const patterns = [
    /\b(?:\d{1,2}\/)?((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:present|current|heute|now|((?:19|20)\d{2}))/gi,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:present|current|heute|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+((?:19|20)\d{2}))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : currentYear;
      if (start >= 1980 && end >= start && end <= currentYear + 1) ranges.push([start, end]);
    }
  }

  const rangeYears = ranges.reduce((sum, [start, end]) => sum + Math.max(0.5, end - start), 0);
  const estimated = Math.max(explicitYears, rangeYears);
  return estimated > 0 ? Math.round(estimated * 10) / 10 : 0;
}

function extractTitleLikeNames(sourceText: string, limit = 18) {
  const source = (sourceText || "").replace(/\s+/g, " ");
  const commonTitles = source.match(/\b(?:Technical Support Engineer|Application Engineer|Data Analyst|Data Scientist|Sales Executive|Business Development Executive|Customer Success Manager|Product Design Engineer|CAD Designer|Graduate Intern|Software Engineer|Project Manager|Production Supervisor|Operations Manager|Support Specialist|Product Specialist|Manufacturing Operations Professional|Customer-Facing SaaS|Business Development Professional)\b/gi) || [];
  return uniqueTitleFacts(commonTitles, limit);
}

function extractExperienceCompanyClaims(answer: string) {
  const clean = (answer || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const experienceClaimPatterns = [
    /\b(?:i\s+)?(?:worked|work|was working|have worked|had worked|joined|served|consulted|interned|was employed|am employed)\s+(?:as\s+[A-Za-z ]+\s+)?(?:at|with|for|in)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5})\b/gi,
    /\b(?:my|the)\s+(?:experience|role|job|position|responsibility|project|internship)\s+(?:at|with|for|in)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5})\b/gi,
    /\b(?:when|while)\s+i\s+(?:was\s+)?(?:worked|working|employed|interning)\s+(?:at|with|for|in)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5})\b/gi,
  ];

  const claims: string[] = [];
  for (const pattern of experienceClaimPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clean))) {
      const value = (match[1] || "")
        .replace(/\b(?:as|where|when|and|but|because|for|from|in|on|during|between|with|using|to|the|a|an|i|we|my|our)\b.*$/i, "")
        .replace(/[,.!?;:]+$/g, "")
        .trim();
      if (value) claims.push(value);
    }
  }

  return uniqueCompanies(claims, 5);
}

function validateCandidateCompanyClaim({
  answer,
  setup,
  compactCv,
}: {
  answer: string;
  setup: InterviewRequest["setup"];
  compactCv: string;
}): ClaimValidationResult {
  const factProfile = setup?.candidateFactProfile || {};
  const evidenceText = [factProfile.evidenceText, compactCv].filter(Boolean).join(" ");
  const verifiedCompanies = uniqueCompanies([
    ...(Array.isArray(factProfile.companies) ? factProfile.companies : []),
    ...extractCompanyLikeNames(factProfile.evidenceText || "", 18),
    ...extractCompanyLikeNames(compactCv, 18),
  ], 24);

  const verifiedTitles = uniqueTitleFacts([
    ...(Array.isArray(factProfile.titles) ? factProfile.titles : []),
    ...extractTitleLikeNames(factProfile.evidenceText || "", 18),
    ...extractTitleLikeNames(compactCv, 18),
  ], 24);

  const estimatedYearsExperience =
    typeof factProfile.estimatedYearsExperience === "number" && factProfile.estimatedYearsExperience > 0
      ? factProfile.estimatedYearsExperience
      : estimateYearsFromEvidence(evidenceText);

  const companyClaims = extractExperienceCompanyClaims(answer);
  const titleClaims = extractExperienceTitleClaims(answer);
  const claimedYears = extractClaimedYears(answer);

  const unverifiedCompany = companyClaims.find((claim) => !companyMatchesClaim(claim, verifiedCompanies));
  const unverifiedTitle = titleClaims.find((claim) => !titleMatchesClaim(claim, verifiedTitles, evidenceText));
  const asksForCvVerification = answerDirectlyAsksForCvVerification(answer);
  const evidenceSupportsClaimedYears = evidenceMentionsClaimedYears(evidenceText, claimedYears);
  const inflatedYears =
    claimedYears > 0 && (
      (estimatedYearsExperience > 0 && claimedYears >= Math.max(estimatedYearsExperience + 2, estimatedYearsExperience * 1.45)) ||
      (asksForCvVerification && !evidenceSupportsClaimedYears) ||
      (claimedYears >= 6 && !evidenceSupportsClaimedYears) ||
      (claimedYears >= 4 && !evidenceSupportsClaimedYears && Boolean(unverifiedTitle))
    );

  if (!unverifiedCompany && !unverifiedTitle && !inflatedYears && !asksForCvVerification) {
    return { hasIssue: false, verifiedCompanies, verifiedTitles, estimatedYearsExperience };
  }

  const verifiedCompanyLine = verifiedCompanies.slice(0, 4).join(", ");
  const verifiedTitleLine = verifiedTitles.slice(0, 5).join(", ");
  const concerns: string[] = [];

  if (unverifiedCompany) {
    concerns.push(`candidate mentioned experience at ${unverifiedCompany}, but that company is not visible in the verified CV evidence${verifiedCompanyLine ? ` (${verifiedCompanyLine})` : ""}`);
  }

  if (unverifiedTitle) {
    concerns.push(`candidate claimed experience as ${unverifiedTitle}, but the verified CV titles/evidence do not clearly show that${verifiedTitleLine ? ` (visible titles: ${verifiedTitleLine})` : ""}`);
  }

  if (inflatedYears) {
    concerns.push(
      estimatedYearsExperience
        ? `candidate claimed ${claimedYears} years of experience, while the CV evidence suggests about ${estimatedYearsExperience} years or does not support that timeline`
        : `candidate claimed ${claimedYears} years of experience, but the CV evidence I have does not clearly support that number`,
    );
  }

  const evidenceSnapshot = [
    verifiedTitleLine ? `roles I can see: ${verifiedTitleLine}` : "",
    verifiedCompanyLine ? `companies I can see: ${verifiedCompanyLine}` : "",
    estimatedYearsExperience ? `timeline suggests about ${estimatedYearsExperience} years` : "",
  ].filter(Boolean).join("; ");

  const heardClaim = [
    unverifiedTitle ? `${unverifiedTitle}` : "",
    unverifiedCompany ? `at ${unverifiedCompany}` : "",
    inflatedYears ? `${claimedYears} years` : "",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const humanChallenge = (() => {
    const evidenceLine = evidenceSnapshot
      ? `The CV evidence I have shows ${evidenceSnapshot}.`
      : "I cannot clearly verify that from the CV evidence I have.";

    if (unverifiedCompany && (unverifiedTitle || inflatedYears)) {
      return `Let me clarify one thing before we move on. I heard you mention ${heardClaim}, but I cannot clearly verify that combination from your CV. ${evidenceLine} Was this an unlisted role, a client project, freelance work, or a responsibility inside another listed position?`;
    }

    if (unverifiedCompany) {
      return `Let me clarify one thing before we move on. I heard you mention experience at ${unverifiedCompany}, but I do not see that company in the CV evidence I have. ${evidenceLine} Was this an unlisted role, freelance work, a client project, or something outside the resume?`;
    }

    if (unverifiedTitle) {
      return `Let me clarify one thing before we move on. I heard you describe yourself as ${unverifiedTitle}, but I do not see that as a verified role title in your CV evidence. ${evidenceLine} Was that your official title, a target role, or a responsibility within another role?`;
    }

    if (asksForCvVerification) {
      return `Good question — based on the CV evidence I have, I cannot verify ${claimedYears} years of experience. ${evidenceLine} Can you clarify whether that experience is listed under another role, or is it outside the resume?`;
    }

    return `Let me clarify the timeline before we continue. You mentioned ${claimedYears} years of experience, but the CV evidence I have does not clearly support that number. ${evidenceLine} Can you explain where that timeline comes from?`;
  })();

  return {
    hasIssue: true,
    claimedCompany: unverifiedCompany,
    claimedTitle: unverifiedTitle,
    claimedYears: inflatedYears ? claimedYears : undefined,
    verifiedCompanies,
    verifiedTitles,
    estimatedYearsExperience,
    issue: unverifiedCompany && (unverifiedTitle || inflatedYears)
      ? "title_and_years"
      : unverifiedCompany
        ? "unverified_company"
        : unverifiedTitle
          ? "unverified_title"
          : "inflated_years",
    concern: `Possible CV inconsistency: ${concerns.join("; ")}. Recruiter should stay slightly cautious for the next few answers until the candidate clarifies this.`,
    challenge: humanChallenge,
  };
}

function compactTranscript(items: TranscriptItem[] | undefined) {
  return (items || [])
    .slice(-4)
    .map((item) => ({
      role: item.role,
      text: text(item.text, 260),
      time: item.time,
    }))
    .filter((item) => item.text);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InterviewRequest;
    const setup = body.setup || {};
    const answer = text(body.answer);

    if (!answer) {
      return NextResponse.json(
        { error: "Candidate answer is required." },
        { status: 400 },
      );
    }

    const cvGroundingEvidence = compactInterviewContext(
      [
        setup.candidateFactProfile?.evidenceText,
        setup.cvText,
        body.cvText,
        setup.candidateProfileSummary,
      ]
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .join(" "),
      2200,
    );
    const compactCv = compactInterviewContext(
      setup.candidateProfileSummary || setup.cvText || body.cvText,
      900,
    );
    const compactJob = compactInterviewContext(
      setup.jobProfileSummary || body.jobDescription || setup.jobDescription,
      900,
    );

    const claimValidation = validateCandidateCompanyClaim({
      answer,
      setup,
      compactCv: cvGroundingEvidence || compactCv,
    });

    if (claimValidation.hasIssue) {
      return NextResponse.json({
        question: claimValidation.challenge,
        displayQuestion: claimValidation.challenge,
        feedback: "Possible CV inconsistency detected. Recruiter is asking a human clarification before scoring this answer.",
        intent: "possible_exaggeration",
        shouldAdvanceQuestion: false,
        shouldCountAsAnswer: false,
        shouldStayOnCurrentQuestion: true,
        trustDelta: -6,
        recruiterState: "skeptical",
        correction: claimValidation.challenge,
        concern: claimValidation.concern,
        psychology: {
          trust: Math.max(25, Math.min(90, (typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58) - 6)),
          interest: 52,
          skepticism: 72,
          patience: 54,
          engagement: 60,
          confidenceInCandidate: 40,
        },
        cvRead: {
          verifiedCompanies: claimValidation.verifiedCompanies.slice(0, 8),
          claimedCompany: claimValidation.claimedCompany,
          claimedTitle: claimValidation.claimedTitle,
          claimedYears: claimValidation.claimedYears,
          verifiedTitles: claimValidation.verifiedTitles?.slice(0, 8) || [],
          estimatedYearsExperience: claimValidation.estimatedYearsExperience,
          issue: claimValidation.issue || "cv_grounding_mismatch",
        },
        recruiterMemory: {
          summary: `Candidate made a CV claim that needs clarification. Stay slightly cautious for the next few answers, but give the candidate a chance to explain.`,
          weakMoments: ["Possible mismatch between spoken experience and CV evidence; needs clarification."],
          strongMoments: [],
          openDoubts: [claimValidation.concern || "Unverified company claim."],
          roleFitSignals: [],
        },
        memoryEvents: [
          {
            type: "cv_grounding_check",
            severity: "medium",
            detail: claimValidation.concern,
          },
        ],
        pressure: {
          level: 68,
          label: "consistency check",
          reason: "Candidate mentioned experience that is not clearly visible in CV evidence.",
          behaviorShift: "Recruiter pauses politely, references the CV evidence, and asks for clarification before moving on.",
        },
        honestFeedback: {
          headline: "CV consistency check",
          recruiterRead: "The recruiter heard a role, company, or timeline claim that is not clearly supported by the available CV evidence.",
          risk: "Unsupported claims make a recruiter more cautious until the timeline or responsibility is clarified.",
          nextFix: "Clarify whether this was an official role, client project, responsibility inside another role, freelance work, or not yet added to the resume.",
        },
        interruption: {
          shouldInterrupt: true,
          interruptionMessage: claimValidation.challenge,
          severity: "medium",
        },
        scores: {
          relevance: 35,
          clarity: 48,
          structure: 42,
          evidence: 18,
          confidence: 35,
          pressure: 68,
          overall: Math.max(25, Math.min(90, (typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58) - 8)),
        },
        liveUiState: {
          label: "Recruiter is clarifying CV evidence",
          theme: "skeptical",
          pressure: {
            level: 68,
            label: "consistency check",
            reason: "Claim is not clearly supported by CV evidence.",
            behaviorShift: "Recruiter asks a calm clarification before continuing.",
          },
          honestFeedback: null,
          recruiterMemoryInsight: null,
          livePressureSimulation: null,
          marketExpectation: null,
          humanImperfection: null,
          socialSignals: null,
          cinematicRealism: null,
        },
        trustTimeline: [
          {
            type: "drop",
            delta: -8,
            reason: claimValidation.concern,
          },
        ],
      });
    }

    const decision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: text(body.currentQuestion, 360),
      transcript: compactTranscript(body.transcript),
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      recruiterState: body.recruiterState || null,
      setup: {
        cvText: compactCv,
        jobDescription: compactJob,
        targetRole: text(body.targetRole || setup.targetRole, 120),
        targetMarket: text(body.targetMarket || setup.targetMarket, 80),
        companyStyle: text(body.companyStyle || setup.companyStyle, 120),
        recruiterPersonality: text(body.recruiterPersonality || setup.recruiterPersonality, 80),
        language: text(setup.language, 40),
        recruiterMemoryProfile: body.recruiterMemorySummary
          ? { summary: text(body.recruiterMemorySummary, 420) }
          : undefined,
        jobMemoryProfile: undefined,
      },
    });

    return NextResponse.json({
      question: decision.spokenReply,
      displayQuestion: decision.displayQuestion,
      feedback: decision.feedback,
      intent: decision.intent,
      shouldAdvanceQuestion: decision.shouldAdvanceQuestion,
      shouldCountAsAnswer: decision.shouldCountAsAnswer,
      shouldStayOnCurrentQuestion: decision.shouldStayOnCurrentQuestion,
      trustDelta: decision.trustDelta,
      recruiterState: decision.recruiterState,
      correction: decision.correction || "",
      concern: decision.concern || "",
      psychology: decision.psychology,
      cvRead: decision.cvRead || null,
      recruiterMemory: decision.recruiterMemory || null,
      memoryEvents: decision.memoryEvents || [],
      pressure: decision.pressure || null,
      honestFeedback: decision.honestFeedback || null,
      recruiterMemoryInsight: decision.recruiterMemoryInsight || null,
      livePressureSimulation: decision.livePressureSimulation || null,
      marketExpectation: decision.marketExpectation || null,
      humanImperfection: decision.humanImperfection || null,
      socialSignals: decision.socialSignals || null,
      cinematicRealism: decision.cinematicRealism || null,
      conversationStage: decision.conversationStage || null,
      interruption: {
        shouldInterrupt:
          decision.intent === "nonsense" ||
          decision.intent === "possible_exaggeration" ||
          decision.intent === "contradiction",
        interruptionMessage: decision.concern || decision.correction || "",
        severity:
          decision.intent === "nonsense" || decision.intent === "contradiction"
            ? "medium"
            : "low",
      },
      scores: {
        relevance: decision.shouldCountAsAnswer ? Math.max(40, Math.min(92, decision.psychology.interest)) : 0,
        clarity: decision.intent === "interview_answer" ? Math.max(38, Math.min(90, decision.psychology.engagement)) : 0,
        structure: decision.intent === "interview_answer" ? Math.max(34, Math.min(88, decision.psychology.patience)) : 0,
        evidence:
          decision.intent === "possible_exaggeration" || decision.intent === "contradiction" || decision.intent === "nonsense"
            ? 22
            : decision.shouldCountAsAnswer
              ? Math.max(42, Math.min(90, decision.psychology.confidenceInCandidate))
              : 0,
        confidence: decision.psychology.confidenceInCandidate,
        pressure: decision.pressure?.level ?? 45,
        overall: decision.psychology.trust,
      },
      liveUiState: {
        label:
          decision.intent === "candidate_question"
            ? "Clarifying"
            : decision.intent === "possible_exaggeration" || decision.intent === "nonsense" || decision.intent === "contradiction"
              ? "Recruiter is checking consistency"
              : decision.pressure?.label === "intense" || decision.pressure?.label === "high"
                ? "Pressure increased"
                : decision.recruiterState === "skeptical"
                  ? "Skepticism rising"
                  : decision.shouldCountAsAnswer
                    ? "Answer accepted"
                    : "Staying on question",
        theme: decision.recruiterState,
        pressure: decision.pressure || null,
        honestFeedback: decision.honestFeedback || null,
        recruiterMemoryInsight: decision.recruiterMemoryInsight || null,
        livePressureSimulation: decision.livePressureSimulation || null,
        marketExpectation: decision.marketExpectation || null,
        humanImperfection: decision.humanImperfection || null,
        socialSignals: decision.socialSignals || null,
        cinematicRealism: decision.cinematicRealism || null,
      },
      trustTimeline: [
        {
          type: decision.trustDelta < 0 ? "drop" : decision.trustDelta > 0 ? "gain" : "steady",
          delta: decision.trustDelta,
          reason: decision.pressure?.reason || decision.feedback,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Interview intelligence failed.",
      },
      { status: 500 },
    );
  }
}
