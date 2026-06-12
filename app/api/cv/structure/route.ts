import { NextResponse } from "next/server";
import { parseResumeWithAiStructure } from "@/lib/workzoAiCvParser";
import {
  extractResumeProfile,
  sanitizeResumeProfileIdentity,
} from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildFallbackStructuredProfile(input: {
  cvText: string;
  layoutText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  fileName: string;
  reason: string;
}) {
  const rawText = input.layoutText || input.cvText;
  const parsedProfile = extractResumeProfile(rawText);
  const resumeProfile = sanitizeResumeProfileIdentity(parsedProfile, {
    rawText,
    fileName: input.fileName,
  });

  return {
    ok: true,
    source: "deterministic_fallback",
    warning: input.reason,
    resumeProfile,
    profile: resumeProfile,
    cvText: input.cvText,
    layoutText: input.layoutText,
    jobDescription: input.jobDescription,
    targetRole: input.targetRole,
    targetMarket: input.targetMarket,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const cvText =
    readString(body?.cvText) || readString(body?.text) || readString(body?.content);

  const layoutText = readString(body?.layoutText);

  const jobDescription =
    readString(body?.jobDescription) || readString(body?.jdText);

  const targetRole = readString(body?.targetRole) || "General Role";
  const targetMarket = readString(body?.targetMarket) || "Global";
  const fileName = readString(body?.fileName);

  if (!cvText && !layoutText) {
    return NextResponse.json(
      {
        ok: false,
        error: "CV text is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await parseResumeWithAiStructure({
      cvText,
      layoutText,
      jobDescription,
      targetRole,
      targetMarket,
    });

    if (result?.resumeProfile) {
      const resumeProfile = sanitizeResumeProfileIdentity(result.resumeProfile, {
        rawText: layoutText || cvText,
        fileName,
      });

      return NextResponse.json({
        ...result,
        ok: result.ok !== false,
        resumeProfile,
        profile: resumeProfile,
      });
    }

    return NextResponse.json(
      buildFallbackStructuredProfile({
        cvText,
        layoutText,
        jobDescription,
        targetRole,
        targetMarket,
        fileName,
        reason: "AI structure returned no resume profile, so WorkZo used the deterministic CV parser.",
      }),
    );
  } catch (error) {
    return NextResponse.json(
      buildFallbackStructuredProfile({
        cvText,
        layoutText,
        jobDescription,
        targetRole,
        targetMarket,
        fileName,
        reason:
          error instanceof Error
            ? error.message
            : "AI CV structuring failed, so WorkZo used the deterministic CV parser.",
      }),
    );
  }
}
