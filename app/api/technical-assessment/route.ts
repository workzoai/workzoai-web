import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import {
  buildTechnicalAssessment,
  scoreMultipleChoice,
  buildTechnicalEvalPrompt,
  aggregateTechnicalResults,
  detectRoleCluster,
  type TechnicalQuestion,
  type TechnicalAnswerResult,
} from "@/lib/workzoTechnicalAssessmentEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/technical-assessment?role=Data+Analyst&difficulty=intermediate
// Returns the assessment plan (questions only, no correct answers)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetRole = searchParams.get("role") || "General";
    const cvText = searchParams.get("cv") || "";
    const difficulty = (searchParams.get("difficulty") as "foundational" | "intermediate" | "advanced") || undefined;
    const maxQ = parseInt(searchParams.get("max") || "5", 10);

    const resolvedPlan = await resolveWorkZoServerPlan();
    const plan = resolvedPlan.plan;
    // Free: 3 MCQ-only foundational questions. Premium: full assessment.
    const cappedMax = plan === "free" ? 3 : Math.min(maxQ, 8);
    const cappedDifficulty = plan === "free" ? "foundational" : difficulty;

    const assessment = buildTechnicalAssessment({
      targetRole,
      cvText,
      difficulty: cappedDifficulty,
      maxQuestions: cappedMax,
    });

    // Strip correct answers from MCQ before sending to client
    const sanitized = {
      ...assessment,
      questions: assessment.questions.map((q) => ({
        ...q,
        correctOption: undefined, // never expose to client
      })),
    };

    return NextResponse.json({ ok: true, assessment: sanitized });
  } catch (error) {
    console.error("[technical-assessment GET]", error);
    return NextResponse.json({ ok: false, error: "Failed to build assessment" }, { status: 500 });
  }
}

// POST /api/technical-assessment
// Body: { targetRole, answers: [{ questionId, skill, type, question, context, scoringGuide, selectedOption?, openAnswer?, timeSeconds }] }
// Returns: TechnicalAssessmentResult
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      targetRole = "General",
      cvText = "",
      answers = [],
    } = body as {
      targetRole?: string;
      cvText?: string;
      answers?: Array<{
        questionId: string;
        skill: string;
        type: string;
        question: string;
        context?: string;
        scoringGuide: string;
        difficulty: string;
        selectedOption?: number;
        openAnswer?: string;
        timeSeconds?: number;
      }>;
    };

    if (!answers.length) {
      return NextResponse.json({ ok: false, error: "No answers provided" }, { status: 400 });
    }

    const resolvedPlan = await resolveWorkZoServerPlan();
    const plan = resolvedPlan.plan;
    const cluster = detectRoleCluster(targetRole);

    // Score each answer
    const results: TechnicalAnswerResult[] = [];

    for (const answer of answers) {
      const question: TechnicalQuestion = {
        id: answer.questionId,
        skill: answer.skill,
        type: answer.type as TechnicalQuestion["type"],
        difficulty: answer.difficulty as TechnicalQuestion["difficulty"],
        question: answer.question,
        context: answer.context,
        scoringGuide: answer.scoringGuide,
        timeSeconds: answer.timeSeconds || 120,
      };

      if (answer.type === "multiple_choice" && answer.selectedOption !== undefined) {
        // Re-build the question with correct answer from server-side (not trusted from client)
        // We re-run detectRoleCluster to get the canonical question with correctOption
        const serverAssessment = buildTechnicalAssessment({ targetRole, cvText, maxQuestions: 20 });
        const serverQ = serverAssessment.questions.find((q) => q.id === answer.questionId);
        if (serverQ && serverQ.correctOption !== undefined) {
          results.push(scoreMultipleChoice(serverQ, answer.selectedOption));
        } else {
          // Fallback: trust client answer for unknown question IDs
          results.push({
            questionId: answer.questionId,
            skill: answer.skill,
            score: 50,
            passed: false,
            feedback: "Question could not be verified server-side.",
            strengths: [],
            gaps: ["Verify your answer against the scoring guide."],
          });
        }
        continue;
      }

      // Open text / SQL / code / scenario — LLM score
      const openText = String(answer.openAnswer || "").trim();
      if (!openText) {
        results.push({
          questionId: answer.questionId,
          skill: answer.skill,
          score: 0,
          passed: false,
          feedback: "No answer provided.",
          strengths: [],
          gaps: [`${answer.skill} — no answer submitted.`],
        });
        continue;
      }

      // Free plan: skip LLM scoring, use pattern-based only
      if (plan === "free") {
        const wordCount = openText.split(/\s+/).filter(Boolean).length;
        const hasContent = wordCount >= 15;
        results.push({
          questionId: answer.questionId,
          skill: answer.skill,
          score: hasContent ? 55 : 20,
          passed: hasContent,
          feedback: hasContent
            ? "Answer captured. Upgrade to Premium for detailed AI scoring."
            : "Answer too short to evaluate.",
          strengths: hasContent ? ["Answer submitted."] : [],
          gaps: ["Upgrade to Premium for detailed AI-powered scoring of open answers."],
        });
        continue;
      }

      // Premium: LLM scoring
      try {
        const evalPrompt = buildTechnicalEvalPrompt(question, openText, targetRole);

        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 500,
            temperature: 0.3,
            messages: [
              { role: "system", content: "You are a senior technical evaluator. Respond only with valid JSON." },
              { role: "user", content: evalPrompt },
            ],
          }),
        });

        if (!openaiResponse.ok) throw new Error(`OpenAI ${openaiResponse.status}`);

        const llmData = await openaiResponse.json();
        const raw = llmData.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

        results.push({
          questionId: answer.questionId,
          skill: answer.skill,
          score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 50,
          passed: parsed.passed === true || (typeof parsed.score === "number" && parsed.score >= 60),
          feedback: String(parsed.feedback || "Evaluated."),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
          gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3) : [],
        });
      } catch (err) {
        console.warn("[technical-assessment] LLM scoring failed for", answer.questionId, err);
        results.push({
          questionId: answer.questionId,
          skill: answer.skill,
          score: 50,
          passed: false,
          feedback: "Scoring encountered an error. Answer was recorded.",
          strengths: [],
          gaps: ["Review your answer manually against the scoring guide."],
        });
      }
    }

    // Build the assessment shell to pass to aggregator
    const assessment = buildTechnicalAssessment({ targetRole, cvText, maxQuestions: answers.length });
    const finalResult = aggregateTechnicalResults(assessment, results);

    return NextResponse.json({ ok: true, result: finalResult });
  } catch (error) {
    console.error("[technical-assessment POST]", error);
    return NextResponse.json({ ok: false, error: "Assessment scoring failed" }, { status: 500 });
  }
}
