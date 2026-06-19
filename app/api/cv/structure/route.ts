import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { parseResumeWithAiStructure } from "@/lib/workzoAiCvParser";
import {
  extractResumeProfile,
  sanitizeResumeProfileIdentity,
} from "@/lib/workzoResumeParser";
import { enforceCanonicalCandidateName } from "@/lib/workzoResumeProfileManager";

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
  candidateName: string;
  reason: string;
}) {
  const rawText = input.layoutText || input.cvText;
  const parsedProfile = extractResumeProfile(rawText);
  const resumeProfile = enforceCanonicalCandidateName(
    sanitizeResumeProfileIdentity(parsedProfile, {
      rawText,
      fileName: input.fileName,
    }),
    rawText,
    input.fileName,
    input.candidateName,
  );

  return {
    ok: true,
    source: "deterministic_fallback",
    candidateName: resumeProfile.basics?.name || "",
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
  // â”€â”€ Auth gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const body = await request.json().catch(() => null);

  const cvText =
    readString(body?.cvText) || readString(body?.text) || readString(body?.content);

  const layoutText = readString(body?.layoutText);

  const jobDescription =
    readString(body?.jobDescription) || readString(body?.jdText);

  const targetRole = readString(body?.targetRole) || "General Role";
  const targetMarket = readString(body?.targetMarket) || "Global";
  const fileName = readString(body?.fileName);
  // candidateName: previously resolved name from an earlier upload parse.
  // When the client already knows the correct name (e.g. from the file-upload parse),
  // it passes it here so the structure route uses it instead of re-deriving a wrong name
  // from a pasted-text CV that lacks reliable header signals.
  const candidateName = readString(body?.candidateName);

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
      const resumeProfile = enforceCanonicalCandidateName(
        sanitizeResumeProfileIdentity(result.resumeProfile, {
          rawText: layoutText || cvText,
          fileName,
        }),
        layoutText || cvText,
        fileName,
        candidateName,
      );

      return NextResponse.json({
        ...result,
        ok: result.ok !== false,
        candidateName: resumeProfile.basics?.name || "",
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
        candidateName,
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
        candidateName,
        reason:
          error instanceof Error
            ? error.message
            : "AI CV structuring failed, so WorkZo used the deterministic CV parser.",
      }),
    );
  }
}