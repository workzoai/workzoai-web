import { NextResponse } from "next/server";
import { getRoleIntelligenceBrief, serializeRoleBriefForPrompt } from "@/lib/workzoRoleIntelligence";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import {
  decideUnifiedRecruiterResponse,
  type TranscriptItem,
} from "@/lib/unifiedRecruiterIntelligence";
import { enhanceWorkZoDecisionV2 } from "@/lib/workzoRecruiterIntelligenceV2";
import {
  applyInterviewIntelligence95ToDecision,
  buildInterviewIntelligence95,
  decorateJobContextWithCompanyDNA,
} from "@/lib/workzoInterviewIntelligence95";
import {
  buildRecruiterBrain,
  serializeRecruiterBrainForPrompt,
} from "@/lib/recruiterBrainEngine";

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
    companyDescription?: string;
    companyName?: string;
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
  companyDescription?: string;
  targetCompany?: string;
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


type NormalizedInterviewLanguage = { code: string; label: string };

function normalizeInterviewLanguage(value?: string): NormalizedInterviewLanguage {
  const raw = text(value || "English", 80).toLowerCase();
  if (raw.includes("german") || raw.includes("deutsch") || raw === "de" || raw === "de-de") return { code: "de-DE", label: "German" };
  if (raw.includes("dutch") || raw.includes("nederlands") || raw === "nl" || raw === "nl-nl") return { code: "nl-NL", label: "Dutch" };
  if (raw.includes("french") || raw.includes("français") || raw.includes("francais") || raw === "fr" || raw === "fr-fr") return { code: "fr-FR", label: "French" };
  if (raw.includes("spanish") || raw.includes("español") || raw.includes("espanol") || raw === "es" || raw === "es-es") return { code: "es-ES", label: "Spanish" };
  if (raw.includes("italian") || raw.includes("italiano") || raw === "it" || raw === "it-it") return { code: "it-IT", label: "Italian" };
  if (raw.includes("portuguese") || raw.includes("portugu") || raw === "pt" || raw === "pt-pt" || raw === "pt-br") return { code: "pt-PT", label: "Portuguese" };
  if (raw.includes("hindi") || raw.includes("हिन्दी") || raw.includes("हिंदी") || raw === "hi" || raw === "hi-in") return { code: "hi-IN", label: "Hindi" };
  if (raw.includes("chinese") || raw.includes("中文") || raw.includes("mandarin") || raw === "zh" || raw === "zh-cn") return { code: "zh-CN", label: "Chinese" };
  if (raw.includes("japanese") || raw.includes("日本") || raw === "ja" || raw === "ja-jp") return { code: "ja-JP", label: "Japanese" };
  if (raw.includes("korean") || raw.includes("한국") || raw === "ko" || raw === "ko-kr") return { code: "ko-KR", label: "Korean" };
  if (raw.includes("arabic") || raw.includes("العربية") || raw === "ar" || raw === "ar-sa") return { code: "ar-SA", label: "Arabic" };
  if (raw.includes("polish") || raw.includes("polski") || raw === "pl" || raw === "pl-pl") return { code: "pl-PL", label: "Polish" };
  if (raw.includes("russian") || raw.includes("русский") || raw === "ru" || raw === "ru-ru") return { code: "ru-RU", label: "Russian" };
  if (raw.includes("turkish") || raw.includes("türkçe") || raw === "tr" || raw === "tr-tr") return { code: "tr-TR", label: "Turkish" };
  return { code: "en-US", label: "English" };
}

function candidateAnswerCount(transcript?: TranscriptItem[]) {
  const candidateTurnCount = (transcript || []).filter((item) => {
    const role = String(item?.role || "").toLowerCase();
    return role === "candidate" || role === "user";
  }).length;
  return candidateTurnCount;
}

function isGreetingOrLanguageCheck(answer: string) {
  const lower = text(answer, 300).toLowerCase();
  return lower.split(/\s+/).filter(Boolean).length <= 12 && /\b(hello|hi|hey|how are you|can you hear me|do you hear me|namaste|नमस्ते|hallo|bonjour|hola|ciao|olá|ola)\b/i.test(lower);
}

function isConfusedOrNeedsRepeat(answer: string) {
  return /\b(i don'?t understand|not understand|repeat|again|confused|समझ नहीं|समझ नही|नहीं समझ|nicht verstanden|nochmal|répéter|no entiendo|non capisco)\b/i.test(answer);
}

function buildLocalizedIntroQuestion(languageValue: string | undefined, roleValue: string | undefined) {
  const language = normalizeInterviewLanguage(languageValue);
  const role = text(roleValue, 120) || "this role";
  switch (language.code) {
    case "de-DE": return `Schön. Ich habe mir deinen Lebenslauf und die Rolle ${role} angesehen. Zum Einstieg: Kannst du dich bitte kurz vorstellen und erklären, wie deine Erfahrung zu dieser Gelegenheit passt?`;
    case "nl-NL": return `Fijn. Ik heb je cv en de rol ${role} bekeken. Om te beginnen: kun je jezelf kort voorstellen en uitleggen hoe je ervaring aansluit op deze kans?`;
    case "fr-FR": return `Très bien. J’ai consulté votre CV et le poste ${role}. Pour commencer, pouvez-vous vous présenter brièvement et expliquer en quoi votre expérience correspond à cette opportunité ?`;
    case "es-ES": return `Perfecto. He revisado tu CV y el puesto de ${role}. Para empezar, ¿puedes presentarte brevemente y explicar cómo tu experiencia encaja con esta oportunidad?`;
    case "it-IT": return `Perfetto. Ho letto il tuo CV e il ruolo ${role}. Per iniziare, puoi presentarti brevemente e spiegare come la tua esperienza si collega a questa opportunità?`;
    case "pt-PT": return `Ótimo. Analisei o teu CV e a função ${role}. Para começar, podes apresentar-te brevemente e explicar como a tua experiência se relaciona com esta oportunidade?`;
    case "hi-IN": return `अच्छा। मैंने आपका CV और ${role} भूमिका देखी है। शुरुआत के लिए, कृपया अपना छोटा परिचय दें और बताएं कि आपका अनुभव इस अवसर से कैसे जुड़ता है।`;
    case "zh-CN": return `好的。我看过你的简历和${role}这个职位。请先简要介绍一下自己，并说明你的经验如何匹配这个机会。`;
    case "ja-JP": return `ありがとうございます。履歴書と${role}の職務内容を確認しました。まず、簡単に自己紹介をして、このポジションにご自身の経験がどうつながるか説明していただけますか？`;
    case "ko-KR": return `좋습니다. 이력서와 ${role} 역할을 검토했습니다. 먼저 간단히 자기소개를 해주시고, 본인의 경험이 이 기회와 어떻게 연결되는지 설명해 주세요.`;
    case "ar-SA": return `جيد. لقد راجعت سيرتك الذاتية ودور ${role}. لنبدأ: هل يمكنك تقديم نفسك باختصار وشرح كيف ترتبط خبرتك بهذه الفرصة؟`;
    case "pl-PL": return `Dobrze. Zapoznałem się z twoim CV i rolą ${role}. Na początek przedstaw się krótko i wyjaśnij, jak twoje doświadczenie pasuje do tej możliwości.`;
    case "ru-RU": return `Хорошо. Я посмотрел ваше резюме и роль ${role}. Для начала коротко представьтесь и объясните, как ваш опыт связан с этой возможностью.`;
    case "tr-TR": return `Güzel. Özgeçmişini ve ${role} rolünü inceledim. Başlamak için kendini kısaca tanıtıp deneyiminin bu fırsatla nasıl bağlantılı olduğunu açıklar mısın?`;
    default: return `Great. I had a chance to review your resume and the ${role} role. To get started, could you briefly introduce yourself and explain how your experience connects to this opportunity?`;
  }
}

function buildLocalizedGentleClarification(languageValue?: string) {
  const language = normalizeInterviewLanguage(languageValue);
  if (language.code === "hi-IN") return "कोई बात नहीं। थोड़ा समय लें। दो या तीन वाक्यों में अपना परिचय दें और इस भूमिका से जुड़ा एक अनुभव बताएं।";
  if (language.code === "de-DE") return "Kein Problem. Nimm dir kurz Zeit. Bitte stell dich in zwei bis drei Sätzen vor und nenne eine Erfahrung, die für diese Rolle relevant ist.";
  if (language.code === "fr-FR") return "Pas de problème. Prenez un instant. Présentez-vous en deux ou trois phrases et donnez une expérience pertinente pour ce poste.";
  return "No problem. Take a moment. Please introduce yourself in two or three sentences and mention one experience that is relevant to this role.";
}

function maybeBuildEarlyInterviewResponse(input: { answer: string; transcript?: TranscriptItem[]; language?: string; targetRole?: string }) {
  const count = candidateAnswerCount(input.transcript);
  if (count <= 1 || isGreetingOrLanguageCheck(input.answer)) return buildLocalizedIntroQuestion(input.language, input.targetRole);
  if (count <= 2 && isConfusedOrNeedsRepeat(input.answer)) return buildLocalizedGentleClarification(input.language);
  return "";
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
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    if (cleaned.split(/[,;|]/).length > 2) continue;
    if (/\b(?:data analyst|software engineer|technical support|product design|project manager|sales executive|customer success|candidate|recruiter|company|role|team|english|german|global|remote|hybrid|fluent|conversational|python|sql|tableau|excel|power bi|skills?|language|programming|machine learning|visualization|contact|summary|profile)\b/i.test(cleaned)) continue;
    const key = normalizeCompany(cleaned);
    if (!key || key.length < 2 || seen.has(key)) continue;
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
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    if (cleaned.split(/[,;|]/).length > 2) continue;
    if (/\b(?:candidate|recruiter|company|english|german|global|remote|hybrid|resume|cv|email|phone|linkedin|fluent|conversational|skills?|language|programming|python|sql|tableau|excel|power bi|machine learning|visualization|contact|summary|profile)\b/i.test(cleaned)) continue;
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

  // Trust explicit CV summary experience before summed ranges. Summing duplicated
  // PDF extraction, education, and projects can create impossible values.
  if (explicitYears > 0 && explicitYears <= 20) return explicitYears;

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
      if (start >= 1980 && end >= start && end <= currentYear + 1) {
        if (!ranges.some(([a, b]) => a === start && b === end)) ranges.push([start, end]);
      }
    }
  }

  const rangeYears = ranges.reduce((sum, [start, end]) => sum + Math.max(0.5, end - start), 0);
  const estimated = Math.min(rangeYears, 15);
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
  const primaryEvidence = factProfile.evidenceText || compactCv || "";
  const evidenceText = primaryEvidence;

  // Ground only against CV-derived facts. Do not let compact interview/JD
  // summaries leak target-role, language, or skill lines into verified facts.
  const verifiedCompanies = uniqueCompanies([
    ...(Array.isArray(factProfile.companies) ? factProfile.companies : []),
    ...extractCompanyLikeNames(primaryEvidence, 18),
  ], 24);

  const verifiedTitles = uniqueTitleFacts([
    ...(Array.isArray(factProfile.titles) ? factProfile.titles : []),
    ...extractTitleLikeNames(primaryEvidence, 18),
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
    .slice(-10)
    .map((item) => ({
      role: item.role,
      text: text(item.text, 220),
      time: item.time,
    }))
    .filter((item) => item.text);
}


function isAdmissionOfFalseClaim(answer: string) {
  const lower = (answer || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  return /\b(i\s+lied|i\s+just\s+lied|i\s+was\s+lying|i\s+made\s+that\s+up|i\s+made\s+it\s+up|that'?s\s+not\s+true|that\s+wasn'?t\s+true|it'?s\s+not\s+true|sorry\s+(?:that'?s|it'?s)\s+not\s+true|sorry\s+i\s+lied|i\s+exaggerated|i\s+was\s+exaggerating|i\s+gave\s+false\s+information|false\s+information|not\s+real|not\s+correct)\b/i.test(lower);
}

function buildAdmissionRedirectResponse({
  compactCv,
  claimValidation,
  trust,
}: {
  compactCv: string;
  claimValidation?: ClaimValidationResult;
  trust: number;
}) {
  const verifiedTitles = claimValidation?.verifiedTitles?.filter(Boolean).slice(0, 3) || [];
  const verifiedCompanies = claimValidation?.verifiedCompanies?.filter(Boolean).slice(0, 3) || [];
  const roleFallback = compactCv ? compactCv.slice(0, 180) : "the experience visible in your resume";
  const roleLine = verifiedTitles.length ? verifiedTitles.join(", ") : roleFallback;
  const companyLine = verifiedCompanies.length ? ` at ${verifiedCompanies.join(", ")}` : "";
  const reply = `Thank you for being honest. Recruiters care a lot about consistency between what you say and what is visible on your resume. Let’s reset and work only with the verified experience I can see: ${roleLine}${companyLine}. Tell me about one real customer or stakeholder situation from that experience, what you personally did, and what changed after your support.`
    .replace(/\s+/g, " ")
    .trim();
  const nextTrust = Math.max(20, Math.min(90, trust - 10));

  return NextResponse.json({
    question: reply,
    displayQuestion: reply,
    feedback: "Candidate admitted an unsupported claim. Recruiter acknowledged honesty, lowered trust slightly, and redirected to verified CV experience.",
    intent: "admitted_false_claim",
    shouldAdvanceQuestion: false,
    shouldCountAsAnswer: false,
    shouldStayOnCurrentQuestion: true,
    trustDelta: -10,
    recruiterState: "skeptical",
    correction: reply,
    concern: "Candidate admitted that a prior experience claim was not true. Recruiter should stay cautious and ask for verified examples.",
    psychology: {
      trust: nextTrust,
      interest: 50,
      skepticism: 78,
      patience: 58,
      engagement: 60,
      confidenceInCandidate: 34,
    },
    recruiterMemory: {
      summary: "Candidate admitted an unsupported claim. Stay cautious and require verified CV-grounded examples.",
      weakMoments: ["Admitted unsupported or exaggerated experience claim."],
      strongMoments: ["Was honest after clarification."],
      openDoubts: ["Needs to rebuild trust with verified resume examples."],
      roleFitSignals: [],
    },
    memoryEvents: [
      {
        type: "admitted_false_claim",
        severity: "high",
        detail: "Candidate admitted a previous claim was false or exaggerated.",
      },
    ],
    pressure: {
      level: 72,
      label: "trust reset",
      reason: "Candidate admitted a false or exaggerated claim.",
      behaviorShift: "Recruiter acknowledges honesty, becomes cautious, and redirects to verified resume experience.",
    },
    honestFeedback: {
      headline: "Trust reset",
      recruiterRead: "The candidate admitted an unsupported claim. A real recruiter would appreciate the honesty but become more cautious.",
      risk: "False or exaggerated claims can reduce recruiter confidence quickly.",
      nextFix: "Return to concrete, verified examples from the CV and describe personal contribution clearly.",
    },
    scores: {
      relevance: 25,
      clarity: 45,
      structure: 35,
      evidence: 15,
      confidence: 28,
      pressure: 72,
      overall: nextTrust,
    },
    liveUiState: {
      label: "Recruiter is resetting trust",
      theme: "skeptical",
      pressure: {
        level: 72,
        label: "trust reset",
        reason: "Candidate admitted a false or exaggerated claim.",
        behaviorShift: "Recruiter redirects to verified CV evidence.",
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
        delta: -10,
        reason: "Candidate admitted an unsupported or exaggerated claim.",
      },
    ],
  });
}

// Rate limiting moved to lib/workzoRateLimit.ts (database-backed). An
// in-memory Map here does not work correctly on Vercel serverless — each
// cold start gets its own empty Map, so multiple instances could each
// independently allow up to the limit, multiplying actual throughput well
// past the intended cap. The replacement keys by user ID, set at the call
// site below once auth has resolved.

// FREE_INTERVIEW_LIMIT: 2 interviews per account, lifetime (tied to user_id).
// Resets only if the user deletes their account. Never resets on a new month.
// Enforced server-side by counting rows in interview_sessions for this user_id.
// Client-side localStorage tracking is kept for UI feedback only.
const FREE_INTERVIEW_LIMIT = 2;

/**
 * Count how many interview sessions this user has started (all time for free,
 * current month for paid plans where limits reset monthly).
 * Uses the service role client so it works regardless of cookie auth state.
 */
async function getServerSideInterviewCount(userId: string, monthOnly: boolean): Promise<number> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let query = supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (monthOnly) {
    // Count only sessions started in the current calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte("created_at", monthStart);
  }

  const { count, error } = await query;
  if (error) {
    console.warn("[interview] Could not read session count from DB:", error.message);
    return 0; // fail open — don't block user if DB is unavailable
  }
  return count ?? 0;
}

export async function POST(request: Request) {
  try {
    // ── Auth + plan resolution (always server-side) ───────────────────────────
    // We no longer fall back to a cookie-parsed plan for interview gating.
    // The cookie fallback in workzoServerPlan.ts handles the UX case of a
    // missed webhook — but for rate/limit enforcement we need the DB plan.
    let resolved;
    try {
      resolved = await resolveWorkZoServerPlan();
    } catch {
      return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
    }

    if (!resolved.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = resolved.plan;
    const paid = plan === "premium" || plan === "premium_pro";
    const userId = resolved.userId!;
    const rateLimitKey = `interview:${userId}`;

    // ── Per-minute rate limiter (database-backed, protects API cost per burst) ──
    // Free: 20 req/min  |  Paid: 60 req/min
    const { allowed: withinRateLimit } = await checkWorkZoRateLimit(rateLimitKey, paid ? 60 : 20);
    if (!withinRateLimit) {
      return NextResponse.json(
        { error: paid ? "Rate limit reached." : "upgrade_required_rate_limit" },
        { status: 429 },
      );
    }

    // ── Server-side interview count enforcement ───────────────────────────────
    // Free users: lifetime cap of 2 (spec: "2 AI interviews total").
    // Premium users: 50/month cap.
    // Premium Pro: unlimited.
    if (plan === "free") {
      const used = await getServerSideInterviewCount(userId, false /* all-time */);
      if (used >= FREE_INTERVIEW_LIMIT) {
        return NextResponse.json(
          {
            error: "interview_limit_reached",
            plan: "free",
            used,
            limit: FREE_INTERVIEW_LIMIT,
            message: `Free plan includes ${FREE_INTERVIEW_LIMIT} interviews. Upgrade to continue practising.`,
            requiredPlan: "premium",
          },
          { status: 403 },
        );
      }
    } else if (plan === "premium") {
      const used = await getServerSideInterviewCount(userId, true /* this month */);
      const PREMIUM_MONTHLY_LIMIT = 50;
      if (used >= PREMIUM_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            error: "interview_limit_reached",
            plan: "premium",
            used,
            limit: PREMIUM_MONTHLY_LIMIT,
            message: `You have used all ${PREMIUM_MONTHLY_LIMIT} interviews this month. Upgrade to Premium Pro for unlimited access.`,
            requiredPlan: "premium_pro",
          },
          { status: 403 },
        );
      }
    }
    // premium_pro: no interview count check — unlimited
    // ─────────────────────────────────────────────────────────────────────────

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
      720,
    );
    const compactJob = compactInterviewContext(
      setup.jobProfileSummary || body.jobDescription || setup.jobDescription,
      650,
    );

    // currentQuestion should be the actual last recruiter question from the live
    // transcript (sent by the client). Fall back to body.currentQuestion for
    // backward compatibility with older clients.
    const resolvedCurrentQuestion = text(
      (Array.isArray(body.transcript) && body.transcript.length > 0
        ? [...body.transcript].reverse().find((t) => t.role === "recruiter")?.text
        : undefined) || body.currentQuestion,
      360,
    );

    const earlyInterviewResponse = maybeBuildEarlyInterviewResponse({
      answer,
      transcript: body.transcript,
      language: setup.language,
      targetRole: body.targetRole || setup.targetRole,
    });

    if (earlyInterviewResponse) {
      return NextResponse.json({
        question: earlyInterviewResponse,
        displayQuestion: earlyInterviewResponse,
        feedback: "Natural opening flow. Recruiter is building rapport before moving into evaluation.",
        intent: "opening_flow",
        shouldAdvanceQuestion: true,
        shouldCountAsAnswer: false,
        shouldStayOnCurrentQuestion: false,
        trustDelta: 0,
        recruiterState: "interested",
        correction: "",
        concern: "",
        psychology: {
          trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
          interest: 64,
          skepticism: 18,
          patience: 80,
          engagement: 68,
          confidenceInCandidate: 58,
        },
        cvRead: null,
        recruiterMemory: null,
        scores: { relevance: 0, clarity: 0, structure: 0, evidence: 0, confidence: 58, pressure: 20, overall: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58 },
        liveUiState: {
          label: "Opening conversation",
          theme: "interested",
          pressure: null,
          honestFeedback: null,
          recruiterMemoryInsight: null,
          livePressureSimulation: null,
          marketExpectation: null,
          humanImperfection: null,
          socialSignals: null,
          cinematicRealism: null,
        },
        trustTimeline: [{ type: "steady", delta: 0, reason: "Opening flow." }],
      });
    }

    const intelligence95 = buildInterviewIntelligence95({
      answer,
      currentQuestion: resolvedCurrentQuestion,
      transcript: compactTranscript(body.transcript),
      cvText: cvGroundingEvidence || compactCv,
      jobDescription: compactJob,
      targetRole: text(body.targetRole || setup.targetRole, 120),
      companyName: text((setup as any).companyName || (body as any).companyName, 120),
      companyStyle: text(body.companyStyle || setup.companyStyle, 120),
      recruiterPersonality: text(body.recruiterPersonality || setup.recruiterPersonality, 80),
      currentTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      currentState: body.recruiterState || null,
    });

    const companyDecoratedJob = decorateJobContextWithCompanyDNA(compactJob, intelligence95.companyDNA);

    const claimValidation = validateCandidateCompanyClaim({
      answer,
      setup,
      compactCv: cvGroundingEvidence || compactCv,
    });

    if (isAdmissionOfFalseClaim(answer)) {
      return buildAdmissionRedirectResponse({
        compactCv: cvGroundingEvidence || compactCv,
        claimValidation,
        trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      });
    }

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

    // ── Recruiter Brain: pre-compute all missing intelligence features ──────
    // JD coverage, competency tracker, interview strategy, hiring recommendation,
    // emotional state, adaptive difficulty, company style, and memory timeline.
    // The brain context is serialized and injected into the LLM system prompt.
    const recruiterBrain = buildRecruiterBrain({
      cvText: cvGroundingEvidence || compactCv,
      jobDescription: companyDecoratedJob,
      targetRole: text(body.targetRole || setup.targetRole, 120),
      companyStyle: text(body.companyStyle || setup.companyStyle, 120),
      transcript: body.transcript || [],
      trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      recruiterState: body.recruiterState || "neutral",
      lastAnswerScore: null, // updated by scoring engine each turn
    });
    const recruiterBrainContext = serializeRecruiterBrainForPrompt(recruiterBrain);
    // ───────────────────────────────────────────────────────────────────────

    // Generate role intelligence brief for ANY role — not just hardcoded ones.
    // This gives the recruiter genuine domain knowledge about the target role,
    // tailored to the specific JD and company context if provided.
    let roleBriefContext = "";
    try {
      const roleBrief = await getRoleIntelligenceBrief({
        role: text(body.targetRole || setup.targetRole, 120),
        jobDescription: companyDecoratedJob.slice(0, 3000),
        companyContext: text(body.companyDescription || setup.companyDescription || body.targetCompany || setup.companyName, 600),
        market: text(body.targetMarket || setup.targetMarket, 80),
      });
      roleBriefContext = serializeRoleBriefForPrompt(roleBrief);
    } catch (e) {
      console.warn("[interview/route] Role brief generation failed:", e);
    }

    const baseDecision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: resolvedCurrentQuestion,
      transcript: compactTranscript(body.transcript),
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      recruiterState: body.recruiterState || null,
      setup: {
        cvText: compactCv,
        jobDescription: companyDecoratedJob,
        targetRole: text(body.targetRole || setup.targetRole, 120),
        targetMarket: text(body.targetMarket || setup.targetMarket, 80),
        companyStyle: text(body.companyStyle || setup.companyStyle, 120),
        recruiterPersonality: text(body.recruiterPersonality || setup.recruiterPersonality, 80),
        language: text(setup.language, 40),
        recruiterMemoryProfile: body.recruiterMemorySummary
          ? { summary: text(body.recruiterMemorySummary, 280) }
          : undefined,
        jobMemoryProfile: undefined,
        recruiterBrainContext,
        // Universal role intelligence — generated for any role, any industry
        roleBriefContext,
      },
    });

    const enhancedDecision = enhanceWorkZoDecisionV2({
      decision: baseDecision,
      answer,
      currentQuestion: resolvedCurrentQuestion,
      transcript: compactTranscript(body.transcript),
      currentTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      setup: {
        cvText: compactCv,
        jobDescription: companyDecoratedJob,
        targetRole: text(body.targetRole || setup.targetRole, 120),
        targetMarket: text(body.targetMarket || setup.targetMarket, 80),
        companyStyle: text(body.companyStyle || setup.companyStyle, 120),
        recruiterPersonality: text(body.recruiterPersonality || setup.recruiterPersonality, 80),
        language: text(setup.language, 40),
        recruiterBrainContext,
      },
    });

    const decision = applyInterviewIntelligence95ToDecision(enhancedDecision, intelligence95);

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
      workzoIntelligenceV2: decision.workzoIntelligenceV2 || null,
      workzoInterviewIntelligence95: decision.workzoInterviewIntelligence95 || null,
      companyDNA: decision.companyDNA || null,
      deterministicScore: decision.deterministicScore || null,
      contradictionChallenge: decision.contradictionChallenge || null,
      latencyCue: decision.latencyCue || null,
      whatRecruiterHeard: decision.whatRecruiterHeard || null,
      benchmark: decision.benchmark || null,
      answerRewrites: decision.answerRewrites || [],
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
        relevance: decision.deterministicScore?.relevance ?? (decision.shouldCountAsAnswer ? Math.max(40, Math.min(92, decision.psychology.interest)) : 0),
        clarity: decision.deterministicScore?.clarity ?? (decision.intent === "interview_answer" ? Math.max(38, Math.min(90, decision.psychology.engagement)) : 0),
        structure: decision.deterministicScore?.structure ?? (decision.intent === "interview_answer" ? Math.max(34, Math.min(88, decision.psychology.patience)) : 0),
        evidence: decision.deterministicScore?.evidence ?? (
          decision.intent === "possible_exaggeration" || decision.intent === "contradiction" || decision.intent === "nonsense"
            ? 22
            : decision.shouldCountAsAnswer
              ? Math.max(42, Math.min(90, decision.psychology.confidenceInCandidate))
              : 0),
        confidence: decision.deterministicScore?.confidence ?? decision.psychology.confidenceInCandidate,
        ownership: decision.deterministicScore?.ownership ?? null,
        roleFit: decision.deterministicScore?.roleFit ?? null,
        companyFit: decision.deterministicScore?.companyFit ?? null,
        pressure: decision.pressure?.level ?? 45,
        overall: decision.deterministicScore?.overall ?? decision.psychology.trust,
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
          reason: decision.workzoIntelligenceV2?.trust?.reason || decision.pressure?.reason || decision.feedback,
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
