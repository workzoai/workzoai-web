import { NextRequest, NextResponse } from "next/server";
import { runWorkZoFreeTool, type FreeToolAction } from "@/lib/workzoFreeToolsEngine";
import { FREE_TOOLS, FREE_TOOL_ACTION_BY_SLUG } from "@/lib/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual aliases for friendly/legacy names, merged with the canonical
// slug -> action map derived from the global registry. Adding a tool to
// lib/free-tools.ts automatically makes its slug a valid action here.
const MANUAL_ALIASES: Record<string, FreeToolAction> = {
  cv_review: "cv_review",
  free_cv_review: "cv_review",
  resume_review: "cv_review",
  ai_resume_tailor: "resume_tailor",
  resume_tailor: "resume_tailor",
  tailor_resume: "resume_tailor",
  cover_letter: "cover_letter",
  cover_letter_generator: "cover_letter",
  interview_questions: "interview_questions",
  interview_question_generator: "interview_questions",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const ACTION_ALIASES: Record<string, FreeToolAction> = {
  ...MANUAL_ALIASES,
  // Registry slugs (e.g. "cv-review" -> "cv_review") become valid actions.
  ...Object.fromEntries(
    Object.entries(FREE_TOOL_ACTION_BY_SLUG).map(([slug, action]) => [normalize(slug), action]),
  ),
};

// GET returns the public tool registry so any client can render the same
// list the rest of the app uses — one source of truth, no duplication.
export async function GET() {
  return NextResponse.json({
    ok: true,
    tools: FREE_TOOLS.map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      href: tool.href,
      apiPath: tool.apiPath,
      action: tool.action,
      badge: tool.badge,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawAction = normalize(String(body?.action || body?.tool || ""));
    const action = ACTION_ALIASES[rawAction];

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_or_unknown_action",
          message: "Choose one free tool action: cv_review, resume_tailor, cover_letter, interview_questions.",
        },
        { status: 400 },
      );
    }

    const result = runWorkZoFreeTool(action, body?.input || body);
    return NextResponse.json(result, { status: result.ok === false ? 400 : 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not run free tool." },
      { status: 500 },
    );
  }
}
