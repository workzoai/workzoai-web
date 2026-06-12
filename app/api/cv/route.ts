import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createRequire } from "module";
import { extractResumeProfile, sanitizeResumeProfileIdentity } from "@/lib/workzoResumeParser";
import { cleanExtractedCvText, diagnoseCvLayout } from "@/lib/workzoCvPdfCleaner";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";

const require = createRequire(import.meta.url);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  fileName?: string;
  language?: string;
};

type PdfParseResult = {
  text?: string;
  numpages?: number;
  info?: unknown;
  metadata?: unknown;
};

type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}


const INVALID_CANDIDATE_NAME_WORDS = [
  "public relations",
  "project management",
  "teamwork",
  "time management",
  "leadership",
  "effective communication",
  "critical thinking",
  "english",
  "german",
  "programming",
  "machine learning",
  "data visualization",
  "data engineering",
  "generative ai",
  "skills",
  "contact",
  "education",
  "expertise",
  "languages",
  "projects",
  "professional experience",
  "profile summary",
  "technical support engineer",
  "application engineer",
];

function titleCaseName(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSpacedCapsLine(line: string) {
  const trimmed = line.trim();
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  const spacedUppercase = /^(?:[A-Z]\s*){6,}$/.test(trimmed.replace(/[^A-Z\s]/g, ""));

  if (lettersOnly.length >= 8 && spacedUppercase) {
    return lettersOnly;
  }

  return trimmed;
}

function isBadCandidateName(value: unknown) {
  const name = text(value);
  if (!name) return true;

  const lower = name.toLowerCase();
  if (INVALID_CANDIDATE_NAME_WORDS.some((item) => lower === item || lower.includes(item))) {
    return true;
  }

  if (/@|linkedin|github|http|www|phone|email|address|street|straße|strasse|weg|germany|deutschland|würzburg|wurzburg|\d/.test(lower)) {
    return true;
  }

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return true;

  return false;
}

function deriveCandidateNameFromCv(rawText = "", fileName = "", currentName = "") {
  if (!isBadCandidateName(currentName)) {
    return titleCaseName(text(currentName));
  }

  const lines = String(rawText || "")
    .split(/\n+/)
    .map((line) => normalizeSpacedCapsLine(line))
    .map((line) => line.replace(/[^A-Za-zÀ-ÿ.' -]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 80)) {
    const words = line.split(/\s+/).filter(Boolean);
    const compactUpper = line.replace(/\s+/g, "");

    if (/^[A-Z]{8,}$/.test(compactUpper) && compactUpper.length <= 40) {
      const split = compactUpper.match(/[A-Z][a-z]*|[A-Z]+(?=[A-Z]|$)/g);
      if (split && split.length >= 2 && split.length <= 5) {
        const candidate = split.join(" ");
        if (!isBadCandidateName(candidate)) return titleCaseName(candidate);
      }
    }

    if (words.length >= 2 && words.length <= 5 && !isBadCandidateName(line)) {
      const mostlyLetters = words.every((word) => /^[A-Za-zÀ-ÿ.'-]+$/.test(word));
      const looksLikeName =
        mostlyLetters &&
        words.every((word) => word.length >= 2) &&
        words.filter((word) => /^[A-ZÀ-Ý]/.test(word)).length >= 2;

      if (looksLikeName) {
        return titleCaseName(line);
      }
    }
  }

  const cleanFileName = String(fileName || "")
    .replace(/\.(pdf|docx|doc|txt)$/gi, "")
    .replace(/\.(pdf|docx|doc|txt)$/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanFileName && !isBadCandidateName(cleanFileName)) {
    return titleCaseName(cleanFileName);
  }

  const email = String(rawText || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim() || "";
  if (local && !isBadCandidateName(local)) {
    return titleCaseName(local);
  }

  return "";
}

function applySafeRecruiterCandidateName<T extends { recruiterMemoryProfile?: { candidateName?: string } }>(
  payload: T,
  rawText = "",
  fileName = "",
): T {
  const profile = payload?.recruiterMemoryProfile;
  if (!profile) return payload;

  const safeName = deriveCandidateNameFromCv(rawText, fileName, profile.candidateName || "");
  if (safeName) {
    profile.candidateName = safeName;
  } else if (isBadCandidateName(profile.candidateName)) {
    profile.candidateName = "";
  }

  return payload;
}

function normalizeUploadFileName(fileName = "") {
  const clean = String(fileName || "uploaded-cv.pdf").replace(/\s+/g, " ").trim();
  return clean
    .replace(/(?:\.pdf){2,}$/i, ".pdf")
    .replace(/(?:\.docx){2,}$/i, ".docx")
    .replace(/(?:\.txt){2,}$/i, ".txt") || "uploaded-cv.pdf";
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function jsonFromModel(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");

    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

function sentences(value: string, limit = 8) {
  return value
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 35)
    .slice(0, limit);
}

async function extractPdfText(buffer: Buffer) {
  debugCvPipeline("api.cv.pdf_parse.before", { bytes: buffer.length });
  try {
    type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParseFn;

    const result = await pdfParse(buffer);
    const extracted = normalizeExtractedText(result.text || "");
    debugCvText("api.cv.pdf_parse.after", extracted, { pages: result.numpages || null });

    if (extracted.length > 30) {
      return extracted;
    }

    throw new Error("PDF parser returned empty text.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF extraction failed.";

    throw new Error(
      "PDF uploaded, but WorkZo could not extract readable text. Parser note: " +
        message
    );
  }
}

function normalizeCvText(raw: string) {
  return raw
    .replace(/\x00/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/ManageEngine/g, "ManageEngine")
    .replace(/TextBlob/g, "TextBlob")
    .replace(/LangChain/g, "LangChain")
    .trim();
}

async function extractDocxText(buffer: Buffer) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const extracted = normalizeExtractedText(result.value || "");

    if (extracted.length > 20) {
      return extracted;
    }
  } catch {
    // Continue to error below.
  }

  throw new Error("DOCX uploaded, but no readable CV text was found.");
}

async function extractFileText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (name.endsWith(".txt") || type.includes("text/plain")) {
    const extracted = normalizeExtractedText(buffer.toString("utf-8"));

    if (extracted.length > 5) {
      return extracted;
    }

    throw new Error("TXT uploaded, but no readable text was found.");
  }

  if (name.endsWith(".pdf") || type.includes("pdf")) {
    return extractPdfText(buffer);
  }

  if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    return extractDocxText(buffer);
  }

  if (name.endsWith(".doc")) {
    throw new Error("Old .doc files are not supported yet. Please upload PDF/DOCX/TXT or paste text.");
  }

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}

function emptyMemory(targetRole: string, targetMarket: string) {
  return {
    recruiterMemoryProfile: {
      candidateName: "",
      location: targetMarket || "Global",
      targetRole: targetRole || "General Role",
      summary: [],
      skills: { technical: [], business: [], tools: [] },
      experience: [],
      projects: [],
      education: [],
      languages: [],
      recruiterMemory: [],
      possibleConcerns: ["No CV or job description was provided yet."],
    },
    jobMemoryProfile: {
      roleTitle: targetRole || "General Role",
      businessContext: "",
      responsibilities: [],
      requiredSkills: [],
      softSkills: [],
      interviewFocus: [
        "Ask the candidate to provide CV and job description context before a full interview.",
      ],
    },
    confidence: "skipped",
  };
}

function fallbackMemory(input: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  warning?: string;
}) {
  const cvLines = sentences(input.cvText, 12);
  const jdLines = sentences(input.jobDescription, 8);

  return {
    recruiterMemoryProfile: {
      candidateName: "",
      location: input.targetMarket,
      targetRole: input.targetRole,
      summary: cvLines.slice(0, 4),
      skills: { technical: [], business: [], tools: [] },
      experience: [],
      projects: [],
      education: [],
      languages: [],
      recruiterMemory: cvLines,
      possibleConcerns: [input.warning || "Fallback recruiter memory generated."],
    },
    jobMemoryProfile: {
      roleTitle: input.targetRole,
      businessContext: input.jobDescription.slice(0, 700),
      responsibilities: jdLines,
      requiredSkills: [],
      softSkills: [],
      interviewFocus: ["Ask for measurable examples.", "Ask for role-specific proof."],
    },
    confidence: "fallback",
  };
}

async function buildMemoryFromJson(body: RequestBody) {
  const rawCvInput = text(body.cvText);
  const cvText = rawCvInput ? cleanExtractedCvText(rawCvInput) : "";
  const jobDescription = text(body.jobDescription);
  const targetRole = text(body.targetRole) || "General Role";
  const targetMarket = text(body.targetMarket) || "Global";
  const fileName = text(body.fileName);
  const language = text(body.language) || "English";

  if (!cvText && !jobDescription) {
    return NextResponse.json(emptyMemory(targetRole, targetMarket));
  }

  const fallback = applySafeRecruiterCandidateName(
    fallbackMemory({
      cvText,
      jobDescription,
      targetRole,
      targetMarket,
    }),
    cvText,
    fileName,
  );

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(fallback);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CV_MODEL || "gpt-4o-mini",
      temperature: 0,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
You are WorkZo AI's Recruiter Memory Builder.

Extract compact recruiter memory from the uploaded CV and job description.

Return valid JSON only:
{
  "recruiterMemoryProfile": {
    "candidateName": "",
    "location": "",
    "targetRole": "",
    "summary": [],
    "skills": { "technical": [], "business": [], "tools": [] },
    "experience": [{ "company": "", "role": "", "dates": "", "highlights": [] }],
    "projects": [{ "name": "", "summary": "" }],
    "education": [],
    "languages": [],
    "recruiterMemory": [],
    "possibleConcerns": []
  },
  "jobMemoryProfile": {
    "roleTitle": "",
    "businessContext": "",
    "responsibilities": [],
    "requiredSkills": [],
    "softSkills": [],
    "interviewFocus": []
  },
  "confidence": "high"
}
`.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            targetRole,
            targetMarket,
            language,
            rawCvText: cvText.slice(0, 12000),
            rawJobDescription: jobDescription.slice(0, 8000),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const parsed = jsonFromModel(raw);

    if (!parsed?.recruiterMemoryProfile || !parsed?.jobMemoryProfile) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json(
      applySafeRecruiterCandidateName(
        {
          recruiterMemoryProfile: parsed.recruiterMemoryProfile,
          jobMemoryProfile: parsed.jobMemoryProfile,
          confidence: parsed.confidence || "medium",
        },
        cvText,
        fileName,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      applySafeRecruiterCandidateName(
        fallbackMemory({
          cvText,
          jobDescription,
          targetRole,
          targetMarket,
          warning:
            error instanceof Error
              ? error.message
              : "Recruiter memory extraction failed.",
        }),
        cvText,
        fileName,
      )
    );
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }

      const safeFileName = normalizeUploadFileName(file.name);
      const extracted = await extractFileText(file);
      debugCvText("api.cv.file_text.extracted", extracted, { fileName: safeFileName, fileType: file.type });

      // Use universal CV cleaner — handles multi-column, sidebar, ATS, modern templates
      const cleanedCv = cleanExtractedCvText(extracted);
      const layout = diagnoseCvLayout(extracted);
      debugCvText("api.cv.file_text.cleaned", cleanedCv, {
        fileName: safeFileName,
        likelySidebar: layout.likelySidebar,
        sectionOrder: layout.sectionOrder.join(" → "),
        hasEncodingArtefacts: layout.hasEncodingArtefacts,
      });

      const parsedProfile = extractResumeProfile(cleanedCv);
      const resumeProfile = sanitizeResumeProfileIdentity(parsedProfile, { rawText: cleanedCv, fileName: safeFileName });
      debugCvProfile("api.cv.parser.output", resumeProfile, { fileName: safeFileName });

      return NextResponse.json({
        text: cleanedCv,
        cvText: cleanedCv,
        content: cleanedCv,
        resumeProfile,
        profile: resumeProfile,
        fileName: safeFileName,
        chars: cleanedCv.length,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not extract text from this file.",
        },
        { status: 422 }
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  return buildMemoryFromJson(body);
}
