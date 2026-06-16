"use client";

export type WorkZoInterviewLanguage =
  | "English"
  | "German"
  | "French"
  | "Dutch"
  | "Spanish"
  | "Italian"
  | "Portuguese"
  | "Hindi"
  | "Tamil"
  | "Chinese"
  | "Japanese"
  | "Korean"
  | "Arabic"
  | "Polish"
  | "Russian"
  | "Turkish"
  | "Other";

export type LanguageRequirementStrength =
  | "none"
  | "preferred"
  | "required"
  | "fluent"
  | "native";

export type DetectedLanguageRequirement = {
  language: WorkZoInterviewLanguage;
  strength: LanguageRequirementStrength;
  evidence: string;
};

export type LanguageInterviewDecision = {
  shouldAskToSwitch: boolean;
  suggestedLanguage: WorkZoInterviewLanguage;
  requirementStrength: LanguageRequirementStrength;
  recruiterPrompt: string;
  candidateChoicePrompt: string;
  interviewInstruction: string;
  evidence: string;
};

const LANGUAGE_PATTERNS: Array<{
  language: WorkZoInterviewLanguage;
  patterns: RegExp[];
}> = [
  {
    language: "German",
    patterns: [
      /\b(german|deutsch|deutsche|deutscher|deutschkenntnisse|german-speaking|german speaking)\b/i,
      /\b(c1|c2|b2)\s+(german|deutsch)\b/i,
      /\b(german language|deutsche sprache)\b/i,
    ],
  },
  {
    language: "French",
    patterns: [
      /\b(french|français|francais|french-speaking|french speaking)\b/i,
      /\b(c1|c2|b2)\s+french\b/i,
      /\bfrench language\b/i,
    ],
  },
  {
    language: "Dutch",
    patterns: [
      /\b(dutch|nederlands|dutch-speaking|dutch speaking)\b/i,
      /\b(c1|c2|b2)\s+dutch\b/i,
      /\bdutch language\b/i,
    ],
  },
  {
    language: "Spanish",
    patterns: [
      /\b(spanish|español|espanol|spanish-speaking|spanish speaking)\b/i,
      /\b(c1|c2|b2)\s+spanish\b/i,
    ],
  },
  {
    language: "Italian",
    patterns: [
      /\b(italian|italiano|italian-speaking|italian speaking)\b/i,
      /\b(c1|c2|b2)\s+italian\b/i,
    ],
  },
  {
    language: "Portuguese",
    patterns: [
      /\b(portuguese|português|portugues|portuguese-speaking|portuguese speaking)\b/i,
      /\b(c1|c2|b2)\s+portuguese\b/i,
    ],
  },

  {
    language: "Chinese",
    patterns: [/\b(chinese|mandarin|中文|普通话|chinese-speaking|mandarin speaking)\b/i, /\b(c1|c2|b2)\s+chinese\b/i],
  },
  {
    language: "Japanese",
    patterns: [/\b(japanese|日本語|japanese-speaking|japanese speaking)\b/i, /\b(c1|c2|b2)\s+japanese\b/i],
  },
  {
    language: "Korean",
    patterns: [/\b(korean|한국어|korean-speaking|korean speaking)\b/i, /\b(c1|c2|b2)\s+korean\b/i],
  },
  {
    language: "Arabic",
    patterns: [/\b(arabic|العربية|arabic-speaking|arabic speaking)\b/i, /\b(c1|c2|b2)\s+arabic\b/i],
  },
  {
    language: "Polish",
    patterns: [/\b(polish|polski|polish-speaking|polish speaking)\b/i, /\b(c1|c2|b2)\s+polish\b/i],
  },
  {
    language: "Russian",
    patterns: [/\b(russian|русский|russian-speaking|russian speaking)\b/i, /\b(c1|c2|b2)\s+russian\b/i],
  },
  {
    language: "Turkish",
    patterns: [/\b(turkish|türkçe|turkish-speaking|turkish speaking)\b/i, /\b(c1|c2|b2)\s+turkish\b/i],
  },
  {
    language: "Hindi",
    patterns: [/\b(hindi|हिन्दी|हिंदी)\b/i],
  },
  {
    language: "Tamil",
    patterns: [/\b(tamil|தமிழ்)\b/i],
  },
];

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getNearbyEvidence(text: string, matchIndex: number, radius = 90) {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius);
  return cleanText(text.slice(start, end));
}

function detectStrength(evidence: string): LanguageRequirementStrength {
  const lower = evidence.toLowerCase();

  if (/\b(native|mother tongue|mothertongue|near-native|near native)\b/i.test(lower)) {
    return "native";
  }

  if (/\b(fluent|fluency|business fluent|professional fluency|c1|c2)\b/i.test(lower)) {
    return "fluent";
  }

  if (/\b(required|must have|mandatory|essential|need to have|needs to|requirement|excellent|strong command)\b/i.test(lower)) {
    return "required";
  }

  if (/\b(preferred|nice to have|plus|advantage|bonus|beneficial|desirable)\b/i.test(lower)) {
    return "preferred";
  }

  return "preferred";
}

function strengthRank(strength: LanguageRequirementStrength) {
  switch (strength) {
    case "native":
      return 5;
    case "fluent":
      return 4;
    case "required":
      return 3;
    case "preferred":
      return 2;
    default:
      return 1;
  }
}

export function detectLanguageRequirements(
  jobDescription: string,
): DetectedLanguageRequirement[] {
  const text = cleanText(jobDescription || "");
  if (!text) return [];

  const results: DetectedLanguageRequirement[] = [];

  for (const item of LANGUAGE_PATTERNS) {
    for (const pattern of item.patterns) {
      const match = pattern.exec(text);
      if (!match || typeof match.index !== "number") continue;

      const evidence = getNearbyEvidence(text, match.index);
      const strength = detectStrength(evidence);

      results.push({
        language: item.language,
        strength,
        evidence,
      });

      break;
    }
  }

  const deduped = new Map<WorkZoInterviewLanguage, DetectedLanguageRequirement>();

  for (const result of results) {
    const existing = deduped.get(result.language);
    if (!existing || strengthRank(result.strength) > strengthRank(existing.strength)) {
      deduped.set(result.language, result);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => strengthRank(b.strength) - strengthRank(a.strength),
  );
}

export function getPrimaryInterviewLanguageRequirement(
  jobDescription: string,
): DetectedLanguageRequirement | null {
  const requirements = detectLanguageRequirements(jobDescription);
  return requirements[0] || null;
}

export function buildLanguageInterviewDecision({
  jobDescription,
  selectedLanguage = "English",
  candidateConfirmedLanguage,
}: {
  jobDescription: string;
  selectedLanguage?: WorkZoInterviewLanguage | string;
  candidateConfirmedLanguage?: WorkZoInterviewLanguage | string | null;
}): LanguageInterviewDecision {
  const primary = getPrimaryInterviewLanguageRequirement(jobDescription);

  if (!primary) {
    return {
      shouldAskToSwitch: false,
      suggestedLanguage: normalizeLanguage(selectedLanguage),
      requirementStrength: "none",
      recruiterPrompt: "",
      candidateChoicePrompt: "",
      interviewInstruction:
        "Continue the interview in the candidate-selected language. Do not switch languages unless the candidate asks.",
      evidence: "",
    };
  }

  const selected = normalizeLanguage(selectedLanguage);
  const confirmed = candidateConfirmedLanguage
    ? normalizeLanguage(candidateConfirmedLanguage)
    : null;

  const shouldAskToSwitch =
    primary.language !== selected &&
    !confirmed &&
    ["required", "fluent", "native"].includes(primary.strength);

  const suggestedLanguage = confirmed || primary.language;

  return {
    shouldAskToSwitch,
    suggestedLanguage,
    requirementStrength: primary.strength,
    evidence: primary.evidence,
    recruiterPrompt: buildRecruiterLanguagePrompt(primary),
    candidateChoicePrompt: buildCandidateChoicePrompt(primary),
    interviewInstruction: buildInterviewLanguageInstruction({
      detected: primary,
      selectedLanguage: selected,
      confirmedLanguage: confirmed,
    }),
  };
}

export function normalizeLanguage(value: unknown): WorkZoInterviewLanguage {
  if (typeof value !== "string") return "English";

  const raw = value.trim().toLowerCase();

  if (/german|deutsch/.test(raw)) return "German";
  if (/french|français|francais/.test(raw)) return "French";
  if (/dutch|nederlands/.test(raw)) return "Dutch";
  if (/spanish|español|espanol/.test(raw)) return "Spanish";
  if (/italian|italiano/.test(raw)) return "Italian";
  if (/portuguese|português|portugues/.test(raw)) return "Portuguese";
  if (/hindi|हिन्दी|हिंदी/.test(raw)) return "Hindi";
  if (/tamil|தமிழ்/.test(raw)) return "Tamil";
  if (/english|en/.test(raw)) return "English";

  return "Other";
}

function buildRecruiterLanguagePrompt(requirement: DetectedLanguageRequirement) {
  const language = requirement.language;

  if (requirement.strength === "native") {
    return `This role expects near-native ${language}. The recruiter should verify communication ability naturally, but first ask the candidate whether they want to continue in ${language}.`;
  }

  if (requirement.strength === "fluent") {
    return `This role mentions fluent ${language}. The recruiter should ask whether the candidate wants to continue part or all of the interview in ${language}.`;
  }

  if (requirement.strength === "required") {
    return `This role requires ${language}. The recruiter should offer to switch into ${language} and evaluate communication fit naturally.`;
  }

  return `This role mentions ${language} as useful. The recruiter may ask one light language-fit question, but should not force the full interview into ${language}.`;
}

function buildCandidateChoicePrompt(requirement: DetectedLanguageRequirement) {
  const language = requirement.language;

  if (requirement.strength === "preferred") {
    return `${language} appears useful for this role. Would you like to practice one answer in ${language}, or continue in English?`;
  }

  return `This role appears to require ${language}. Would you like to continue the interview in ${language}, or practice mainly in English with a short ${language} check?`;
}

function buildInterviewLanguageInstruction({
  detected,
  selectedLanguage,
  confirmedLanguage,
}: {
  detected: DetectedLanguageRequirement;
  selectedLanguage: WorkZoInterviewLanguage;
  confirmedLanguage: WorkZoInterviewLanguage | null;
}) {
  if (confirmedLanguage) {
    return `The candidate confirmed ${confirmedLanguage}. Conduct the interview in ${confirmedLanguage}. If the candidate struggles, gracefully allow a switch back to English.`;
  }

  if (
    detected.language !== selectedLanguage &&
    ["required", "fluent", "native"].includes(detected.strength)
  ) {
    return `Do not force-switch immediately. First say: "${buildCandidateChoicePrompt(
      detected,
    )}" If the candidate agrees, continue in ${detected.language}. If not, continue in English but include one realistic language-fit question later.`;
  }

  if (detected.strength === "preferred") {
    return `Continue in ${selectedLanguage}. Since ${detected.language} is preferred, optionally ask one light question about comfort using ${detected.language} at work.`;
  }

  return `Continue in ${selectedLanguage}.`;
}

export function buildLanguageFitQuestion(language: WorkZoInterviewLanguage) {
  if (language === "German") {
    return "Können Sie kurz auf Deutsch erklären, wie Sie mit einem schwierigen Kunden umgehen würden?";
  }

  if (language === "French") {
    return "Pouvez-vous expliquer brièvement en français comment vous géreriez un client difficile ?";
  }

  if (language === "Dutch") {
    return "Kunt u kort in het Nederlands uitleggen hoe u met een moeilijke klant zou omgaan?";
  }

  if (language === "Spanish") {
    return "¿Puede explicar brevemente en español cómo manejaría a un cliente difícil?";
  }

  if (language === "Italian") {
    return "Può spiegare brevemente in italiano come gestirebbe un cliente difficile?";
  }

  if (language === "Portuguese") {
    return "Pode explicar brevemente em português como lidaria com um cliente difícil?";
  }

  return `Can you briefly explain how you would handle a difficult customer in ${language}?`;
}

export function shouldReactToBackgroundNoiseNow() {
  // Intentionally disabled for the current phase.
  // Ambient cough/sneeze/background-noise reactions require reliable audio-event
  // detection and can create false positives. Add this only after runtime is stable.
  return false;
}
