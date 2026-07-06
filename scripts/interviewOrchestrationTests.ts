/**
 * scripts/interviewOrchestrationTests.ts
 *
 * Verifies the Global Interview Engine mechanisms are structural, not
 * transcript-specific: follow-up budget, coverage ledger, phrase ledger, and
 * closing sequence must behave identically across roles (support, sales,
 * engineering, PM) and languages (English, German).
 *
 * Run: npx tsx scripts/interviewOrchestrationTests.ts
 */

import {
  createRecruiterMemoryV2,
  updateRecruiterMemoryV2,
  buildRecruiterDirectivesV2,
  type RecruiterMemoryV2,
  type TranscriptItem,
} from "../lib/workzoRecruiterIntelligenceV2";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) passed += 1;
  else { failed += 1; failures.push(`✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

/** Simulate N turns of weak answers that never advance the topic. */
function simulateStalledTopic(setup: Record<string, string>, weakAnswer: string, turns: number): RecruiterMemoryV2 {
  let memory = createRecruiterMemoryV2();
  for (let i = 0; i < turns; i += 1) {
    memory = updateRecruiterMemoryV2(memory, weakAnswer, setup);
  }
  return memory;
}

// ── 1. Follow-up budget: stalled topic is force-advanced after 3 turns ──────
{
  const setup = { targetRole: "Customer Success Manager", jobDescription: "Customer communication, escalation, stakeholder management." };
  const weak = "Yeah I mean I just did my job you know."; // <15 words → never advances
  const m2 = simulateStalledTopic(setup, weak, 2);
  const m3 = simulateStalledTopic(setup, weak, 3);
  check("1 stalled at 2 turns → no force yet", m2.forcedTopicAdvanceFrom === "" && m2.followUpCount === 2, JSON.stringify({ f: m2.followUpCount, forced: m2.forcedTopicAdvanceFrom }));
  check("1 stalled at 3 turns → forced advance", m3.forcedTopicAdvanceFrom !== "", JSON.stringify({ forced: m3.forcedTopicAdvanceFrom }));
  check("1 forced topic is locked", m3.answeredCompetencies.includes(m3.interviewTopicOrder[0]));
  check("1 topic index moved", m3.currentTopicIndex > 0, `index ${m3.currentTopicIndex}`);
  check("1 counter reset after force", m3.followUpCount === 0);
}

// ── 2. Same mechanism, different role (engineering) — role independence ─────
{
  const setup = { targetRole: "Backend Software Engineer", jobDescription: "Microservices, Kubernetes, PostgreSQL, system design." };
  const m3 = simulateStalledTopic(setup, "Hmm, not sure really.", 3);
  check("2 engineering role also force-advances", m3.forcedTopicAdvanceFrom !== "" && m3.currentTopicIndex > 0);
}

// ── 3. Language independence (German answers) ───────────────────────────────
{
  const setup = { targetRole: "Vertriebsmitarbeiter", jobDescription: "Vertrieb, Pipeline, Kundenbeziehungen, Abschlussquote.", language: "German" };
  const weakDe = "Ja, ich habe einfach meine Arbeit gemacht."; // 7 words, no English keywords
  const m3 = simulateStalledTopic(setup, weakDe, 3);
  check("3 German interview force-advances identically", m3.forcedTopicAdvanceFrom !== "" && m3.currentTopicIndex > 0, JSON.stringify({ forced: m3.forcedTopicAdvanceFrom, idx: m3.currentTopicIndex }));
}

// ── 4. Good answers advance naturally — budget never fires ──────────────────
{
  const setup = { targetRole: "Customer Success Manager", jobDescription: "Customer communication, escalation." };
  let memory = createRecruiterMemoryV2();
  const strongAnswers = [
    "I have six years of experience as a customer success manager working with enterprise clients, handling onboarding, renewals, and executive relationships across two companies.",
    "One escalation involved a frustrated client whose integration failed. I personally took ownership, coordinated with engineering, kept the customer updated daily, and we resolved it within the SLA — the client renewed and CSAT improved to 98%.",
    "I led the quarterly business reviews with stakeholders from three departments, aligned expectations with their leadership team, and communicated progress to executives on both sides.",
  ];
  for (const a of strongAnswers) memory = updateRecruiterMemoryV2(memory, a, setup);
  check("4 strong answers → multiple topics covered", memory.answeredCompetencies.length >= 3, `covered: ${memory.answeredCompetencies.join(",")}`);
  check("4 no forced advance on good flow", memory.forcedTopicAdvanceFrom === "");
}

// ── 5. Directives: forced-advance produces MUST-MOVE-ON instruction ─────────
{
  const setup = { targetRole: "Customer Success Manager" };
  const m3 = simulateStalledTopic(setup, "Yeah I mean I just did my job you know.", 3);
  const { directives } = buildRecruiterDirectivesV2({ memory: m3, transcript: [], setup });
  check("5 directive names the exhausted topic", directives.includes("FOLLOW-UP LIMIT REACHED"), directives.slice(0, 120));
  check("5 directive forbids returning to it", /forbidden/i.test(directives));
}

// ── 6. Phrase ledger: openers collected from transcript, any language ────────
{
  const transcript: TranscriptItem[] = [
    { role: "recruiter", text: "Let's be specific. What exactly did you own?" },
    { role: "candidate", text: "I owned the resolution process end to end." },
    { role: "recruiter", text: "Let's be specific. What was the measurable outcome?" },
    { role: "candidate", text: "CSAT improved to 96%." },
    { role: "recruiter", text: "Können Sie mir ein konkretes Beispiel geben?" },
  ];
  const { directives, memory } = buildRecruiterDirectivesV2({ memory: createRecruiterMemoryV2(), transcript, setup: {} });
  check("6 openers captured", memory.usedOpeners.length >= 2, JSON.stringify(memory.usedOpeners));
  check("6 duplicate opener stored once", memory.usedOpeners.filter((o) => o.replace(/'/g, "").startsWith("lets be specific")).length === 1, JSON.stringify(memory.usedOpeners));
  check("6 German opener captured too", memory.usedOpeners.some((o) => o.startsWith("können sie mir")), JSON.stringify(memory.usedOpeners));
  check("6 directive forbids reuse", directives.includes("never begin a reply with any of these again"));
  check("6 style variation suggested", /walk-me-through|hypothetical|look-back|quantification|trade-off|contrast/.test(directives));
}

// ── 7. Closing sequence: staged, never abrupt ────────────────────────────────
{
  const setup = { targetRole: "Product Manager" };
  // All topics answered → closing should start.
  let memory = createRecruiterMemoryV2();
  memory = updateRecruiterMemoryV2(memory, "intro", setup); // initialise roadmap
  const allTopics = memory.interviewTopicOrder.filter((t) => t !== "closing");
  memory = createRecruiterMemoryV2({ ...memory, answeredCompetencies: allTopics });

  const step1 = buildRecruiterDirectivesV2({ memory, transcript: [], setup });
  check("7 step1 fires final-question directive", step1.directives.includes("STEP 1 of 3"), step1.directives.slice(0, 100));
  check("7 stage persisted as 1", step1.memory.closingStage === 1);

  const step2 = buildRecruiterDirectivesV2({ memory: step1.memory, transcript: [], setup });
  check("7 step2 invites candidate questions", step2.directives.includes("STEP 2 of 3") && /questions about the role or the company/i.test(step2.directives));

  const step3 = buildRecruiterDirectivesV2({ memory: step2.memory, transcript: [], setup });
  check("7 step3 closes with goodbye", step3.directives.includes("STEP 3 of 3") && /goodbye/i.test(step3.directives));
  check("7 stage caps at 3", buildRecruiterDirectivesV2({ memory: step3.memory, transcript: [], setup }).memory.closingStage === 3);
}

// ── 8. Closing also triggers on question budget, not only full coverage ─────
{
  const transcript: TranscriptItem[] = [];
  for (let i = 0; i < 10; i += 1) {
    transcript.push({ role: "recruiter", text: `Question number ${i + 1}, could you walk me through it?` });
    transcript.push({ role: "candidate", text: "Sure, here is my answer with some detail." });
  }
  const { memory } = buildRecruiterDirectivesV2({ memory: createRecruiterMemoryV2(), transcript, setup: {}, questionBudget: 12 });
  check("8 budget-based closing starts at budget-2", memory.closingStage === 1, `stage ${memory.closingStage}`);
  const early = buildRecruiterDirectivesV2({ memory: createRecruiterMemoryV2(), transcript: transcript.slice(0, 8), setup: {}, questionBudget: 12 });
  check("8 no closing mid-interview", early.memory.closingStage === 0, `stage ${early.memory.closingStage}`);
}

// ── 9. Coverage ledger renders locked/active/open states ────────────────────
{
  const setup = { targetRole: "Sales Director" };
  let memory = createRecruiterMemoryV2();
  memory = updateRecruiterMemoryV2(
    memory,
    "I have eight years of experience as a sales director leading enterprise account teams and carrying a direct quota across two companies.",
    setup,
  );
  const { directives } = buildRecruiterDirectivesV2({ memory, transcript: [], setup });
  check("9 ledger present", directives.includes("COMPETENCY COVERAGE LEDGER"));
  check("9 covered topic locked", /COVERED \(locked/.test(directives));
  check("9 open topics listed", directives.includes("NOT YET COVERED"));
  check("9 follow-up discipline stated", directives.includes("FOLLOW-UP DISCIPLINE"));
}

// ── 10. State round-trip survives JSON serialization (client persistence) ───
{
  const setup = { targetRole: "IT Support Specialist" };
  let memory = simulateStalledTopic(setup, "Yeah I mean I just did my job you know.", 2);
  const wire = JSON.parse(JSON.stringify(memory));
  const restored = createRecruiterMemoryV2(wire);
  check("10 followUpCount survives round-trip", restored.followUpCount === 2, `got ${restored.followUpCount}`);
  const m3 = updateRecruiterMemoryV2(restored, "Yeah I mean I just did my job you know.", setup);
  check("10 force-advance fires after round-trip", m3.forcedTopicAdvanceFrom !== "");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log(failures.join("\n")); process.exit(1); }
