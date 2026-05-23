import {
  runRecruiterRuntime,
  type RecruiterRuntimeInput,
  type RecruiterRuntimeOutput,
} from "./recruiterRuntimeOrchestrator";
import { initialEmotionalMemory } from "./emotionalMemoryEngine";

type RuntimeScenario = {
  label: string;
  input: RecruiterRuntimeInput;
  expectedDecisionHint: string;
};

function printRuntimeResult(
  scenario: RuntimeScenario,
  result: RecruiterRuntimeOutput,
) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Scenario: ${scenario.label}`);
  console.log(`Expected: ${scenario.expectedDecisionHint}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`State: ${result.state}`);
  console.log(`Mood: ${result.mood}`);
  console.log(`Pressure: ${result.pressureLevel}`);
  console.log(`Trust: ${result.trust}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Interest: ${result.interest}`);
  console.log(`Should interrupt: ${result.interruption.shouldInterrupt}`);
  console.log(`Interruption severity: ${result.interruption.severity ?? "none"}`);
  console.log(`Memory line: ${result.memoryLine ?? "none"}`);
  console.log(`Suggested line: ${result.suggestedLine}`);

  if (result.reactionLines.length > 0) {
    console.log(`Reaction lines:`);
    result.reactionLines.forEach((line, index) => {
      console.log(`  ${index + 1}. ${line}`);
    });
  }
}

function runRuntimeTests() {
  const baseMemory = initialEmotionalMemory;
  const repeatedWeaknessMemory = {
    ...initialEmotionalMemory,
    trust: 58,
    confidence: 58,
    interest: 64,
    repeatedWeaknesses: ["vague_answer", "missing_metrics"],
    memories: [
      {
        signal: "vague_answer" as const,
        message: "The previous answer was broad and did not show clear ownership.",
        timestamp: Date.now() - 90_000,
      },
      {
        signal: "missing_metrics" as const,
        message: "The previous answer did not include measurable impact.",
        timestamp: Date.now() - 60_000,
      },
    ],
  };

  const scenarios: RuntimeScenario[] = [
    {
      label: "Vague answer without metrics",
      expectedDecisionHint:
        "Recruiter should become skeptical or pressuring and ask for specifics/metrics.",
      input: {
        answer:
          "I am hardworking and passionate. I worked on customer issues and helped with many different things. I am a good communicator and a team player.",
        score: 42,
        pressureLevel: 62,
        memory: baseMemory,
      },
    },
    {
      label: "Repeated vague answer under high pressure",
      expectedDecisionHint:
        "Recruiter should interrupt because the candidate is repeating the same vague pattern under high pressure.",
      input: {
        answer:
          "I worked on many different things and helped with customer problems. I am good at handling people and I always try my best.",
        score: 44,
        pressureLevel: 82,
        memory: repeatedWeaknessMemory,
        turnIndex: 3,
      },
    },
    {
      label: "Concrete customer support example",
      expectedDecisionHint:
        "Recruiter should show interest and ask a deeper follow-up, not reset the question.",
      input: {
        answer:
          "A customer could not connect her Linksys router. I guided her step by step, opened the router IP page, checked the firmware, updated it, and helped restore the Wi-Fi connection.",
        score: 74,
        pressureLevel: 45,
        memory: baseMemory,
      },
    },
    {
      label: "Strong answer with measurable impact",
      expectedDecisionHint:
        "Recruiter should be impressed or interested and reduce pressure.",
      input: {
        answer:
          "I documented the repeated router firmware fix and shared it with the support team. It reduced repeat troubleshooting time by around 20 percent and helped newer agents resolve similar tickets faster.",
        score: 88,
        pressureLevel: 50,
        memory: baseMemory,
      },
    },
    {
      label: "Rambling answer under pressure",
      expectedDecisionHint:
        "Recruiter may interrupt or redirect because the answer is broad and overloaded.",
      input: {
        answer:
          "Basically I handled many customers, many different issues, many kinds of technical problems, and I was responsible for a lot of things across support and customers and different calls and sometimes it was difficult but I always tried my best and helped with whatever was needed.",
        score: 48,
        pressureLevel: 78,
        memory: baseMemory,
      },
    },
  ];

  for (const scenario of scenarios) {
    const result = runRecruiterRuntime(scenario.input);
    printRuntimeResult(scenario, result);
  }

  console.log(`\n✅ Recruiter runtime isolated test completed.`);
  console.log(
    `No Vapi, no browser speech, no interview page changes. This test only validates recruiter runtime behavior.`,
  );
}

runRuntimeTests();
