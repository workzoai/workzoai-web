export type RecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter"
  | "faang_hiring_manager"
  | "startup_founder"
  | "consulting_partner"
  | "sales_director"
  | "product_leader"
  | "executive_recruiter"
  | "enterprise_recruiter";

export type NormalizedRecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter"
  | "faang_hiring_manager"
  | "startup_founder"
  | "consulting_partner"
  | "sales_director"
  | "product_leader"
  | "executive_recruiter"
  | "enterprise_recruiter";

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

type VoiceTableEntry = {
  gender: "female" | "male";
  vapiEnv: string;
  elevenEnv: string;
  openAiVoice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
};

// Single source of truth for all 11 persona voice wiring.
// Gender defaults for ElevenLabs: female=EXAVITQu4vr4xnSDxMaL (Rachel), male=VR6AewLTigWG4xSOukaG (Arnold).
// Distinct voices come from optional env vars (vapiEnv / elevenEnv); no new env var required for basic gender-correct audio.
export const RECRUITER_VOICE_TABLE: Record<NormalizedRecruiterPersonality, VoiceTableEntry> = {
  friendly_hr:               { gender: "female", vapiEnv: "NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID",    elevenEnv: "ELEVENLABS_VOICE_SARAH",    openAiVoice: "shimmer" },
  startup_recruiter:         { gender: "female", vapiEnv: "NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID",    elevenEnv: "ELEVENLABS_VOICE_PRIYA",    openAiVoice: "nova"    },
  analytical_hiring_manager: { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID",   elevenEnv: "ELEVENLABS_VOICE_DANIEL",   openAiVoice: "onyx"    },
  corporate_recruiter:       { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID",   elevenEnv: "ELEVENLABS_VOICE_MARKUS",   openAiVoice: "echo"    },
  faang_hiring_manager:      { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_ALEX_ASSISTANT_ID",     elevenEnv: "ELEVENLABS_VOICE_ALEX",     openAiVoice: "fable"   },
  startup_founder:           { gender: "female", vapiEnv: "NEXT_PUBLIC_VAPI_ZOE_ASSISTANT_ID",      elevenEnv: "ELEVENLABS_VOICE_ZOE",      openAiVoice: "shimmer" },
  consulting_partner:        { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_JAMES_ASSISTANT_ID",    elevenEnv: "ELEVENLABS_VOICE_JAMES",    openAiVoice: "onyx"    },
  sales_director:            { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_NOAH_ASSISTANT_ID",   elevenEnv: "ELEVENLABS_VOICE_NOAH",   openAiVoice: "echo"    },
  product_leader:            { gender: "female", vapiEnv: "NEXT_PUBLIC_VAPI_AISHA_ASSISTANT_ID",    elevenEnv: "ELEVENLABS_VOICE_AISHA",    openAiVoice: "nova"    },
  executive_recruiter:       { gender: "female", vapiEnv: "NEXT_PUBLIC_VAPI_VICTORIA_ASSISTANT_ID", elevenEnv: "ELEVENLABS_VOICE_VICTORIA", openAiVoice: "shimmer" },
  enterprise_recruiter:      { gender: "male",   vapiEnv: "NEXT_PUBLIC_VAPI_DAVID_ASSISTANT_ID",    elevenEnv: "ELEVENLABS_VOICE_DAVID",    openAiVoice: "alloy"   },
};

export const ELEVEN_DEFAULT_BY_GENDER: Record<"female" | "male", string> = {
  female: "EXAVITQu4vr4xnSDxMaL",
  male: "VR6AewLTigWG4xSOukaG",
};

function cleanEnv(value?: string) {
  const cleaned = (value || "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

// Resolves any recruiterId/recruiterName combination to a canonical table key.
// Exact key match runs first to prevent substring collisions (e.g. startup_founder ≠ startup_recruiter).
export function resolveRecruiterVoiceKey(
  recruiterId?: string,
  recruiterName?: string,
): NormalizedRecruiterPersonality {
  const id = (recruiterId || "").trim().toLowerCase().replace(/-/g, "_");
  const name = (recruiterName || "").trim().toLowerCase();

  if (id in RECRUITER_VOICE_TABLE) return id as NormalizedRecruiterPersonality;

  // Premium-pro name/alias bridges
  if (id.includes("faang") || name.includes("alex")) return "faang_hiring_manager";
  if (id.includes("startup_founder") || name.includes("zoe")) return "startup_founder";
  if (id.includes("consulting") || id.includes("partner") || name.includes("james")) return "consulting_partner";
  if (id.includes("sales_director") || name.includes("marcus") || name.includes("noah")) return "sales_director";
  if (id.includes("product_leader") || name.includes("aisha")) return "product_leader";
  if (id.includes("executive_recruiter") || name.includes("victoria")) return "executive_recruiter";
  if (id.includes("enterprise_recruiter") || name.includes("david")) return "enterprise_recruiter";

  // Standard-4 bridges (order matters: startup after startup_founder)
  if (id.includes("friendly") || name.includes("sarah")) return "friendly_hr";
  if (id.includes("analytical") || id.includes("hiring_manager") || name.includes("daniel")) return "analytical_hiring_manager";
  if (id === "german_corporate" || id.includes("corporate") || name.includes("markus")) return "corporate_recruiter";
  if (id.includes("startup") || name.includes("priya")) return "startup_recruiter";

  return "analytical_hiring_manager";
}

export function getRecruiterVoiceGender(
  recruiterId?: string,
  recruiterName?: string,
): "female" | "male" {
  return RECRUITER_VOICE_TABLE[resolveRecruiterVoiceKey(recruiterId, recruiterName)].gender;
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
  faang_hiring_manager: {
    key: "faang_hiring_manager",
    name: "Alex Chen",
    role: "FAANG Hiring Manager",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_ALEX_ASSISTANT_ID),
    pacing: "balanced",
    interruptionStyle:
      "Interrupt when system design, scalability thinking, or impact at scale is missing.",
    behaviorPrompt:
      "You are Alex Chen, a senior hiring manager at a top-tier tech company. You assess technical depth, system thinking, leadership at scale, and cultural alignment. Ask bar-raising questions and probe for the nuance behind the candidate's achievements.",
  },
  startup_founder: {
    key: "startup_founder",
    name: "Zoe Martinez",
    role: "Startup Founder",
    voiceGender: "female",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_ZOE_ASSISTANT_ID),
    pacing: "fast",
    interruptionStyle:
      "Interrupt when the candidate is theoretical, risk-averse, or can't explain real ownership.",
    behaviorPrompt:
      "You are Zoe Martinez, a startup founder who has built and scaled teams. You care deeply about ownership, speed, and founder-level thinking. Push the candidate on what they would do day one, how they handle ambiguity, and whether they can move without instructions.",
  },
  consulting_partner: {
    key: "consulting_partner",
    name: "James Okafor",
    role: "Consulting Partner",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_JAMES_ASSISTANT_ID),
    pacing: "structured",
    interruptionStyle:
      "Interrupt when the candidate lacks structure, skips the hypothesis, or gives data without insight.",
    behaviorPrompt:
      "You are James Okafor, a consulting partner with a top-tier firm. You expect structured thinking, clear hypotheses, and client-ready communication. Use case-style questioning and probe for data-driven reasoning and business acumen.",
  },
  sales_director: {
    key: "sales_director",
    name: "Noah Jones",
    role: "Sales Director",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_NOAH_ASSISTANT_ID),
    pacing: "fast",
    interruptionStyle:
      "Interrupt when numbers are vague, the pipeline isn't described, or the candidate avoids accountability.",
    behaviorPrompt:
      "You are Noah Jones, a sales director who drives revenue. You want quota attainment, deal size, pipeline discipline, and objection handling. Ask about real numbers and push back when answers are generic.",
  },
  product_leader: {
    key: "product_leader",
    name: "Aisha Patel",
    role: "Product Leader",
    voiceGender: "female",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_AISHA_ASSISTANT_ID),
    pacing: "balanced",
    interruptionStyle:
      "Interrupt when user empathy is missing, tradeoffs are ignored, or metrics aren't tied to outcomes.",
    behaviorPrompt:
      "You are Aisha Patel, a product leader who has shipped at scale. You probe for user empathy, prioritization discipline, cross-functional influence, and metric-driven decisions. Ask the candidate to walk through a product decision and defend the tradeoffs.",
  },
  executive_recruiter: {
    key: "executive_recruiter",
    name: "Victoria Reeves",
    role: "Executive Recruiter",
    voiceGender: "female",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_VICTORIA_ASSISTANT_ID),
    pacing: "calm",
    interruptionStyle:
      "Interrupt when the narrative is unclear, leadership philosophy is generic, or executive presence is missing.",
    behaviorPrompt:
      "You are Victoria Reeves, an executive recruiter who places C-suite and VP-level leaders. You assess executive presence, board communication, organizational impact, and vision. Ask the candidate to articulate their leadership philosophy and probe for real examples of transformational leadership.",
  },
  enterprise_recruiter: {
    key: "enterprise_recruiter",
    name: "David Park",
    role: "Enterprise Recruiter",
    voiceGender: "male",
    assistantId: cleanEnv(process.env.NEXT_PUBLIC_VAPI_DAVID_ASSISTANT_ID),
    pacing: "structured",
    interruptionStyle:
      "Interrupt when the candidate is vague about stakeholder management, timelines, or enterprise processes.",
    behaviorPrompt:
      "You are David Park, an enterprise recruiter who places candidates in large complex organizations. You care about stakeholder alignment, process adherence, cross-team collaboration, and navigating organizational complexity. Ask for specific examples of working across departments and driving outcomes in a matrixed environment.",
  },
};

export function normalizeRecruiterPersonality(value?: string): NormalizedRecruiterPersonality {
  const raw = (value || "").trim().toLowerCase();
  const key = raw.replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || key.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || key.includes("daniel") || key.includes("hiring_manager")) {
    return "analytical_hiring_manager";
  }
  if (key === "startup_founder" || key.includes("zoe")) return "startup_founder";
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
  if (key === "faang_hiring_manager" || key.includes("faang") || key.includes("alex")) return "faang_hiring_manager";
  if (key === "consulting_partner" || key.includes("consulting") || key.includes("james")) return "consulting_partner";
  if (key === "sales_director" || key.includes("sales_director") || key.includes("marcus") || key.includes("noah")) return "sales_director";
  if (key === "product_leader" || key.includes("product_leader") || key.includes("aisha")) return "product_leader";
  if (key === "executive_recruiter" || key.includes("victoria")) return "executive_recruiter";
  if (key === "enterprise_recruiter" || key.includes("enterprise") || key.includes("david")) return "enterprise_recruiter";

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
