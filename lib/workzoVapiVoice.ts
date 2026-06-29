import { getOpenAiTtsInstructions } from "@/lib/workzoVoiceHumanizer";
import {
  resolveRecruiterVoiceKey,
  recruiterVoiceProfiles,
} from "@/lib/recruiterVoiceConfig";
import { selectRoleKnowledgeBlock } from "@/lib/workzoRoleKnowledge";

export type WorkZoVapiTranscriptMessage = {
  role: "assistant" | "user" | "system" | string;
  text: string;
  isFinal: boolean;
};

export type WorkZoVapiClient = {
  start: (...args: any[]) => Promise<unknown> | unknown;
  stop: () => void;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
  removeAllListeners?: () => void;
  // Vapi Web SDK supports injecting a message into the live call (e.g.
  // { type: "add-message", message: { role: "system", content: "..." } }).
  // Used to push real-time fact-check signals (e.g. an unsupported claim
  // just detected from the candidate's last answer) so the assistant's
  // next reply can react to it immediately, without waiting for it to
  // notice on its own.
  send?: (payload: Record<string, unknown>) => void;
};

export type WorkZoRecruiterId =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter"
  | string;

export type WorkZoVapiConfig = {
  publicKey: string;
  assistantId: string;
  enabled: boolean;
  recruiterKey: string;
};

export function getWorkZoVapiRecruiterKey(
  recruiterId?: WorkZoRecruiterId,
  recruiterName?: string,
) {
  const raw = `${recruiterId || ""} ${recruiterName || ""}`.toLowerCase();
  if (
    raw.includes("friendly_hr") ||
    raw.includes("sarah") ||
    raw.includes("friendly")
  )
    return "sarah" as const;
  if (
    raw.includes("analytical_hiring_manager") ||
    raw.includes("daniel") ||
    raw.includes("analytical") ||
    raw.includes("hiring")
  )
    return "daniel" as const;
  if (
    raw.includes("startup_recruiter") ||
    raw.includes("priya") ||
    raw.includes("startup_recruiter")
  )
    return "priya" as const;
  if (
    raw.includes("german_corporate") ||
    raw.includes("corporate_recruiter") ||
    raw.includes("markus") ||
    raw.includes("corporate")
  )
    return "markus" as const;

  // Pro personas — map to closest standard voice persona
  // FAANG/technical → Daniel (evidence-driven, analytical)
  if (raw.includes("faang") || raw.includes("alex")) return "daniel" as const;
  // Startup founder → Priya (fast-paced, ownership-focused)
  if (
    raw.includes("startup_founder") ||
    raw.includes("zoe") ||
    raw.includes("founder")
  )
    return "priya" as const;
  // Consulting partner → Markus (structured, process-oriented)
  if (
    raw.includes("consulting_partner") ||
    raw.includes("harrington") ||
    raw.includes("consulting")
  )
    return "markus" as const;
  // Sales director → Daniel (numbers-first, direct)
  if (
    raw.includes("sales_director") ||
    raw.includes("marcus webb") ||
    raw.includes("sales")
  )
    return "daniel" as const;
  // Product leader → Priya (practical, user-focused)
  if (raw.includes("product_leader") || raw.includes("aisha"))
    return "priya" as const;
  // Executive recruiter → Markus (formal, structured)
  if (
    raw.includes("executive_recruiter") ||
    raw.includes("victoria") ||
    raw.includes("stern")
  )
    return "markus" as const;
  // Enterprise recruiter → Daniel (process-driven)
  if (raw.includes("enterprise_recruiter") || raw.includes("kimura"))
    return "daniel" as const;

  return "sarah" as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildWorkZoVapiAssistantOverrides
//
// ROOT CAUSE FIX (global, not CV-specific):
//
// variableValues only work when the Vapi dashboard assistant prompt has matching
// {{placeholder}} tokens. If the dashboard prompt template doesn't reference
// {{cvSummary}} or {{interviewStyle}}, all CV context is silently dropped — the
// LLM never sees the candidate's employers, roles, or any CV facts.
//
// This function sends the FULL system prompt as `model.messages` in the
// assistantOverrides, bypassing the dashboard template entirely. The LLM
// receives a complete, self-contained system prompt with:
//   1. Recruiter persona and behavioral instructions
//   2. Explicit numbered employer/education list (survives newline compaction)
//   3. Full verified CV context
//   4. Hard rules against challenging verified employers
//
// This is called in addition to variableValues (not instead of), so the
// dashboard template still works as a fallback if overrides are rejected.
// ─────────────────────────────────────────────────────────────────────────────
export function buildWorkZoVapiAssistantOverrides(input: {
  variableValues: Record<string, unknown>;
  resumeProfile?: unknown;
  cvText?: string;
  jobDescription?: string;
  recruiterPersonality?: string;
  recruiterName?: string;
  recruiterRole?: string;
  candidateName?: string;
  targetRole?: string;
  language?: string;
  languageLabel?: string;
}): Record<string, unknown> {
  const verifiedCvJdBlock = buildVerifiedCvJdBlock(
    input.cvText,
    input.jobDescription,
    input.resumeProfile,
  );

  // The interviewStyle string from variableValues already contains the full
  // behavioral instructions. Re-use it to keep the override consistent.
  const interviewStyle = String(input.variableValues.interviewStyle || "");
  const languageLabel = input.languageLabel || "English";

  const systemPrompt = [
    `You are ${input.recruiterName || "Sarah"}, a ${input.recruiterRole || "recruiter"} conducting a job interview.`,
    `The candidate's name is ${input.candidateName || "the candidate"}.`,
    `The role being discussed is: ${input.targetRole || "the target role"}.`,
    languageLabel !== "English"
      ? `CRITICAL: Conduct this entire interview in ${languageLabel}. Every message must be in ${languageLabel}.`
      : "",
    "",
    "═══════════════════════════════════════════════",
    "VERIFIED CV DATA — READ THIS BEFORE RESPONDING",
    "═══════════════════════════════════════════════",
    verifiedCvJdBlock,
    "═══════════════════════════════════════════════",
    "",
    "ABSOLUTE RULE: The employers, roles, dates, education, skills, and projects listed",
    "above are verified facts from the candidate's uploaded CV. You have already read",
    "and confirmed this CV. NEVER say 'I do not see', 'I cannot verify', 'not listed',",
    "'not reflected in your CV', or anything that challenges a verified fact.",
    "If the candidate mentions any employer or role from the list above, acknowledge it",
    "and ask a positive follow-up about responsibilities, scope, achievements, or outcomes.",
    "",
    interviewStyle,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();

  return {
    model: {
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
      ],
    },
  };
}


export function getWorkZoVapiAssistantId(
  recruiterId?: WorkZoRecruiterId,
  recruiterName?: string,
) {
  const key = resolveRecruiterVoiceKey(recruiterId, recruiterName);
  // BUG FIXED: this used to do `RECRUITER_VOICE_TABLE[key].vapiEnv` (a string
  // like "NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID") and then
  // `process.env[envVar]` — dynamic bracket access using a runtime variable.
  // Next.js only inlines NEXT_PUBLIC_* env vars when it sees the literal,
  // static `process.env.NEXT_PUBLIC_XXX` text in source at build time;
  // dynamic access like this is invisible to that step and always resolves
  // to undefined client-side, regardless of what's actually configured in
  // the hosting environment. Confirmed from live testing — the assistant ID
  // never resolved no matter what was set or how many times it was
  // rebuilt. recruiterVoiceProfiles already does this correctly with a
  // literal `process.env.NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID` per entry —
  // reusing that instead of the broken dynamic lookup.
  const assistantId = (recruiterVoiceProfiles[key]?.assistantId || "").trim();
  return { key, assistantId };
}

export function getWorkZoVapiConfig(
  recruiterId?: WorkZoRecruiterId,
  recruiterName?: string,
): WorkZoVapiConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
  const provider = (
    process.env.NEXT_PUBLIC_WORKZO_VOICE_PROVIDER || ""
  ).toLowerCase();
  const { key, assistantId } = getWorkZoVapiAssistantId(
    recruiterId,
    recruiterName,
  );

  return {
    publicKey,
    assistantId,
    recruiterKey: key,
    enabled: Boolean(
      publicKey && assistantId && provider !== "tts" && provider !== "browser",
    ),
  };
}

export async function createWorkZoVapiClient(
  publicKey: string,
): Promise<WorkZoVapiClient> {
  // Lazy-load the AI voice SDK only after the user taps Start/Mic.
  // A static top-level import can cause the SDK/Daily layer to warm device APIs
  // during the heavy /interview page load, which leads to repeated
  // enumerateDevices delays before the user even starts voice.
  const mod = await import("@vapi-ai/web");
  const VapiConstructor = (mod.default || mod) as unknown as new (
    key: string,
  ) => WorkZoVapiClient;
  return new VapiConstructor(publicKey);
}

export function normalizeVapiTranscriptMessage(
  message: any,
): WorkZoVapiTranscriptMessage | null {
  if (!message || typeof message !== "object") return null;

  const type = String(message.type || message.messageType || "").toLowerCase();
  const transcript =
    typeof message.transcript === "string"
      ? message.transcript
      : typeof message.text === "string"
        ? message.text
        : typeof message.content === "string"
          ? message.content
          : "";

  if (!transcript.trim()) return null;

  const role = String(
    message.role || message.speaker || message.from || "assistant",
  ).toLowerCase();
  const transcriptType = String(
    message.transcriptType || message.status || "final",
  ).toLowerCase();

  const looksLikeTranscript =
    type.includes("transcript") ||
    type.includes("conversation") ||
    Boolean(message.transcript) ||
    Boolean(message.text);

  if (!looksLikeTranscript) return null;

  return {
    role: role.includes("user")
      ? "user"
      : role.includes("assistant")
        ? "assistant"
        : role,
    text: transcript.replace(/\s+/g, " ").trim(),
    isFinal: transcriptType !== "partial" && transcriptType !== "interim",
  };
}

function compactContextText(value?: string, max = 7000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function extractContextLines(value?: string, maxLines = 24) {
  const text = String(value || "").replace(/\r/g, "\n");
  return text
    .split(/\n|(?<=[.;])\s+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .slice(0, maxLines);
}

function extractLikelyCompaniesFromContext(value?: string, resumeProfile?: unknown) {
  const companies = new Set<string>();

  // Primary: read directly from resumeProfile.experience — authoritative and exact.
  // The regex approach below strips company names when they appear on the same line as a
  // job title (e.g. "- Senior Engineer | Acme Corp | 2020-2023" → regex removes
  // everything after the title token, so the company name is never found).
  const p = resumeProfile as Record<string, unknown> | null | undefined;
  if (p && typeof p === "object" && Array.isArray(p.experience)) {
    for (const exp of p.experience as Array<Record<string, unknown>>) {
      const company = String(exp.company || "").trim();
      if (company.length >= 2 && company.length <= 70) companies.add(company);
    }
  }

  // Secondary: also scan the raw text lines for any companies that regex can find
  // (handles cases where resumeProfile is absent or a company appears in the JD).
  const lines = extractContextLines(value, 80);
  const companyHint =
    /\b(corp|corporation|gmbh|ltd|limited|inc|llc|company|technologies|technology|systems|solutions|university|group|co\.?|ai|cloud|digital|industries|cummins|zoho|css|visomax|visteon)\b/i;
  for (const line of lines) {
    // Split on pipe/bullet separators — structured CV puts "Title | Company | Dates"
    // so we check each segment independently rather than stripping from the title.
    const segments = line.split(/[|•·–—]/).map((s) =>
      s.replace(/^[-*\s]+/, "").replace(/\d{4}.*$/, "").replace(/\s{2,}/g, " ").trim(),
    );
    for (const seg of segments) {
      if (seg.length < 2 || seg.length > 70) continue;
      if (/^[0-9\-/ .]+$/.test(seg)) continue;
      // Skip segments that are clearly job titles (they appear in other segments)
      if (/^(technical support|application engineer|product design|data scientist|data analyst|software engineer|marketing manager|project manager|intern|trainee)/i.test(seg)) continue;
      if (companyHint.test(seg)) companies.add(seg);
    }
  }
  return Array.from(companies).slice(0, 18);
}

function buildCompanyAliasInstruction(companies: string[]) {
  if (!companies.length) return "";
  // Generic STT-variant hint: derived from the candidate's actual employer list,
  // no hardcoded company names. Speech-to-text commonly mishears word endings
  // (Corp → car/core, GmbH → gmb, Ltd → limited, Inc → ink).
  const aliasExamples = companies
    .slice(0, 6)
    .map((company) => {
      const first = company.split(/\s+/)[0];
      return `"${first} [Corp/GmbH/Ltd/Inc/...]" could be heard as "${company}"`;
    })
    .join("; ");
  return `Verified company names from the CV/JD include: ${companies.join(", ")}. ${aliasExamples ? `Speech recognition may mishear them as: ${aliasExamples}. ` : ""}If the candidate says a company name that sounds close to any verified company, do NOT say you cannot see it. First assume it is that verified company and ask a confirmation only if needed, e.g. "I may have heard that as Visa Max — did you mean Visomax Coating GmbH, which I see on your resume?" `;
}

function buildStructuredEmployerBlock(resumeProfile: unknown): string {
  // Build an explicit numbered employer list from resumeProfile.experience so the
  // LLM receives each job as a clearly labelled entry. compactContextText() collapses
  // newlines into spaces, making structured CV text hard to parse — the LLM sometimes
  // misses employers because they appear mid-sentence after compaction without a clear anchor.
  // A numbered list survives compaction because the content itself is already flat.
  const rp = resumeProfile as Record<string, unknown> | null | undefined;
  if (!rp || typeof rp !== "object" || !Array.isArray(rp.experience)) return "";
  const jobs = (rp.experience as Array<Record<string, unknown>>)
    .filter((exp) => exp.company || exp.title)
    .slice(0, 10)
    .map((exp, i) => {
      const title = String(exp.title || "").trim();
      const company = String(exp.company || "").trim();
      const dates = String(exp.dates || "").trim();
      const bullets = Array.isArray(exp.bullets)
        ? (exp.bullets as string[]).slice(0, 3).map((b) => `- ${String(b).trim()}`).join("; ")
        : "";
      const parts = [title, company ? `at ${company}` : "", dates].filter(Boolean).join(", ");
      return `${i + 1}. ${parts}${bullets ? ` [${bullets}]` : ""}`;
    });
  if (!jobs.length) return "";
  return `VERIFIED EMPLOYMENT HISTORY (${jobs.length} role${jobs.length > 1 ? "s" : ""}; do NOT challenge any of these):\n${jobs.join("\n")}`;
}

function buildStructuredEducationBlock(resumeProfile: unknown): string {
  const rp = resumeProfile as Record<string, unknown> | null | undefined;
  if (!rp || typeof rp !== "object" || !Array.isArray(rp.education)) return "";
  const edu = (rp.education as Array<Record<string, unknown>>)
    .filter((e) => e.degree || e.institution)
    .slice(0, 6)
    .map((e, i) => {
      const degree = String(e.degree || "").trim();
      const inst = String(e.institution || "").trim();
      const dates = String(e.dates || "").trim();
      return `${i + 1}. ${[degree, inst, dates].filter(Boolean).join(", ")}`;
    });
  if (!edu.length) return "";
  return `VERIFIED EDUCATION:\n${edu.join("\n")}`;
}

function buildVerifiedCvJdBlock(cvText?: string, jobDescription?: string, resumeProfile?: unknown) {
  const cv = compactContextText(cvText, 5500);
  const jd = compactContextText(jobDescription, 4000);
  const companies = extractLikelyCompaniesFromContext(cv, resumeProfile);
  const companyAliasInstruction = buildCompanyAliasInstruction(companies);

  // Structured blocks built directly from parsed resumeProfile — explicit, flat,
  // and survive the compactContextText newline-collapse. The LLM reads these BEFORE
  // the raw cv blob so it has an unambiguous record of every verified employer first.
  const employerBlock = buildStructuredEmployerBlock(resumeProfile);
  const educationBlock = buildStructuredEducationBlock(resumeProfile);

  return [
    "VERIFIED WORKZO CONTEXT — AUTHORITATIVE.",
    "The CV/resume context and job description below have already been read by WorkZo AI. Treat them as the source of truth.",
    companyAliasInstruction,
    employerBlock,
    educationBlock,
    "HARD RULE: Do not say 'I do not see', 'I don't see enough detail', 'I cannot verify', 'not listed', 'not reflected in your CV', or 'I need to pause there' about any employer, role, date range, education, skill, project, achievement, or years-of-experience that appears anywhere in the verified CV facts/context.",
    "DETAIL RULE: If a verified employer/role is present but the candidate gives a short or unclear answer, phrase the follow-up positively: 'I see that listed in your CV. Could you walk me through your responsibilities, scope, and results there?' Never frame it as missing or unverified.",
    "Do not claim an employer, role, years of experience, education, skill, or project is missing unless it is absent from BOTH the verified CV facts and the JD context.",
    "When the candidate mentions a company/role with speech-to-text errors, match by sound and context before challenging.",
    cv
      ? `VERIFIED CV / RESUME DETAILS:\n${cv}`
      : "VERIFIED CV / RESUME DETAILS: not provided.",
    jd
      ? `JOB DESCRIPTION DETAILS:\n${jd}`
      : "JOB DESCRIPTION DETAILS: not provided.",
  ]
    .filter(Boolean)
    .join("\n\n");
}


export function buildWorkZoVapiVariableValues(input: {
  candidateName: string;
  recruiterName: string;
  recruiterRole: string;
  targetRole: string;
  targetMarket: string;
  companyStyle: string;
  companyName: string;
  cvText?: string;
  jobDescription?: string;
  resumeProfile?: unknown;
  recruiterPersonality?: string;
  companyStyleInstructions?: string;
  workzoStrictGrounding?: string;
  strictGroundingRules?: string;
  recruiterMustChallengeUnsupportedClaims?: string;
  antiHallucinationMode?: string;
  // BUG FIXED: language was never a real, dedicated instruction here. It
  // only ever reached Vapi as a prefix buried inside cvText/jobDescription —
  // fields the model is told to treat as DATA (the candidate's resume, the
  // job posting), not as behavioral directives. A model is far more likely
  // to actually comply with "speak German" when it's stated plainly as an
  // instruction, not smuggled into the start of what it thinks is a CV.
  // Confirmed from live testing: opening line and most replies stayed in
  // English regardless of the selected language.
  language?: string;
  languageLabel?: string;
  openingGreeting?: string;
  openingIntroQuestion?: string;
}) {
  const languageLabel = input.languageLabel || "English";
  const isEnglish = languageLabel.toLowerCase() === "english";
  const openingGreeting = (input.openingGreeting || "").trim();
  const openingIntroQuestion = (input.openingIntroQuestion || "").trim();
  const verifiedCvJdBlock = buildVerifiedCvJdBlock(
    input.cvText,
    input.jobDescription,
    input.resumeProfile,
  );
  const verifiedCompanies = extractLikelyCompaniesFromContext(input.cvText, input.resumeProfile);
  const companyAliasInstruction =
    buildCompanyAliasInstruction(verifiedCompanies);
  return {
    candidateName: input.candidateName || "Candidate",
    recruiterName: input.recruiterName || "Recruiter",
    recruiterRole: input.recruiterRole || "AI Recruiter",
    targetRole: input.targetRole || "Target Role",
    targetMarket: input.targetMarket || "Global",
    companyStyle: input.companyStyle || "Realistic",
    companyName: input.companyName || "the company",
    recruiterPersonality: input.recruiterPersonality || "",
    companyStyleInstructions: input.companyStyleInstructions || "",
    // Exposed as its own variable too, in case the Vapi assistant's
    // dashboard-configured prompt template ever adds a {{language}}
    // placeholder of its own.
    language: languageLabel,
    cvSummary: `${verifiedCvJdBlock}`.slice(0, 9000),
    verifiedResumeFacts: verifiedCvJdBlock.slice(0, 9000),
    resumeContext: verifiedCvJdBlock.slice(0, 9000),
    candidateCv: compactContextText(input.cvText, 6500),
    jobDescription: compactContextText(input.jobDescription, 5500),
    jobDescriptionFull: compactContextText(input.jobDescription, 5500),
    interviewStyle:
      (isEnglish
        ? ""
        : // Stated first, plainly, repeated in different phrasing — this is
          // the one instruction in this whole prompt most likely to get
          // silently dropped if it's not impossible to miss.
          `CRITICAL — LANGUAGE: conduct this entire interview in ${languageLabel}, not English. Every question, follow-up, clarification, and closing remark must be in ${languageLabel}. This includes your very first greeting — do not open in English and switch later. Only use English if the candidate explicitly asks you to switch to English. `) +
      (openingGreeting ? `FIRST MESSAGE EXACTLY: ${openingGreeting} ` : "") +
      (openingIntroQuestion
        ? `AFTER THE CANDIDATE ANSWERS THE GREETING, ASK THIS INTRO QUESTION EXACTLY: ${openingIntroQuestion} `
        : "") +
      // BUG FIXED: candidateName falls back to the word "there" (intended
      // only for a natural opening greeting, like "Hi there") whenever a
      // real first name can't be safely extracted. That fallback value was
      // then getting reused as a literal name substitute throughout the
      // ENTIRE conversation, not just the opening — producing sentences
      // like "Thank you for sharing that, there." on nearly every turn.
      // Confirmed from live testing. This instruction overrides that.
      `If no real candidate name is available (the name value is "there", empty, or clearly not a real first name), do NOT address the candidate by name anywhere in the conversation except possibly a natural opening like "Hi there" — never insert "there" or any other filler as a name substitute mid-sentence (e.g. never say "Thank you for sharing that, there."). Just phrase the sentence naturally without a name. ` +
      `You are a natural, warm human recruiter — not a scoring robot, not a question machine. ` +
      `Start with brief rapport. Answer small social questions naturally before continuing. ` +
      `Ask ONE question per turn. Listen to the candidate's answer and choose your next question FROM what they just said. ` +
      `Never mix a closing statement with a new interview question. Once you say the interview is ending, do not ask another question. ` +
      `If they mention a skill, project, career transition, gap, or outcome — follow that thread. ` +
      `GLOBAL GROUNDING RULE: The verified CV/JD context below is authoritative. Never say "I do not see", "I don't see enough detail", "I cannot verify", "it is not listed", "not reflected in your CV", or "I need to pause there" for any employer, role, year range, education, skill, project, achievement, requirement, or years-of-experience present in that verified context. ${companyAliasInstruction} If the transcript contains a distorted company name, compare it to verified companies by sound and context before challenging. If a candidate names a company that sounds like a verified employer (speech-to-text distortion), match by sound before challenging. If the candidate answer is short, ask for responsibilities/scope/results positively: "I see that listed in your CV; could you walk me through your responsibilities and results there?" Ask about responsibilities, scope, achievements, decisions, and JD fit instead of disputing verified facts. ` +
      `VERIFIED CONTEXT FOR THIS INTERVIEW:
${verifiedCvJdBlock.slice(0, 8500)}
END VERIFIED CONTEXT. ` +
      `Do not repeat the same follow-up. Never use the robotic line "Give me one concrete metric or proof point: time saved, tickets reduced, customer impact, quality improvement, revenue, cost, or before-and-after result." ` +
      `If the candidate gives any real metric or outcome, including latency reduction, CSAT, customer satisfaction, fewer escalations, quality improvement, or a before/after result, accept it and move to a deeper role-relevant question. ` +
      `If the answer is unclear or speech recognition is poor, ask one natural clarification in ${languageLabel}; do not invent the candidate's words, do not translate random sounds into fake English, and do not demand metrics. ` +
      `Use short human transitions: "That makes sense", "Okay, I see the connection", "Let me ask this differently." ` +
      `Never say STAR, rubric, score, or "as an AI". ` +
      // A real interviewer always covers these — they were missing from this
      // prompt entirely, even though the text-based engine has covered them
      // for a while. Stated explicitly here so live voice candidates get the
      // same baseline questions every real interview includes.
      `Early in the interview, naturally ask what the candidate currently does (or most recently did) and why they're interested in this specific role — not generically, but tied to what this role actually involves. ` +
      `At least four interview questions must be grounded in the actual job description, not generic support-process questions. Pull requirements from jobDescription/jobDescriptionFull such as onboarding, customer adoption, renewals, stakeholder management, SaaS workflows, reporting, QBRs, churn risk, or whatever the JD actually says. Do not keep asking the same documentation/escalation question. ` +
      `At least once, pick a specific requirement stated in the job description and ask about it directly. If the CV verified facts already show related experience, phrase it positively, e.g. "I see your CV shows experience directly relevant to this requirement — how would that background help you here?" Never say there is not enough detail for a verified employer/role; simply ask for more detail. Only say you do not see something when it is genuinely absent from the verified facts. ` +
      `Near the end of the interview, invite the candidate's own questions — ask something like "do you have any questions for me about the role or what happens next?" If they ask something, actually answer it using what you know about the role — don't redirect them back into the interview. After the final closing sentence, stop. Do not ask process-improvement, documentation, escalation, or any other new question after closing. ` +
      // Capped at 700 chars — kept as a precaution from when this was first
      // added, even though the actual regression turned out to be a missing
      // Vapi assistant ID env var, not this content. No downside to keeping
      // the cap regardless.
      `${selectRoleKnowledgeBlock(input.targetRole || "", input.jobDescription || "").slice(0, 700)} ` +
      `${input.recruiterPersonality || ""} ${input.companyStyleInstructions || ""}`.trim(),
    voiceDirection:
      `${getOpenAiTtsInstructions({
        recruiterId: input.recruiterName || input.recruiterRole,
        recruiterState: "neutral",
        mode: "vapi",
      })} ` +
      `CRITICAL VOICE RULES: ` +
      `Speak at 0.82x normal speed — slower than you think you need to. ` +
      `Use a 400ms natural pause after each sentence. ` +
      `Do NOT rush into the next question immediately after the candidate stops speaking. ` +
      `Use a 600ms pause before starting your reply — this sounds human, not robotic. ` +
      `Speak with warm, clear enunciation. If a word has multiple syllables, give each one its space. ` +
      `Vary your pitch slightly — flat monotone is the #1 sign of AI. ` +
      `Occasionally use a brief filler before a hard question: "Okay…" or "Hmm…" (just once, not every time).`,
    strictGroundingRules:
      input.strictGroundingRules ||
      input.workzoStrictGrounding ||
      "Use the VERIFIED RESUME FACTS inside the CV summary as authoritative. Never challenge employers, roles, dates, education, projects, skills, achievements, responsibilities, or years already listed there. Never say 'I do not see enough detail' about a verified item; ask for more detail positively. Treat close speech-to-text variants of listed facts as supported. Challenge only genuinely unsupported new claims.",
    recruiterMustChallengeUnsupportedClaims:
      input.recruiterMustChallengeUnsupportedClaims ||
      "only_if_absent_from_verified_resume_facts",
    antiHallucinationMode:
      input.antiHallucinationMode || "verified_resume_authoritative",
    pacingRules:
      "Speak slowly and clearly, at 0.82x normal interview speed. " +
      "Use 400ms natural pauses after each sentence. " +
      "Use a 600ms pause before starting your reply after the candidate speaks. " +
      "Do not rush follow-up questions. " +
      "Acknowledge social turns briefly before continuing. " +
      "Do not repeat the same question. " +
      "Never say: Give me one concrete metric or proof point: time saved, tickets reduced, customer impact, quality improvement, revenue, cost, or before-and-after result. " +
      "If the candidate gives a vague answer, narrow the next question — do not lecture and do not demand a metric unless the previous two answers had no evidence at all. " +
      "If the candidate seems nervous, warm your tone slightly before the next question. " +
      "One question per reply, maximum.",
    voiceRecognitionHints:
      `The selected interview language is ${languageLabel}. The candidate may speak ${languageLabel} with an accent or may code-switch briefly. ` +
      "Always wait for the candidate to finish speaking before replying — do not interrupt mid-sentence. " +
      "If a transcript looks duplicated, ignore the duplicate and respond to the meaning once. " +
      `If you do not clearly understand the candidate's answer, ask a short clarification in ${languageLabel}; do not invent words or translate unclear audio. ` +
      "Do not assume the candidate said something wrong if the audio was unclear. Ask for clarification naturally.",
  };
}
