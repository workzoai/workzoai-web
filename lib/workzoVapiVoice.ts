import { getOpenAiTtsInstructions } from "@/lib/workzoVoiceHumanizer";

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
  recruiterKey: "sarah" | "daniel" | "priya" | "markus";
};

export function getWorkZoVapiRecruiterKey(recruiterId?: WorkZoRecruiterId, recruiterName?: string) {
  const raw = `${recruiterId || ""} ${recruiterName || ""}`.toLowerCase();
  if (raw.includes("friendly_hr") || raw.includes("sarah") || raw.includes("friendly")) return "sarah" as const;
  if (raw.includes("analytical_hiring_manager") || raw.includes("daniel") || raw.includes("analytical") || raw.includes("hiring")) return "daniel" as const;
  if (raw.includes("startup_recruiter") || raw.includes("priya") || raw.includes("startup")) return "priya" as const;
  if (raw.includes("corporate_recruiter") || raw.includes("markus") || raw.includes("corporate")) return "markus" as const;
  return "sarah" as const;
}

export function getWorkZoVapiAssistantId(recruiterId?: WorkZoRecruiterId, recruiterName?: string) {
  const key = getWorkZoVapiRecruiterKey(recruiterId, recruiterName);

  const assistantIds: Record<ReturnType<typeof getWorkZoVapiRecruiterKey>, string> = {
    sarah: process.env.NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID || "",
    daniel: process.env.NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID || "",
    priya: process.env.NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID || "",
    markus: process.env.NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID || "",
  };

  return { key, assistantId: assistantIds[key] || "" };
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
}) {
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
    cvSummary: (input.cvText || "").replace(/\s+/g, " ").slice(0, 2400),
    jobDescription: (input.jobDescription || "").replace(/\s+/g, " ").slice(0, 2400),
    interviewStyle:
      `Natural human recruiter. Start with brief rapport, answer small questions naturally, ask one question at a time, probe based on the candidate's answer, avoid robotic scoring language, and challenge unsupported claims before continuing. ${input.recruiterPersonality || ""} ${input.companyStyleInstructions || ""}`,
    voiceDirection: `${getOpenAiTtsInstructions({
      recruiterId: input.recruiterName || input.recruiterRole,
      recruiterState: "neutral",
      mode: "vapi",
    })} Speak slower than a normal call. Use calm pacing, clear pronunciation, and brief pauses after each sentence. Do not rush.`,
    strictGroundingRules:
      input.strictGroundingRules ||
      input.workzoStrictGrounding ||
      "Use the CV and job description as ground truth. Challenge unsupported companies, roles, years, achievements, degrees, certifications, and metrics before continuing.",
    recruiterMustChallengeUnsupportedClaims:
      input.recruiterMustChallengeUnsupportedClaims || "true",
    antiHallucinationMode: input.antiHallucinationMode || "strict",
    pacingRules:
      "Speak slowly and clearly, around 0.85x normal interview speed. Use short human pauses between sentences. Do not rush follow-up questions. Acknowledge social turns briefly before continuing. Do not repeat the same question. If the candidate gives a vague answer, narrow the next question instead of lecturing.",
  };
}
