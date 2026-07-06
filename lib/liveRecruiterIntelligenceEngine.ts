import type { WorkZoInterviewSetup } from "@/lib/workzoInterviewSetup";
import type {
  RecruiterMemory,
  RecruiterState,
} from "@/lib/workzoRecruiterPsychologyEngine";

export type LiveTranscriptItem = {
  role: "recruiter" | "candidate" | "system";
  text: string;
  time?: string;
};

export type LiveRecruiterIntelligenceInput = {
  answer: string;
  currentQuestion: string;
  setup: WorkZoInterviewSetup;
  recruiterName: string;
  recruiterRole: string;
  recruiterTrust: number;
  previousTrust: number;
  recruiterState: RecruiterState;
  memory: RecruiterMemory;
  transcript: LiveTranscriptItem[];
};

export type LiveRecruiterIntelligenceResult = {
  shouldInjectToVapi: boolean;
  spokenBridge: string;
  nextFocus: string;
  emotionalTag: string;
  statusLabel: string;
  pressureLevel: "low" | "medium" | "high";
  privateInstruction: string;
};

type WeakSignal =
  | "missing_metrics"
  | "unclear_ownership"
  | "rambling"
  | "too_short"
  | "cv_truth_check"
  | "generic"
  | "none";

type RecruiterPersona = "sarah" | "daniel" | "priya" | "markus" | "default";

function compact(value: string, max = 260) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function wordCount(text: string) {
  return compact(text, 9999).split(/\s+/).filter(Boolean).length;
}

function hasMetric(text: string) {
  return /(\d+%|\d+\s?(x|times|days|hours|hrs|minutes|min|weeks|months|years|users|customers|tickets|cases|incidents|projects|€|\$|kpi|sla|nps|csat|revenue|cost|saved|reduced|increased|decreased|faster|slower)|\b(percent|percentage|baseline|measured|metric|target|volume|average|before|after)\b)/i.test(text);
}

function claimsImpact(text: string) {
  return /\b(improved|increased|reduced|optimized|decreased|saved|grew|boosted|accelerated|resolved|delivered|achieved|raised|lowered|streamlined|automated|fixed|handled|closed|converted|launched|built|created)\b/i.test(text);
}

function hasPersonalOwnership(text: string) {
  return /\b(i led|i owned|i built|i created|i designed|i implemented|i analyzed|i resolved|i improved|i handled|i drove|i managed|i coordinated|i delivered|i was responsible|my role was|i took|i decided|i introduced|i changed)\b/i.test(text);
}

function vagueTeamOwnership(text: string) {
  return /\b(we|our team|team worked|supported|helped|involved|participated|contributed|worked on|part of)\b/i.test(text) && !hasPersonalOwnership(text);
}

function isRambling(text: string) {
  const words = wordCount(text);
  return words > 135 || text.length > 780 || (words > 95 && !hasMetric(text));
}

function isTooShort(text: string) {
  return wordCount(text) < 24;
}

function isGeneric(text: string) {
  const lower = text.toLowerCase();
  return (
    /\b(hardworking|team player|passionate|good communication|learn quickly|problem solver|responsible|dedicated)\b/i.test(lower) &&
    !hasMetric(text) &&
    !/\b(example|situation|customer|ticket|project|client|deadline|incident|result)\b/i.test(lower)
  );
}

function detectPersona(input: LiveRecruiterIntelligenceInput): RecruiterPersona {
  const source = `${input.recruiterName} ${input.recruiterRole} ${input.setup.recruiterPersonality || ""}`.toLowerCase();
  if (source.includes("sarah") || source.includes("friendly")) return "sarah";
  if (source.includes("daniel") || source.includes("analytical") || source.includes("hiring manager")) return "daniel";
  if (source.includes("priya") || source.includes("startup")) return "priya";
  if (source.includes("markus") || source.includes("german") || source.includes("corporate")) return "markus";
  return "default";
}

function personaStyle(persona: RecruiterPersona) {
  switch (persona) {
    case "sarah":
      return {
        tone: "warm but still probing",
        evidenceWord: "example",
        bridgePrefix: "I like the direction, but",
      };
    case "daniel":
      return {
        tone: "analytical and evidence-led",
        evidenceWord: "evidence",
        bridgePrefix: "From a hiring-manager perspective,",
      };
    case "priya":
      return {
        tone: "fast-paced startup pressure",
        evidenceWord: "outcome",
        bridgePrefix: "I’ll be quick here:",
      };
    case "markus":
      return {
        tone: "structured, precise, and process-focused",
        evidenceWord: "specific proof",
        bridgePrefix: "Let us make this more precise:",
      };
    default:
      return {
        tone: "realistic recruiter",
        evidenceWord: "proof",
        bridgePrefix: "I want to be direct:",
      };
  }
}

function extractRole(setup: WorkZoInterviewSetup) {
  const job = setup.jobMemoryProfile;
  if (job && typeof job === "object" && "roleTitle" in job) {
    const value = (job as { roleTitle?: unknown }).roleTitle;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return setup.targetRole || "the target role";
}

function latestCandidateAnswers(transcript: LiveTranscriptItem[]) {
  return transcript
    .filter((item) => item.role === "candidate")
    .map((item) => compact(item.text, 800))
    .filter(Boolean)
    .slice(-6);
}

function previousQuestionForAnswer(transcript: LiveTranscriptItem[]) {
  const withoutLatest = transcript.slice(0, -1).reverse();
  const lastCandidateIndexFromEnd = withoutLatest.findIndex((item) => item.role === "candidate");
  const searchPool = lastCandidateIndexFromEnd >= 0 ? withoutLatest.slice(lastCandidateIndexFromEnd + 1) : withoutLatest;
  const recruiter = searchPool.find((item) => item.role === "recruiter" && item.text.trim());
  return recruiter?.text || "an earlier question";
}

function lastMeaningfulEarlierAnswer(transcript: LiveTranscriptItem[]) {
  const answers = latestCandidateAnswers(transcript);
  return answers.length >= 2 ? answers[answers.length - 2] : "";
}

function detectWeakSignal(answer: string, setup: WorkZoInterviewSetup): WeakSignal {
  const mismatch = detectCvMismatchRisk(answer, setup);
  if (mismatch) return "cv_truth_check";
  if (isRambling(answer)) return "rambling";
  if (isTooShort(answer)) return "too_short";
  if (vagueTeamOwnership(answer)) return "unclear_ownership";
  if (claimsImpact(answer) && !hasMetric(answer)) return "missing_metrics";
  if (isGeneric(answer)) return "generic";
  return "none";
}

function repeatedWeakPattern(input: LiveRecruiterIntelligenceInput, signal: WeakSignal) {
  const earlier = lastMeaningfulEarlierAnswer(input.transcript);
  if (!earlier || signal === "none") return "";

  const earlierSignal = detectWeakSignal(earlier, input.setup);
  const earlierQuestion = previousQuestionForAnswer(input.transcript);

  if (earlierSignal === signal) {
    switch (signal) {
      case "missing_metrics":
        return `Earlier, around "${compact(earlierQuestion, 90)}", you described impact without numbers. I am hearing the same pattern again.`;
      case "unclear_ownership":
        return `Earlier, your answer also stayed at team level. I still cannot see what you personally owned.`;
      case "rambling":
        return `Earlier you also gave me a long answer without a clear result. I need you to tighten this now.`;
      case "too_short":
        return `Earlier your answer was also too thin for me to judge. I need a real example now.`;
      case "generic":
        return `Earlier you also stayed generic. I need evidence, not traits.`;
      case "cv_truth_check":
        return `This is another point where I need to connect your claim back to the CV.`;
      default:
        return "";
    }
  }

  if (input.memory.rememberedWeaknesses.length >= 2) {
    return `I am noticing a repeated weak pattern: ${compact(input.memory.rememberedWeaknesses.at(-1) || "lack of concrete proof", 110)}.`;
  }

  return "";
}

function detectCvMismatchRisk(answer: string, setup: WorkZoInterviewSetup) {
  const cv = `${setup.cvText || ""} ${JSON.stringify(setup.recruiterMemoryProfile || {})}`.toLowerCase();
  const lower = answer.toLowerCase();

  const riskyClaims = [
    { claim: "python", label: "Python" },
    { claim: "sql", label: "SQL" },
    { claim: "power bi", label: "Power BI" },
    { claim: "tableau", label: "Tableau" },
    { claim: "machine learning", label: "machine learning" },
    { claim: "managed a team", label: "team management" },
    { claim: "led a team", label: "team leadership" },
    { claim: "production", label: "production deployment" },
  ];

  const hit = riskyClaims.find((item) => lower.includes(item.claim) && !cv.includes(item.claim));
  if (!hit) return "";

  return `The candidate mentioned ${hit.label}, but this is not clearly visible in the available CV context. Ask for clarification without accusing them.`;
}

function oneLineFollowUp(signal: WeakSignal, persona: RecruiterPersona, role: string) {
  const style = personaStyle(persona);

  if (signal === "cv_truth_check") {
    return "Can you connect that claim to something actually visible in your CV, or give me the real context behind it?";
  }
  if (signal === "rambling") {
    return "Answer again in one sentence: what was the situation, what did you personally do, and what changed?";
  }
  if (signal === "missing_metrics") {
    return `Give me the number: how much changed, compared with what baseline, and how did you measure it?`;
  }
  if (signal === "unclear_ownership") {
    return "What exactly did you personally own from start to finish?";
  }
  if (signal === "too_short") {
    return `Give me one real example with situation, action, and result so I can evaluate your fit for ${role}.`;
  }
  if (signal === "generic") {
    return `Give me ${style.evidenceWord}: one specific moment where you proved this under pressure.`;
  }

  if (persona === "priya") return `What was the business outcome, and why would that matter for ${role}?`;
  if (persona === "daniel") return "What evidence would your previous manager use to confirm that?";
  if (persona === "markus") return "Please structure the answer: task, your responsibility, measurable result.";
  if (persona === "sarah") return "Can you walk me through one concrete example where this made a difference?";
  return `Give me one sharper example that proves you are ready for ${role}.`;
}

function bridgeFor(signal: WeakSignal, persona: RecruiterPersona, input: LiveRecruiterIntelligenceInput, repeated: string) {
  const style = personaStyle(persona);
  const delta = input.recruiterTrust - input.previousTrust;

  if (repeated) return repeated;

  if (signal === "cv_truth_check") return "Wait, I need to clarify something before we move on.";
  if (signal === "rambling") return "Let me stop you there for a second.";
  if (signal === "missing_metrics") return `${style.bridgePrefix} this is where I need measurable proof.`;
  if (signal === "unclear_ownership") return "I hear what the team did, but I am interviewing you.";
  if (signal === "too_short") return "That is too high level for me to assess.";
  if (signal === "generic") return `${style.bridgePrefix} that sounds generic right now.`;

  if (delta <= -12 || input.recruiterState === "losing_confidence") {
    return "I am going to be direct: that answer lowered my confidence.";
  }

  if (delta >= 10 || input.recruiterState === "recovering_trust") {
    return "That was much stronger. Now I can actually see your ownership more clearly.";
  }

  if (hasMetric(input.answer) && hasPersonalOwnership(input.answer)) {
    if (persona === "daniel") return "Good, that gives me evidence I can evaluate.";
    if (persona === "priya") return "Good, now we are getting to impact.";
    if (persona === "markus") return "Good, that answer is more structured and concrete.";
    return "Good, that gives me something concrete to evaluate.";
  }

  return "Okay. I want to go one level deeper.";
}

function emotionalTagFor(signal: WeakSignal, delta: number, repeated: string) {
  if (repeated) return "Exact recruiter memory callback";
  if (signal === "cv_truth_check") return "CV truth check triggered";
  if (signal === "rambling") return "Real-time interruption moment";
  if (signal === "missing_metrics") return "Missing measurable impact";
  if (signal === "unclear_ownership") return "Ownership pressure moment";
  if (signal === "too_short") return "Answer too thin";
  if (signal === "generic") return "Generic answer challenged";
  if (delta >= 10) return "Emotional recovery moment";
  if (delta <= -12) return "Recruiter trust dropped";
  return "Recruiter probing deeper";
}

function pressureFor(signal: WeakSignal, delta: number, repeated: string): LiveRecruiterIntelligenceResult["pressureLevel"] {
  if (repeated || signal === "cv_truth_check" || signal === "rambling" || signal === "missing_metrics" || signal === "unclear_ownership") return "high";
  if (signal === "too_short" || signal === "generic" || delta <= -8) return "medium";
  return "low";
}

function statusFor(signal: WeakSignal, delta: number, repeated: string) {
  if (repeated) return "Recruiter remembered earlier answer";
  if (signal === "cv_truth_check") return "CV truth check";
  if (signal === "rambling") return "Recruiter interrupted";
  if (signal === "missing_metrics") return "Metrics missing";
  if (signal === "unclear_ownership") return "Ownership unclear";
  if (signal === "too_short") return "Needs example";
  if (signal === "generic") return "Generic answer challenged";
  if (delta >= 10) return "Trust recovering";
  if (delta <= -12) return "Trust dropped";
  return "Recruiter thinking...";
}

function hiringTension(input: LiveRecruiterIntelligenceInput) {
  const trust = input.recruiterTrust;
  if (trust >= 78) return "The recruiter is leaning positive, but will test consistency.";
  if (trust >= 58) return "The recruiter is still undecided and needs proof.";
  if (trust >= 40) return "The recruiter is becoming skeptical and needs recovery.";
  return "The recruiter is close to rejecting the answer unless the candidate recovers clearly.";
}

function silenceInstruction(signal: WeakSignal, delta: number, repeated: string) {
  if (repeated) return "Pause for about one second before referencing the earlier answer. Make it feel remembered, not scripted.";
  if (signal === "rambling") return "Interrupt cleanly. Do not apologize too much. Cut to the result.";
  if (signal === "missing_metrics" || signal === "unclear_ownership") return "Use a short skeptical pause before the follow-up.";
  if (delta >= 10) return "Soften briefly, acknowledge recovery, then continue testing.";
  if (delta <= -12) return "Sound more direct and less friendly for the next question.";
  return "Keep natural recruiter pacing with a short thinking pause.";
}

function emotionalRealityInstruction(persona: RecruiterPersona, pressure: LiveRecruiterIntelligenceResult["pressureLevel"]) {
  const base = [
    "Make the candidate feel this is a real hiring conversation, not a coaching session.",
    "React to the answer emotionally: skeptical, interested, impatient, or relieved based on the signal.",
    "Never over-explain the scoring. Show judgment through the follow-up.",
  ];

  if (pressure === "high") base.push("Use sharper recruiter pressure. Ask the candidate to repair the answer immediately.");
  if (persona === "priya") base.push("Priya is fast and outcome-driven: she dislikes long context without impact.");
  if (persona === "daniel") base.push("Daniel is evidence-led: he wants proof a hiring manager can verify.");
  if (persona === "markus") base.push("Markus is structured: he expects precise responsibility and measurable result.");
  if (persona === "sarah") base.push("Sarah is warm, but still notices avoidance and asks gently direct follow-ups.");

  return base.join(" ");
}

export function createLiveRecruiterIntelligence(
  input: LiveRecruiterIntelligenceInput,
): LiveRecruiterIntelligenceResult {
  const answer = input.answer || "";
  const delta = input.recruiterTrust - input.previousTrust;
  const role = extractRole(input.setup);
  const persona = detectPersona(input);
  const style = personaStyle(persona);
  const signal = detectWeakSignal(answer, input.setup);
  const repeated = repeatedWeakPattern(input, signal);
  const spokenBridge = bridgeFor(signal, persona, input, repeated);
  const nextFocus = oneLineFollowUp(signal, persona, role);
  const emotionalTag = emotionalTagFor(signal, delta, repeated);
  const pressureLevel = pressureFor(signal, delta, repeated);
  const statusLabel = statusFor(signal, delta, repeated);
  const mismatchRisk = detectCvMismatchRisk(answer, input.setup);

  const privateInstruction = [
    "LIVE RECRUITER MEMORY UPDATE, FOLLOW THIS FOR THE NEXT SPOKEN TURN:",
    `Recruiter persona: ${input.recruiterName}, ${style.tone}.`,
    `Current recruiter state: ${input.recruiterState}.`,
    `Trust moved from ${input.previousTrust}/100 to ${input.recruiterTrust}/100. ${hiringTension(input)}`,
    `Emotional event: ${emotionalTag}.`,
    `Behavioral realism: ${emotionalRealityInstruction(persona, pressureLevel)}`,
    `Pacing instruction: ${silenceInstruction(signal, delta, repeated)}`,
    `Candidate answer: "${compact(answer, 520)}"`,
    mismatchRisk ? `CV truth warning: ${mismatchRisk}` : "",
    repeated ? `Use exact memory callback: ${repeated}` : "",
    `Say this naturally first: "${spokenBridge}"`,
    `Then ask exactly one follow-up: "${nextFocus}"`,
    "Do not coach. Do not be motivational. Behave like a real recruiter who is deciding whether to hire.",
    "Use the candidate's exact earlier answer pattern when possible; this is the wow moment.",
    "Keep the next spoken response under 18 seconds unless the candidate asks for clarification.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    shouldInjectToVapi: true,
    spokenBridge,
    nextFocus,
    emotionalTag,
    statusLabel,
    pressureLevel,
    privateInstruction,
  };
}

export function buildVapiRealtimeMemoryMessage(
  result: LiveRecruiterIntelligenceResult,
): Record<string, unknown> {
  return {
    type: "add-message",
    message: {
      role: "system",
      content: result.privateInstruction,
    },
  };
}
