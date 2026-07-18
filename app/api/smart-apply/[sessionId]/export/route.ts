/*
 * app/api/smart-apply/[sessionId]/export/route.ts
 *
 * GET ?format=pdf|docx  download the session's tailored CV as a real file.
 *
 * The tailored profile was saved on the CV document when it was generated, so export
 * reads it back rather than regenerating (regenerating could drift from what the user
 * reviewed and approved). Both formats are built from the SAME ResumeProfile through
 * the SAME two dependency-free builders the rest of the app uses, so a PDF and a DOCX
 * of the same CV say the same thing.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { profileToStructuredCv } from "@/lib/smart-apply/exportProfile";
import { buildCvPdfBytes } from "@/lib/workzoCvPdf";
import { buildCvDocxBytes, DOCX_MIME } from "@/lib/smart-apply/buildCvDocx";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileStem(job: { title?: string; company?: string }): string {
  const raw = [job.company, job.title].filter(Boolean).join(" ") || "WorkZo CV";
  return raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60) || "WorkZo_CV";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply_documents");
  if (!ctx.ok) return ctx.response;

  const format = (request.nextUrl.searchParams.get("format") || "pdf").toLowerCase();
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ ok: false, error: "format must be pdf or docx" }, { status: 400 });
  }

  /*
   * The tailored profile lives on the CV document's payload. If the user has not
   * generated a tailored CV yet, there is nothing to export, and we say so rather
   * than exporting an empty file.
   */
  const doc = ctx.session.tailoredCv;
  const payload = (doc?.content || null) as { profile?: ResumeProfile } | null;
  const profile = payload?.profile || null;
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "no_cv", message: "Generate your tailored CV before exporting it." },
      { status: 409 },
    );
  }

  const targetRole = ctx.session.job.title || "";
  const stem = safeFileStem(ctx.session.job);

  try {
    if (format === "docx") {
      const bytes = buildCvDocxBytes(profile, targetRole);
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": DOCX_MIME,
          "Content-Disposition": `attachment; filename="${stem}.docx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // PDF: translate into the shape the existing generator understands, then render.
    // "ATS Classic" is the single-column, parser-friendly template, the right default
    // for a CV that is about to be read by an applicant tracking system.
    const structured = profileToStructuredCv(profile, {
      targetRole,
      blockedClaims: Array.isArray(doc?.evidenceWarnings) ? doc?.evidenceWarnings : [],
    });
    const bytes = buildCvPdfBytes(structured, "ATS Classic");
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[smart-apply] export failed", (err as Error)?.message);
    return NextResponse.json({ ok: false, error: "Could not build the file." }, { status: 500 });
  }
}
