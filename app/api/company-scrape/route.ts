/**
 * app/api/company-scrape/route.ts
 *
 * Accepts a company URL or job posting URL and returns:
 * - companyName
 * - companyDescription (what they do, size, domain)
 * - jobTitle
 * - jobDescription (extracted from the page)
 * - requiredSkills[]
 * - niceToHaveSkills[]
 * - companyValues[]
 * - interviewSignals (what this company likely cares about)
 *
 * Uses GPT-4o to extract structured data from the raw page text.
 * Works with: LinkedIn job pages, company websites, Greenhouse, Lever, Workable,
 * Indeed, Glassdoor, any job board, or a company's own careers page.
 */

import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 8000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.length > 3 && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

/**
 * Fetches a URL and extracts readable text, stripping HTML/CSS/JS noise.
 * Uses a simple but effective approach: fetch → strip tags → collapse whitespace.
 * Works for most job postings and company pages without requiring a headless browser.
 */
async function fetchPageText(url: string): Promise<{ text: string; finalUrl: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WorkZoBot/1.0; +https://workzoai.com/bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { text: "", finalUrl: url, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/json")) {
      return { text: "", finalUrl: response.url, error: "Not a readable page" };
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    // Strip scripts, styles, and HTML tags; collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim();

    return { text: text.slice(0, 20000), finalUrl };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : "Fetch failed";
    if (msg.includes("abort")) return { text: "", finalUrl: url, error: "Request timed out" };
    return { text: "", finalUrl: url, error: msg };
  }
}

/**
 * Uses GPT-4o to extract structured job/company data from raw page text.
 * This handles all formats: LinkedIn, Greenhouse, Lever, company sites, etc.
 */
async function extractJobDataWithAI(pageText: string, url: string): Promise<{
  companyName: string;
  companyDescription: string;
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  companyValues: string[];
  companySize: string;
  location: string;
  employmentType: string;
  interviewSignals: string;
  confidence: "high" | "medium" | "low";
}> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are extracting structured data from a job posting or company page.

PAGE URL: ${url}
PAGE TEXT (first 15000 chars):
${pageText.slice(0, 15000)}

Extract the following and return ONLY valid JSON, no markdown:
{
  "companyName": "exact company name or empty string",
  "companyDescription": "1-3 sentences: what the company does, their domain/industry, rough size if mentioned",
  "jobTitle": "exact job title from posting or empty string",
  "jobDescription": "full extracted job description text, responsibilities, and requirements combined, max 3000 chars",
  "requiredSkills": ["skill1", "skill2", ...],
  "niceToHaveSkills": ["skill1", "skill2", ...],
  "companyValues": ["value1", "value2", ...],
  "companySize": "startup | small | medium | large | enterprise | unknown",
  "location": "city/country or remote or hybrid or empty",
  "employmentType": "full-time | part-time | contract | internship | unknown",
  "interviewSignals": "2-3 sentences: what this company likely prioritizes in interviews based on their culture, role, and description",
  "confidence": "high if clear job posting found | medium if partial info | low if just a homepage"
}

Rules:
- If this is a company homepage (not a job posting), still extract company description and values but leave jobTitle/jobDescription empty.
- If content is in German, Dutch, or another language, extract it and translate field values to English.
- requiredSkills: only explicit requirements, not nice-to-haves. Max 15.
- niceToHaveSkills: "preferred", "plus", "bonus" items. Max 10.
- companyValues: cultural keywords and stated values. Max 8.
- interviewSignals: infer from company type, role, and culture, what do they really care about?`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {
      companyName: "",
      companyDescription: "",
      jobTitle: "",
      jobDescription: "",
      requiredSkills: [],
      niceToHaveSkills: [],
      companyValues: [],
      companySize: "unknown",
      location: "",
      employmentType: "unknown",
      interviewSignals: "",
      confidence: "low",
    };
  }
}

export async function POST(request: Request) {
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { url?: string };
  const rawUrl = cleanText(body.url, 500);

  if (!rawUrl) {
    return NextResponse.json({ error: "No URL provided." }, { status: 400 });
  }

  if (!isValidUrl(rawUrl)) {
    return NextResponse.json({ error: "Invalid URL. Please paste a full link like https://company.com/jobs/role" }, { status: 400 });
  }

  const url = normalizeUrl(rawUrl);

  // Fetch the page
  const { text, finalUrl, error: fetchError } = await fetchPageText(url);

  if (!text || text.length < 100) {
    return NextResponse.json({
      error: fetchError
        ? `Could not load that page: ${fetchError}. Try copying the job description text instead.`
        : "The page loaded but appeared empty. Try copying the job description text instead.",
    }, { status: 422 });
  }

  // Extract structured data with AI
  try {
    const extracted = await extractJobDataWithAI(text, finalUrl);

    return NextResponse.json({
      ok: true,
      url: finalUrl,
      ...extracted,
    });
  } catch (err) {
    console.error("[company-scrape] AI extraction failed:", err);
    return NextResponse.json({
      error: "Could not extract job data from that page. Try pasting the job description text instead.",
    }, { status: 500 });
  }
}
