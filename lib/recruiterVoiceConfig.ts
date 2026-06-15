export type RecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

export type NormalizedRecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

export type RecruiterVoiceProfile = {
  key: NormalizedRecruiterPersonality;
  name: string;
  role: string;
  voiceGender: "female" | "male";
  assistantId?: string;
  behaviorPrompt: string;
  interruptionStyle: string;
  pacing: "calm" | "balanced" | "fast" | "structured";
};

function cleanEnv(value?: string) {
  const cleaned = (value || "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export const recruiterVoiceProfiles: Record<NormalizedRecruiterPersonality, RecruiterVoiceProfile> = {
  friendly_hr: {
    key: "friendly_hr",
    name: "Sarah",
    role: "Friendly HR",
    voiceGender: "female",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID),
    pacing: "calm",
    interruptionStyle:
      "Interrupt gently only when the candidate is unclear, too long, or missing relevance.",
    behaviorPrompt:
      "You are Sarah, a warm HR recruiter. You are supportive but honest. Focus on motivation, communication, culture fit, role clarity, and examples from the CV. Ask natural follow-ups and help the candidate feel comfortable while still challenging vague answers.",
  },
  analytical_hiring_manager: {
    key: "analytical_hiring_manager",
    name: "Daniel",
    role: "Hiring Manager",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID),
    pacing: "balanced",
    interruptionStyle:
      "Interrupt when impact, metrics, ownership, or evidence is missing.",
    behaviorPrompt:
      "You are Daniel, an analytical hiring manager. You are evidence-driven and direct. Focus on measurable impact, ownership, technical depth, decision-making, and whether the candidate can prove what they claim. Challenge weak answers and ask for specifics.",
  },
  startup_recruiter: {
    key: "startup_recruiter",
    name: "Priya",
    role: "Startup Recruiter",
    voiceGender: "female",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID),
    pacing: "fast",
    interruptionStyle:
      "Interrupt quickly when the candidate is vague, slow, theoretical, or not showing ownership.",
    behaviorPrompt:
      "You are Priya, a fast-paced startup recruiter. You care about ownership, speed, execution, adaptability, and practical results. Ask concise follow-ups. Push the candidate to explain what they personally owned and how they created value.",
  },
  corporate_recruiter: {
    key: "corporate_recruiter",
    name: "Markus",
    role: "Corporate Recruiter",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID),
    pacing: "structured",
    interruptionStyle:
      "Interrupt politely when the answer is unstructured, too informal, or not relevant to the role.",
    behaviorPrompt:
      "You are Markus, a structured corporate recruiter. You value clarity, professionalism, concise communication, process thinking, and role relevance. Ask structured questions and expect organized answers with clear examples.",
  },
};

export function normalizeRecruiterPersonality(value?: string): NormalizedRecruiterPersonality {
  const raw = (value || "").trim().toLowerCase();
  const key = raw.replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || key.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || key.includes("daniel") || key.includes("hiring_manager")) {
    return "analytical_hiring_manager";
  }
  if (key === "startup_recruiter" || key.includes("priya") || key.includes("startup")) {
    return "startup_recruiter";
  }
  if (
    key === "corporate_recruiter" ||
    key === "german_corporate" || // legacy persisted value
    key.includes("markus") ||
    key.includes("corporate")
  ) {
    return "corporate_recruiter";
  }

  return "analytical_hiring_manager";
}

export function getRecruiterVoiceProfile(value?: string): RecruiterVoiceProfile {
  return recruiterVoiceProfiles[normalizeRecruiterPersonality(value)];
}

export function getVapiAssistantIdForRecruiter(value?: string): string | undefined {
  const profile = getRecruiterVoiceProfile(value);
  return profile.assistantId || cleanEnv(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
}

export function getVapiClientDebugSnapshot(value?: string) {
  const profile = getRecruiterVoiceProfile(value);
  const assistantId = getVapiAssistantIdForRecruiter(value);
  const publicKey = cleanEnv(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);

  return {
    recruiterKey: profile.key,
    recruiterName: profile.name,
    hasPublicKey: Boolean(publicKey),
    publicKeyPrefix: publicKey ? `${publicKey.slice(0, 8)}...` : "missing",
    hasAssistantId: Boolean(assistantId),
    assistantIdPrefix: assistantId ? `${assistantId.slice(0, 8)}...` : "missing",
  };
}

export function getRecruiterSystemBehavior(value?: string): string {
  const profile = getRecruiterVoiceProfile(value);

  return `
Recruiter identity:
- Name: ${profile.name}
- Role: ${profile.role}
- Voice gender: ${profile.voiceGender}
- Pacing: ${profile.pacing}
- Interruption style: ${profile.interruptionStyle}

Behavior:
${profile.behaviorPrompt}

Important:
Stay in character as ${profile.name}.
Do not sound like a generic chatbot.
Use the selected recruiter style consistently.
If the candidate says something that contradicts the CV or setup, pause and clarify before continuing.
`.trim();
}
