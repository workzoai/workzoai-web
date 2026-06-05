import {
  runRecruiterRuntime,
  type RecruiterRuntimePersonality,
} from "./recruiterRuntimeOrchestrator";
import {
  initialEmotionalMemory,
  type EmotionalMemoryState,
} from "./emotionalMemoryEngine";

type RecruiterId = RecruiterRuntimePersonality;

type Scenario = {
  label: string;
  expected: string;
  recruiterId?: RecruiterId;
  answer: string;
  score?: number;
  pressureLevel?: number;
  memory?: EmotionalMemoryState;
  turnIndex?: number;
};

function divider() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

function makeMemory(
  overrides: Partial<EmotionalMemoryState> & {
    memorySignals?: Array<
      | "vague_answer"
      | "missing_metrics"
      | "weak_clarity"
      | "strong_answer"
      | "neutral_answer"
      | "too_long"
    >;
  } = {},
): EmotionalMemoryState {
  const memorySignals = overrides.memorySignals ?? [];

  return {
    ...initialEmotionalMemory,
    ...overrides,
    repeatedWeaknesses:
      overrides.repeatedWeaknesses ??
      memorySignals.filter(
        (signal) =>
          signal === "vague_answer" ||
          signal === "missing_metrics" ||
          signal === "weak_clarity",
      ),
    memories:
      overrides.memories ??
      memorySignals.map((signal, index) => ({
        id: `test-memory-${index + 1}`,
        signal,
        summary: `Previous ${signal.replace(/_/g, " ")} pattern`,
        timestamp: Date.now() - (index + 1) * 1000,
      })),
  } as EmotionalMemoryState;
}

function printScenario(result: ReturnType<typeof runRecruiterRuntime>) {
  console.log("Runtime decision:", result.runtimeDecision);
  console.log("State:", result.state);
  console.log("Mood:", result.mood);
  console.log("Pressure:", result.pressureLevel);
  console.log("Trust:", result.trust);
  console.log("Trust trend:", result.trustTrend);
  console.log("Patience:", result.patienceLevel);
  console.log("Patience trend:", result.patienceTrend);
  console.log("Hesitation:", result.hesitationLevel);
  console.log("Conversation drift:", result.conversationDrift);
  console.log("Emotional uncertainty:", result.emotionalUncertainty);
  console.log("Follow-up momentum:", result.followupMomentum);
  console.log("Self-correction:", result.shouldSelfCorrect);
  console.log("Self-correction style:", result.selfCorrectionStyle ?? "none");
  console.log("Self-correction line:", result.selfCorrectionLine || "none");
  console.log("Engagement:", result.engagementLevel);
  console.log("Curiosity:", result.curiosityLevel);
  console.log("Silent judgment:", result.silentJudgment);
  console.log("Mental checkout risk:", result.mentalCheckoutRisk);
  console.log("Engagement trend:", result.engagementTrend);
  console.log("Internal emotion:", result.internalEmotion);
  console.log("Visible emotion:", result.visibleEmotion);
  console.log("Masking strength:", result.maskingStrength);
  console.log("Professional containment:", result.professionalContainment);
  console.log("Emotional leakage:", result.emotionalLeakage);
  console.log("Emotional momentum:", result.emotionalMomentum);
  console.log("Recovery resistance:", result.recoveryResistance);
  console.log("Skepticism carryover:", result.skepticismCarryover);
  console.log("Engagement inertia:", result.engagementInertia);
  console.log("Confidence:", result.confidence);
  console.log("Interest:", result.interest);
  console.log("Should interrupt:", result.interruption.shouldInterrupt);
  console.log("Interruption severity:", result.interruption.severity ?? "none");
  console.log("Memory line:", result.memoryLine || "none");
  console.log("Micro reaction:", result.microReaction || "none");
  console.log("Suggested line:", result.suggestedLine);

  const lines = Array.isArray(result.reactionLines) ? result.reactionLines : [];
  console.log("Reaction lines:");
  if (!lines.length) {
    console.log("  none");
  } else {
    lines.forEach((line: string, index: number) => {
      console.log(`  ${index + 1}. ${line}`);
    });
  }
}

function runScenario(scenario: Scenario) {
  divider();
  console.log(`Scenario: ${scenario.label}`);
  console.log(`Expected: ${scenario.expected}`);
  divider();

  const result = runRecruiterRuntime({
    recruiterId: scenario.recruiterId ?? "analytical_hiring_manager",
    answer: scenario.answer,
    score: scenario.score ?? 65,
    pressureLevel: scenario.pressureLevel ?? 50,
    memory: scenario.memory,
    turnIndex: scenario.turnIndex ?? 1,
  });

  printScenario(result);
}

function runPersonalityBlock() {
  divider();
  console.log("Scenario: Personality-aware micro reactions");
  console.log(
    "Expected: Daniel, Sarah, Priya, and Markus should react differently to the same vague answer.",
  );
  divider();

  const recruiters: Array<{ label: string; id: RecruiterId }> = [
    { label: "Daniel", id: "analytical_hiring_manager" },
    { label: "Sarah", id: "friendly_hr" },
    { label: "Priya", id: "startup_recruiter" },
    { label: "Markus", id: "german_corporate" },
  ];

  for (const recruiter of recruiters) {
    const result = runRecruiterRuntime({
      recruiterId: recruiter.id,
      answer:
        "I worked on several projects and handled different responsibilities, but I do not remember the exact impact or numbers.",
      score: 55,
      pressureLevel: 70,
      turnIndex: 1,
    });

    console.log(`\n${recruiter.label}`);
    console.log("Micro reaction:", result.microReaction || "none");
    console.log("Conversation drift:", result.conversationDrift);
    console.log("Engagement:", result.engagementLevel);
    console.log("Silent judgment:", result.silentJudgment);
    console.log("Visible emotion:", result.visibleEmotion);
    console.log("Masking strength:", result.maskingStrength);
    console.log("Emotional momentum:", result.emotionalMomentum);
    console.log("Engagement inertia:", result.engagementInertia);
    console.log("Suggested line:", result.suggestedLine);

    const lines = Array.isArray(result.reactionLines)
      ? result.reactionLines
      : [];
    if (lines.length) {
      console.log("Reaction lines:");
      lines.forEach((line: string, index: number) => {
        console.log(`  ${index + 1}. ${line}`);
      });
    }
  }
}

function runRuntimeTest() {
  const scenarios: Scenario[] = [
    {
      label: "Vague answer without metrics",
      expected:
        "Recruiter should become skeptical or pressuring and ask for specifics/metrics.",
      answer:
        "I worked on several projects and handled different responsibilities, but I do not remember the exact impact or numbers.",
      score: 55,
      pressureLevel: 60,
      turnIndex: 1,
    },
    {
      label: "Repeated vague answer under high pressure",
      expected:
        "Recruiter should interrupt because the candidate is repeating the same vague pattern under high pressure.",
      answer:
        "As I said, I handled many things and worked on various tasks. I always try to do my best and help when needed.",
      score: 48,
      pressureLevel: 92,
      turnIndex: 3,
      memory: makeMemory({
        trust: 47,
        confidence: 58,
        interest: 64,
        memorySignals: ["vague_answer", "missing_metrics"],
      }),
    },
    {
      label: "Concrete example",
      expected:
        "Recruiter should show interest and ask a deeper follow-up, not reset the question.",
      answer:
        "One user could not access the platform. I checked the login flow, verified the account settings, guided the user step by step, documented the issue, and restored access.",
      score: 72,
      pressureLevel: 42,
      turnIndex: 2,
    },
    {
      label: "Strong recovery after previous vague answers",
      expected:
        "Recruiter should soften and acknowledge recovery after a stronger, measurable answer.",
      answer:
        "I documented the repeated login issue, created a checklist for the team, and shared the fix steps. It helped the next teammate resolve a similar case around 20% faster and avoided repeating the same troubleshooting steps.",
      score: 86,
      pressureLevel: 72,
      turnIndex: 4,
      memory: makeMemory({
        trust: 43,
        confidence: 54,
        interest: 62,
        memorySignals: ["vague_answer", "missing_metrics"],
      }),
    },
    {
      label: "Strong answer with measurable impact",
      expected:
        "Recruiter should be impressed or interested and reduce pressure.",
      answer:
        "I created a checklist for a repeated workflow issue. It reduced handling time by around 20% and helped newer teammates solve similar cases faster.",
      score: 88,
      pressureLevel: 50,
      turnIndex: 2,
    },
    {
      label: "Rambling answer under pressure",
      expected:
        "Recruiter may interrupt or redirect because the answer is broad and overloaded.",
      answer:
        "There were many situations where I handled different responsibilities and sometimes the issues were technical and sometimes non technical and sometimes the process was long and I had to do many things with different tools and different people and overall I think it helped me learn a lot and become better with communication and execution.",
      score: 52,
      pressureLevel: 84,
      turnIndex: 3,
    },
    {
      label: "Conversation drift after rambling unclear answer",
      expected:
        "Recruiter should hesitate, lose the thread slightly, and redirect the answer instead of sounding perfectly scripted.",
      answer:
        "I worked on several things and then there was one project and also another task and I was involved in different parts with different people and tools and the process was long and I think it helped overall but I am not sure exactly what changed at the end.",
      score: 44,
      pressureLevel: 78,
      turnIndex: 4,
      memory: makeMemory({
        trust: 46,
        confidence: 52,
        interest: 58,
        memorySignals: ["vague_answer", "missing_metrics"],
      }),
    },
    {
      label: "Cognitive self-correction after confused answer",
      expected:
        "Recruiter should correct itself mid-thought and reframe the question like a human interviewer.",
      answer:
        "I did a lot of work across many tasks and then there were different things happening with different people and different outcomes and it is hard to explain but overall I helped and learned a lot from it.",
      score: 45,
      pressureLevel: 78,
      turnIndex: 4,
      memory: makeMemory({
        trust: 38,
        confidence: 50,
        interest: 55,
        memorySignals: ["vague_answer", "missing_metrics"],
      }),
    },
    {
      label: "Engagement decay and silent judgment",
      expected:
        "Recruiter should lose curiosity, show silent judgment, and risk mentally checking out after repeated weak answers.",
      answer:
        "I worked on many things and helped in different areas. I do not remember the exact result, and I cannot explain the specific impact, but I was involved in several responsibilities.",
      score: 32,
      pressureLevel: 90,
      turnIndex: 6,
      memory: makeMemory({
        trust: 24,
        confidence: 34,
        interest: 28,
        repeatedWeaknesses: ["vague_answer", "missing_metrics", "weak_clarity"],
        memorySignals: ["vague_answer", "missing_metrics", "weak_clarity"],
      }),
    },
    {
      label: "Professional masking under silent judgment",
      expected:
        "Recruiter should internally disengage but externally stay professionally contained.",
      answer:
        "I did many things across projects and helped in many areas, but I cannot explain the exact result, ownership, or numbers because it was all part of the team's work.",
      score: 28,
      pressureLevel: 93,
      turnIndex: 7,
      memory: makeMemory({
        trust: 18,
        confidence: 34,
        interest: 30,
        repeatedWeaknesses: ["vague_answer", "missing_metrics", "weak_clarity"],
      }),
    },
    {
      label: "Patience exhaustion after repeated weak answers",
      expected:
        "Recruiter patience should become exhausted when repeated vague patterns continue under very high pressure.",
      answer:
        "I handled many different things and worked on various tasks. I do not remember the exact result, but I always tried to help and be responsible.",
      score: 38,
      pressureLevel: 94,
      turnIndex: 5,
      memory: makeMemory({
        trust: 28,
        confidence: 36,
        interest: 42,
        repeatedWeaknesses: ["vague_answer", "missing_metrics", "weak_clarity"],
        memorySignals: ["vague_answer", "missing_metrics", "weak_clarity"],
      }),
    },
  ];

  scenarios.forEach(runScenario);
  runPersonalityBlock();

  console.log(
    "\n✅ Recruiter runtime isolated test completed.\nNo AI voice, no browser speech, no interview page changes. This test only validates recruiter runtime behavior.",
  );
}

runRuntimeTest();
