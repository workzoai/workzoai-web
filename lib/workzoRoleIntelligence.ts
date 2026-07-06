/**
 * lib/workzoRoleIntelligence.ts
 *
 * Universal role knowledge engine.
 *
 * Rather than hardcoding knowledge for 7 roles, this uses GPT-4o to generate
 * a role intelligence brief for ANY role the user targets, Customer Success Manager,
 * Nurse, Quantity Surveyor, Kindergarten Teacher, DevOps Engineer, anything.
 *
 * The brief is generated ONCE at interview setup, cached per session, and injected
 * into the recruiter system prompt so the interviewer knows the domain deeply.
 *
 * This is what makes WorkZo feel like the recruiter actually knows your industry.
 */

import OpenAI from "openai";

export type RoleIntelligenceBrief = {
  role: string;
  corePurpose: string;                    // What this role actually does, in one sentence
  keyCompetencies: string[];              // 5-8 things a strong hire must demonstrate
  commonWeaknesses: string[];             // What weak candidates typically fail to show
  interviewProbes: string[];              // 6-10 questions real interviewers ask for this role
  redFlags: string[];                     // Answers that should trigger deeper probing
  greenFlags: string[];                   // Signals of a genuinely strong candidate
  cvToRoleGapSignals: string[];           // What to check when CV background doesn't match
  roleKnowledgeContext: string;           // 2-3 sentences the recruiter uses to sound knowledgeable
  companyContextAdaptations?: string;     // How company type/context changes the interview focus
  generatedFor: string;
  source: "ai" | "fallback";
};

function cleanText(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

const ROLE_BRIEF_CACHE = new Map<string, { brief: RoleIntelligenceBrief; ts: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes per process

function cacheKey(role: string, companyContext: string): string {
  return `${role.toLowerCase().slice(0, 80)}:::${companyContext.toLowerCase().slice(0, 60)}`;
}

/**
 * Generates a role intelligence brief using GPT-4o.
 * This gives the recruiter genuine domain knowledge for any role in any industry.
 */
async function generateRoleBriefWithAI(
  role: string,
  jobDescription: string,
  companyContext: string,
  market: string,
): Promise<RoleIntelligenceBrief> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const contextBlock = [
    jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}` : "",
    companyContext ? `COMPANY CONTEXT:\n${companyContext.slice(0, 1000)}` : "",
    market ? `TARGET MARKET: ${market}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = `You are a senior recruiting expert with deep knowledge of every industry.
Generate a role intelligence brief for a recruiter who is about to interview a candidate for the role of: ${role}

${contextBlock || "No additional context provided."}

Return ONLY valid JSON with this exact structure:
{
  "corePurpose": "One sentence: what this role fundamentally exists to do",
  "keyCompetencies": ["competency 1", "competency 2", ...],
  "commonWeaknesses": ["weakness 1", "weakness 2", ...],
  "interviewProbes": ["probe question 1", "probe question 2", ...],
  "redFlags": ["red flag answer pattern 1", ...],
  "greenFlags": ["strong signal 1", ...],
  "cvToRoleGapSignals": ["what to probe when CV is from adjacent field", ...],
  "roleKnowledgeContext": "2-3 sentences the recruiter can use to demonstrate domain knowledge",
  "companyContextAdaptations": "How the specific company context (if provided) changes interview focus"
}

Rules:
- keyCompetencies: 5-8 items. Specific to THIS role, not generic.
- commonWeaknesses: 4-6 things weak candidates typically fail to demonstrate.
- interviewProbes: 6-10 real questions used in actual interviews for this role. Natural phrasing, not generic.
- redFlags: 4-6 answer patterns that signal a weak or dishonest candidate.
- greenFlags: 4-6 signals that indicate a genuinely strong candidate.
- cvToRoleGapSignals: 3-5 specific things to probe when the candidate is transitioning from an adjacent field.
- roleKnowledgeContext: Write this so the recruiter sounds genuinely knowledgeable about the domain, not a generic description.
- If this is a niche role (nurse, pilot, quantity surveyor, chef, teacher), use real industry knowledge.
- If JD is provided, tailor ALL answers to the specific requirements in that JD.
- If market is Germany/DACH, include awareness of German work culture and expectations.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);

  return {
    role,
    corePurpose: cleanText(parsed.corePurpose, 300),
    keyCompetencies: Array.isArray(parsed.keyCompetencies) ? parsed.keyCompetencies.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 8) : [],
    commonWeaknesses: Array.isArray(parsed.commonWeaknesses) ? parsed.commonWeaknesses.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 6) : [],
    interviewProbes: Array.isArray(parsed.interviewProbes) ? parsed.interviewProbes.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 10) : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 6) : [],
    greenFlags: Array.isArray(parsed.greenFlags) ? parsed.greenFlags.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 6) : [],
    cvToRoleGapSignals: Array.isArray(parsed.cvToRoleGapSignals) ? parsed.cvToRoleGapSignals.map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 5) : [],
    roleKnowledgeContext: cleanText(parsed.roleKnowledgeContext, 600),
    companyContextAdaptations: cleanText(parsed.companyContextAdaptations, 400),
    generatedFor: role,
    source: "ai",
  };
}

/**
 * Fallback brief when AI is unavailable, generic but better than nothing.
 */
function buildFallbackBrief(role: string): RoleIntelligenceBrief {
  return {
    role,
    corePurpose: `Deliver strong results in the ${role} function with clear ownership and measurable impact.`,
    keyCompetencies: [
      "Specific ownership of real outcomes",
      "Clear communication under pressure",
      "Evidence-based problem solving",
      "Adaptability to changing requirements",
      "Stakeholder or customer management",
    ],
    commonWeaknesses: [
      "Vague answers that describe team work rather than personal contribution",
      "No measurable outcomes or impact",
      "Inability to describe a specific difficult situation",
    ],
    interviewProbes: [
      "Tell me about a time you personally owned a difficult outcome in this role.",
      "What is the hardest problem you solved in this kind of work?",
      "Give me a specific example where your decision changed something measurable.",
      "What would you do differently now, looking back?",
      "How do you prioritize when multiple things need attention at once?",
    ],
    redFlags: [
      "Only describes team achievements, never personal ownership",
      "Cannot name a specific difficult situation",
      "No measurable outcome for any example",
    ],
    greenFlags: [
      "Uses 'I' to describe personal decisions and ownership",
      "Gives specific situations with clear outcomes",
      "Shows awareness of where they could improve",
    ],
    cvToRoleGapSignals: [
      "Ask what they have done to close the gap between their background and this role",
      "Probe for transferable skills with specific examples",
      "Ask about self-study, courses, or projects in the new domain",
    ],
    roleKnowledgeContext: `The ${role} role requires demonstrated ownership, clear communication, and evidence of real impact. Strong candidates speak specifically about decisions they made and outcomes they drove.`,
    companyContextAdaptations: "",
    generatedFor: role,
    source: "fallback",
  };
}

/**
 * Main export: get role intelligence brief for any role.
 * Cached per session. Falls back gracefully if AI unavailable.
 */
export async function getRoleIntelligenceBrief(input: {
  role: string;
  jobDescription?: string;
  companyContext?: string;
  market?: string;
}): Promise<RoleIntelligenceBrief> {
  const role = cleanText(input.role, 100);
  if (!role) return buildFallbackBrief("this role");

  const companyCtx = cleanText(input.companyContext, 800);
  const jd = cleanText(input.jobDescription, 3000);
  const market = cleanText(input.market, 80);

  // Check cache
  const key = cacheKey(role, companyCtx);
  const cached = ROLE_BRIEF_CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.brief;
  }

  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackBrief(role);
  }

  try {
    const brief = await generateRoleBriefWithAI(role, jd, companyCtx, market);
    ROLE_BRIEF_CACHE.set(key, { brief, ts: Date.now() });
    // Evict oldest if cache grows large
    if (ROLE_BRIEF_CACHE.size > 100) {
      const oldest = [...ROLE_BRIEF_CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) ROLE_BRIEF_CACHE.delete(oldest[0]);
    }
    return brief;
  } catch (err) {
    console.error("[RoleIntelligence] AI brief generation failed:", err);
    return buildFallbackBrief(role);
  }
}

/**
 * Serializes a role brief into a prompt-ready string.
 * Injected into the recruiter system prompt before each interview.
 */
export function serializeRoleBriefForPrompt(brief: RoleIntelligenceBrief): string {
  if (!brief.role || brief.source === "fallback") return "";

  const lines: string[] = [
    `=== ROLE INTELLIGENCE: ${brief.role.toUpperCase()} ===`,
    `Core purpose: ${brief.corePurpose}`,
    "",
    `Key competencies to assess:`,
    ...brief.keyCompetencies.map(c => `  - ${c}`),
    "",
    `Proven interview probes for this role:`,
    ...brief.interviewProbes.map(p => `  - ${p}`),
    "",
    `Red flags (probe deeper if you hear these):`,
    ...brief.redFlags.map(r => `  - ${r}`),
    "",
    `Green flags (genuine strength signals):`,
    ...brief.greenFlags.map(g => `  - ${g}`),
    "",
    `Common weaknesses in candidates for this role:`,
    ...brief.commonWeaknesses.map(w => `  - ${w}`),
    "",
    `When CV background differs from this role, probe:`,
    ...brief.cvToRoleGapSignals.map(s => `  - ${s}`),
    "",
    `Recruiter domain knowledge context:`,
    brief.roleKnowledgeContext,
  ];

  if (brief.companyContextAdaptations) {
    lines.push("", `Company-specific interview focus:`, brief.companyContextAdaptations);
  }

  lines.push("=== END ROLE INTELLIGENCE ===");
  return lines.join("\n");
}
