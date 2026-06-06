import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createRequire } from "module";
import { uploadFileToS3 } from "@/services/S3.service";
import { analyzeDocument } from "@/services/textract.service";
import { extractResumeProfile } from "@/lib/workzoResumeParser";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";
import { processCvAnalyzationsPrompt } from "@/services/prompt.service";
import { CV_ANALYZATION_SYSTEM_PROMPT, CV_ANALYZATION_USER_PROMPT } from "@/services/promptConstants.service";

const require = createRequire(import.meta.url);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
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

async function extractPdfText(buffer: Buffer): Promise<string> {
  debugCvPipeline("api.cv.pdf_parse.before", { bytes: buffer.length });

  try {
    // Upload buffer to S3
    const { key, bucket } = await uploadFileToS3(buffer, "cv.pdf", {
      folder: "cv-uploads",
    });

    // Analyze with Textract (plain text, not CSV)
    const { output } = await analyzeDocument(key, bucket, {
      featureTypes: ["TABLES", "FORMS"],
      createCsv: false,
    });

    // const extracted = normalizeExtractedText(output);
    debugCvText("api.cv.pdf_parse.after", output, {});

    if (output.length > 30) {
      return output;
    }

    throw new Error("Textract returned empty text.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF extraction failed.";
    throw new Error(
      "PDF uploaded, but WorkZo could not extract readable text. Parser note: " +
      message
    );
  }
}

// async function extractPdfText(buffer: Buffer) {
//   debugCvPipeline("api.cv.pdf_parse.before", { bytes: buffer.length });
//   try {
//     type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

//     const pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParseFn;

//     const result = await pdfParse(buffer);
//     const extracted = normalizeExtractedText(result.text || "");
//     debugCvText("api.cv.pdf_parse.after", extracted, { pages: result.numpages || null });

//     if (extracted.length > 30) {
//       return extracted;
//     }

//     throw new Error("PDF parser returned empty text.");
//   } catch (error) {
//     const message =
//       error instanceof Error ? error.message : "PDF extraction failed.";

//     throw new Error(
//       "PDF uploaded, but WorkZo could not extract readable text. Parser note: " +
//       message
//     );
//   }
// }

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
  const cvText = text(body.cvText);
  const jobDescription = text(body.jobDescription);
  const targetRole = text(body.targetRole) || "General Role";
  const targetMarket = text(body.targetMarket) || "Global";
  const language = text(body.language) || "English";

  if (!cvText && !jobDescription) {
    return NextResponse.json(emptyMemory(targetRole, targetMarket));
  }

  const fallback = fallbackMemory({
    cvText,
    jobDescription,
    targetRole,
    targetMarket,
  });

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

    return NextResponse.json({
      recruiterMemoryProfile: parsed.recruiterMemoryProfile,
      jobMemoryProfile: parsed.jobMemoryProfile,
      confidence: parsed.confidence || "medium",
    });
  } catch (error) {
    return NextResponse.json(
      fallbackMemory({
        cvText,
        jobDescription,
        targetRole,
        targetMarket,
        warning:
          error instanceof Error
            ? error.message
            : "Recruiter memory extraction failed.",
      })
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

      const extracted = await extractFileText(file);
      debugCvText("api.cv.file_text.extracted", extracted, { fileName: file.name, fileType: file.type });

      const response = await processCvAnalyzationsPrompt(CV_ANALYZATION_SYSTEM_PROMPT, CV_ANALYZATION_USER_PROMPT(extracted));
      // const cleanedCv = normalizeCvText(extracted);
      // debugCvText("api.cv.file_text.cleaned", cleanedCv, { fileName: file.name });

      // const resumeProfile = extractResumeProfile(cleanedCv);
      // debugCvProfile("api.cv.parser.output", resumeProfile, { fileName: file.name });

      return NextResponse.json({
        text: extracted,
        cvText: extracted,
        content: extracted,
        resumeProfile: JSON.parse(response),
        profile: response,
        fileName: file.name,
        chars: extracted.length,
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
