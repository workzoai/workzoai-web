import { getOpenAiTtsInstructions } from "@/lib/workzoVoiceHumanizer";
import { resolveRecruiterVoiceKey, recruiterVoiceProfiles } from "@/lib/recruiterVoiceConfig";
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

export function getWorkZoVapiRecruiterKey(recruiterId?: WorkZoRecruiterId, recruiterName?: string) {
  const raw = `${recruiterId || ""} ${recruiterName || ""}`.toLowerCase();
  if (raw.includes("friendly_hr") || raw.includes("sarah") || raw.includes("friendly")) return "sarah" as const;
  if (raw.includes("analytical_hiring_manager") || raw.includes("daniel") || raw.includes("analytical") || raw.includes("hiring")) return "daniel" as const;
  if (raw.includes("startup_recruiter") || raw.includes("priya") || raw.includes("startup_recruiter")) return "priya" as const;
  if (raw.includes("german_corporate") || raw.includes("corporate_recruiter") || raw.includes("markus") || raw.includes("corporate")) return "markus" as const;

  // Pro personas — map to closest standard voice persona
  // FAANG/technical → Daniel (evidence-driven, analytical)
  if (raw.includes("faang") || raw.includes("alex")) return "daniel" as const;
  // Startup founder → Priya (fast-paced, ownership-focused)
  if (raw.includes("startup_founder") || raw.includes("zoe") || raw.includes("founder")) return "priya" as const;
  // Consulting partner → Markus (structured, process-oriented)
  if (raw.includes("consulting_partner") || raw.includes("harrington") || raw.includes("consulting")) return "markus" as const;
  // Sales director → Daniel (numbers-first, direct)
  if (raw.includes("sales_director") || raw.includes("marcus webb") || raw.includes("sales")) return "daniel" as const;
  // Product leader → Priya (practical, user-focused)
  if (raw.includes("product_leader") || raw.includes("aisha")) return "priya" as const;
  // Executive recruiter → Markus (formal, structured)
  if (raw.includes("executive_recruiter") || raw.includes("victoria") || raw.includes("stern")) return "markus" as const;
  // Enterprise recruiter → Daniel (process-driven)
  if (raw.includes("enterprise_recruiter") || raw.includes("kimura")) return "daniel" as const;

  return "sarah" as const;
}

export function getWorkZoVapiAssistantId(recruiterId?: WorkZoRecruiterId, recruiterName?: string) {
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

export function getWorkZoVapiConfig(recruiterId?: WorkZoRecruiterId, recruiterName?: string): WorkZoVapiConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
  const provider = (process.env.NEXT_PUBLIC_WORKZO_VOICE_PROVIDER || "").toLowerCase();
  const { key, assistantId } = getWorkZoVapiAssistantId(recruiterId, recruiterName);

  return {
    publicKey,
    assistantId,
    recruiterKey: key,
    enabled: Boolean(publicKey && assistantId && provider !== "tts" && provider !== "browser"),
  };
}


export async function createWorkZoVapiClient(publicKey: string): Promise<WorkZoVapiClient> {
  // Lazy-load the AI voice SDK only after the user taps Start/Mic.
  // A static top-level import can cause the SDK/Daily layer to warm device APIs
  // during the heavy /interview page load, which leads to repeated
  // enumerateDevices delays before the user even starts voice.
  const mod = await import("@vapi-ai/web");
  const VapiConstructor = (mod.default || mod) as unknown as new (key: string) => WorkZoVapiClient;
  return new VapiConstructor(publicKey);
}

export function normalizeVapiTranscriptMessage(message: any): WorkZoVapiTranscriptMessage | null {
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

  const role = String(message.role || message.speaker || message.from || "assistant").toLowerCase();
  const transcriptType = String(message.transcriptType || message.status || "final").toLowerCase();

  const looksLikeTranscript =
    type.includes("transcript") ||
    type.includes("conversation") ||
    Boolean(message.transcript) ||
    Boolean(message.text);

  if (!looksLikeTranscript) return null;

  return {
    role: role.includes("user") ? "user" : role.includes("assistant") ? "assistant" : role,
    text: transcript.replace(/\s+/g, " ").trim(),
    isFinal: transcriptType !== "partial" && transcriptType !== "interim",
  };
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
}) {
  const languageLabel = input.languageLabel || "English";
  const isEnglish = languageLabel.toLowerCase() === "english";
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
    cvSummary: (input.cvText || "").replace(/\s+/g, " ").slice(0, 2400),
    jobDescription: (input.jobDescription || "").replace(/\s+/g, " ").slice(0, 2400),
    interviewStyle:
      (isEnglish
        ? ""
        : // Stated first, plainly, repeated in different phrasing — this is
          // the one instruction in this whole prompt most likely to get
          // silently dropped if it's not impossible to miss.
          `CRITICAL — LANGUAGE: conduct this entire interview in ${languageLabel}, not English. Every question, follow-up, clarification, and closing remark must be in ${languageLabel}. This includes your very first greeting — do not open in English and switch later. Only use English if the candidate explicitly asks you to switch to English. `) +
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
      `If they mention a skill, project, career transition, gap, or outcome — follow that thread. ` +
      `Probe gently for specifics and ownership. Challenge only when something doesn't add up. ` +
      `Do not repeat the same follow-up. Never use the robotic line "Give me one concrete metric or proof point: time saved, tickets reduced, customer impact, quality improvement, revenue, cost, or before-and-after result." ` +
      `If the candidate gives any real metric or outcome, including latency reduction, CSAT, customer satisfaction, fewer escalations, quality improvement, or a before/after result, accept it and move to a deeper role-relevant question. ` +
      `If the answer is unclear or speech recognition is poor, ask one natural clarification about what they meant; do not demand metrics. ` +
      `Use short human transitions: "That makes sense", "Okay, I see the connection", "Let me ask this differently." ` +
      `Never say STAR, rubric, score, or "as an AI". ` +
      // A real interviewer always covers these — they were missing from this
      // prompt entirely, even though the text-based engine has covered them
      // for a while. Stated explicitly here so live voice candidates get the
      // same baseline questions every real interview includes.
      `Early in the interview, naturally ask what the candidate currently does (or most recently did) and why they're interested in this specific role — not generically, but tied to what this role actually involves. ` +
      `At least once, pick a specific requirement stated in the job description below that you don't see clearly evidenced in the CV, and ask about it directly — e.g. "This role needs X, I'm not seeing that in your background, do you have experience with that?" Don't rely only on generic competency questions; ground at least one question in the actual job description text. ` +
      `Near the end of the interview, invite the candidate's own questions — ask something like "do you have any questions for me about the role or what happens next?" If they ask something, actually answer it using what you know about the role — don't redirect them back into the interview. ` +
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
      "Use the CV and job description as ground truth. Challenge unsupported companies, roles, years, achievements, degrees, certifications, and metrics before continuing.",
    recruiterMustChallengeUnsupportedClaims:
      input.recruiterMustChallengeUnsupportedClaims || "true",
    antiHallucinationMode: input.antiHallucinationMode || "strict",
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
      "The candidate may speak English with an accent (German, Indian, Portuguese, Spanish, Dutch). " +
      "Always wait for the candidate to finish speaking before replying — do not interrupt mid-sentence. " +
      "If a transcript looks duplicated, ignore the duplicate and respond to the meaning once. " +
      "If you do not clearly understand the candidate's answer, say: 'I want to make sure I'm following you — could you say that again?' " +
      "Do not assume the candidate said something wrong if the audio was unclear. Ask for clarification naturally.",
  };
}
