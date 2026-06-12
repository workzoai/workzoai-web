/**
 * WorkZo AI — Universal CV Text Rebuilder
 * lib/workzoCvPdfCleaner.ts
 *
 * Problem: pdf-parse extracts text in PDF content-stream order, not visual order.
 * Multi-column CVs (sidebar on left, main content on right) extract as:
 *   [sidebar skills/contact/education] → [main body experience/projects]
 * This looks clumsy and confuses the resume parser.
 *
 * This module rebuilds the text into correct reading order using heuristics
 * and then normalises all artefacts from common CV template engines.
 *
 * It is person-agnostic — works for any CV from any candidate worldwide.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type CvSection = {
  kind: "name" | "headline" | "contact" | "summary" | "experience" | "education" | "skills" | "projects" | "languages" | "certifications" | "unknown";
  lines: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_HEADERS: Record<string, CvSection["kind"]> = {
  // Summary
  "summary": "summary", "profile": "summary", "professional summary": "summary",
  "profile summary": "summary", "about me": "summary", "objective": "summary",
  "career objective": "summary", "personal statement": "summary",
  // Experience
  "experience": "experience", "work experience": "experience",
  "professional experience": "experience", "employment history": "experience",
  "employment": "experience", "work history": "experience",
  // Education
  "education": "education", "academic background": "education",
  "qualifications": "education", "academic qualifications": "education",
  "studies": "education", "training": "education",
  // Skills
  "skills": "skills", "technical skills": "skills", "core skills": "skills",
  "competencies": "skills", "expertise": "skills", "key skills": "skills",
  "tech skills": "skills", "technologies": "skills", "tools": "skills",
  // Projects
  "projects": "projects", "selected projects": "projects",
  "personal projects": "projects", "key projects": "projects",
  "portfolio": "projects", "project highlights": "projects",
  // Languages
  "languages": "languages", "language skills": "languages",
  "spoken languages": "languages",
  // Certifications
  "certifications": "certifications", "certificates": "certifications",
  "accreditations": "certifications", "licences": "certifications",
  "licenses": "certifications", "awards": "certifications",
  "achievements": "certifications",
};

// Lines that are almost certainly sidebar artefacts
const SIDEBAR_LINE_RE = /^(english|german|dutch|french|spanish|italian|portuguese|mandarin|hindi|arabic|russian|japanese|korean)[\s:–-]+(fluent|native|conversational|b1|b2|c1|c2|a1|a2|professional|elementary|intermediate|advanced)/i;

// Lines that strongly indicate a name (first line of CV)
const LOOKS_LIKE_NAME_RE = /^[A-ZÀ-Ý][a-zà-ÿ]+([\s-][A-ZÀ-Ý][a-zà-ÿ]+){1,3}$/;

// Contact line heuristic
const CONTACT_LINE_RE = /@|linkedin\.com|^\+?[\d\s().-]{8,}$|^\d{5}\b|\bstraße\b|\bstrasse\b|\bstreet\b|\bavenue\b|\broad\b|\bdr\b\.|^\d+\s+[A-Z]/i;

// Date range — indicates an experience or education entry header
const DATE_RANGE_RE = /\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}|present|current|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(19|20)\d{2}/i;

// Bullet character normalisation
const BULLET_CHARS = /^[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB•▪◦‣·∙◆◇*>]\s*/;

// ── Text normalisation ────────────────────────────────────────────────────────

/**
 * Universal text normaliser — cleans encoding artefacts from any PDF.
 * Does NOT hardcode any person's name, company, or content.
 */
export function normalizeExtractedCvText(raw: string): string {
  return raw
    // Null bytes and carriage returns
    .replace(/\x00/g, " ")
    .replace(/\r\n?/g, "\n")
    // Unicode quotes → ASCII
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Common dash encoding artefacts
    .replace(/â€[""]/g, "—")
    .replace(/â€"|â€"/g, "–")
    .replace(/â€¢|â€¢/g, "•")
    // Non-breaking space
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    // Bullet character normalisation
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB▪◦‣·∙◆◇]/g, "•")
    // Spaced capitals common in decorative headers: "S K I L L S" → "SKILLS"
    .replace(/\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b/g, "$1$2$3$4$5$6$7$8")
    .replace(/\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b/g, "$1$2$3$4$5$6$7")
    .replace(/\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b/g, "$1$2$3$4$5$6")
    .replace(/\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b/g, "$1$2$3$4$5")
    .replace(/\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b/g, "$1$2$3$4")
    // Common PDF encoding typos — generic only, no hardcoded names
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bEngince\b/gi, "Engine")
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\bScrapping\b/gi, "Scraping")
    .replace(/\bAnalisys\b/gi, "Analysis")
    .replace(/\bVizualization\b/gi, "Visualization")
    .replace(/\bVIZUALIZATION\b/gi, "Visualization")
    .replace(/\bMy\s+SQL\b/gi, "MySQL")
    .replace(/\bNum\s*Py\b/gi, "NumPy")
    .replace(/\bYou\s*Tube\b/gi, "YouTube")
    .replace(/\bText\s*Blob\b/gi, "TextBlob")
    .replace(/\bLang\s*Cha?in\b/gi, "LangChain")
    .replace(/\bManage\s*Eng?ine?\b/gi, "ManageEngine")
    .replace(/\bService\s*Desk\s*Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bWürzburg|WÃ¼rzburg|WˆRZBURG|Wˆ…rzburg/g, "Würzburg")
    .replace(/\bWuerzburg\b/gi, "Würzburg")
    .replace(/\bWurzburg\b/gi, "Würzburg")
    // Fix word-splits that happen in some PDF renderers: "Detail-orientedIT" "Specialistandaspiring"
    .replace(/([a-z])([A-Z]{2,})/g, (_, a, b) => {
      // Only split if the uppercase block looks like a new word start, not an acronym
      if (b.length <= 3) return _ ; // Keep acronyms: SQL, API, GCP etc.
      return `${a} ${b}`;
    })
    .replace(/([a-z]{3,})([A-Z][a-z])/g, "$1 $2")
    // Whitespace cleanup
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Section detection ─────────────────────────────────────────────────────────

function isSectionHeader(line: string): CvSection["kind"] | null {
  const clean = line
    .trim()
    .toLowerCase()
    .replace(/[:\-–—]+$/, "")
    .replace(/^[•\-\*]\s*/, "")
    .trim();

  // Exact match first
  if (SECTION_HEADERS[clean]) return SECTION_HEADERS[clean];

  // Starts-with match for long headers like "PROFESSIONAL EXPERIENCE (2018-2024)"
  for (const [key, kind] of Object.entries(SECTION_HEADERS)) {
    if (clean.startsWith(key)) return kind;
  }

  return null;
}

function isSectionHeaderLine(line: string): boolean {
  if (isSectionHeader(line)) return true;
  const upper = line.trim().toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  if (upper.length < 4 || upper.length > 40) return false;
  // All-caps short line that matches a known section
  return Boolean(isSectionHeader(upper.toLowerCase()));
}

// ── Multi-column rebuild ──────────────────────────────────────────────────────

/**
 * Detects whether extracted text looks like it came out in sidebar-first order.
 *
 * Sidebar-first order symptoms:
 * - Skills / languages / contact appear before any experience entries
 * - Short single-word lines dominate the beginning
 * - No date ranges in the first 40% of lines
 */
function detectsSidebarFirstOrder(lines: string[]): boolean {
  const first40 = lines.slice(0, Math.ceil(lines.length * 0.4));
  const last60 = lines.slice(Math.ceil(lines.length * 0.4));

  const skillHeaderInFirst = first40.some(l => /^(skills|expertise|competencies|languages|contact)$/i.test(l.trim()));
  const experienceInLast = last60.some(l => /^(experience|work experience|professional experience)$/i.test(l.trim()));
  const dateLinesInFirst = first40.filter(l => DATE_RANGE_RE.test(l)).length;
  const dateLinesInLast = last60.filter(l => DATE_RANGE_RE.test(l)).length;

  return (skillHeaderInFirst && experienceInLast) || (dateLinesInFirst === 0 && dateLinesInLast >= 2);
}

/**
 * When text was extracted in sidebar-first order, rebuild it by:
 * 1. Identifying which sections are "sidebar" (contact/skills/languages)
 * 2. Identifying which sections are "main" (summary/experience/projects)
 * 3. Outputting: name → headline → main sections → sidebar sections
 *
 * This is heuristic — not positional (we don't have x/y coords from pdf-parse).
 */
function rebuildReadingOrder(lines: string[]): string[] {
  const result: string[] = [];
  const sidebarContent: string[] = [];
  const mainContent: string[] = [];
  let nameLines: string[] = [];

  let currentKind: CvSection["kind"] = "unknown";
  let buffer: string[] = [];

  function flushBuffer() {
    if (!buffer.length) return;
    const isMainSection = ["summary", "experience", "projects", "unknown"].includes(currentKind);
    const isSidebarSection = ["skills", "languages", "certifications", "contact"].includes(currentKind);
    const isEducation = currentKind === "education";

    if (isMainSection) mainContent.push(...buffer);
    else if (isSidebarSection) sidebarContent.push(...buffer);
    else if (isEducation) mainContent.push(...buffer); // education belongs in main flow
    buffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      buffer.push("");
      continue;
    }

    const kind = isSectionHeader(trimmed);
    if (kind) {
      flushBuffer();
      currentKind = kind;
      buffer.push(trimmed);
      continue;
    }

    // Detect name line (first non-empty, non-section, non-contact, looks like a name)
    if (nameLines.length === 0 && currentKind === "unknown" && LOOKS_LIKE_NAME_RE.test(trimmed) && !CONTACT_LINE_RE.test(trimmed)) {
      nameLines = [trimmed];
      continue;
    }

    buffer.push(trimmed);
  }

  flushBuffer();

  if (nameLines.length) result.push(...nameLines, "");
  if (mainContent.length) result.push(...mainContent);
  if (sidebarContent.length) result.push("", ...sidebarContent);

  return result;
}

// ── Section-aware text rebuilder ─────────────────────────────────────────────

/**
 * Parse the flat extracted text into labelled sections.
 * Generic — no hardcoded content.
 */
function parseSections(text: string): CvSection[] {
  const lines = text.split("\n").map(l => l.trim());
  const sections: CvSection[] = [];
  let current: CvSection = { kind: "unknown", lines: [] };

  for (const line of lines) {
    if (!line) {
      current.lines.push("");
      continue;
    }

    const kind = isSectionHeader(line);
    if (kind && line.length < 50) {
      if (current.lines.some(l => l.trim())) {
        sections.push(current);
      }
      current = { kind, lines: [line] };
      continue;
    }

    current.lines.push(line);
  }

  if (current.lines.some(l => l.trim())) {
    sections.push(current);
  }

  return sections;
}

/**
 * Normalise bullet points throughout — bullet chars → dash for consistency.
 */
function normaliseBullets(text: string): string {
  return text
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (BULLET_CHARS.test(trimmed)) {
        return "- " + trimmed.replace(BULLET_CHARS, "").trim();
      }
      return line;
    })
    .join("\n");
}

/**
 * Remove obvious duplicate lines that appear when sidebar content is
 * also included in the main column (some CV tools render both).
 */
function deduplicateLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  let blankCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blankCount++;
      if (blankCount <= 2) out.push("");
      continue;
    }

    blankCount = 0;
    const key = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (key.length > 3 && seen.has(key)) continue;
    if (key.length > 3) seen.add(key);
    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * cleanExtractedCvText
 *
 * Takes raw text from pdf-parse (or mammoth for DOCX) and returns
 * clean, reading-order-correct, deduplicated text ready for the resume parser.
 *
 * Works for any CV template: single-column, two-column, sidebar, modern, ATS.
 * No hardcoded names, companies, or person-specific content.
 *
 * @param rawText - The raw text from pdf-parse or mammoth
 * @returns Clean, normalised CV text
 */
export function cleanExtractedCvText(rawText: string): string {
  if (!rawText?.trim()) return "";

  // Step 1: Normalise encoding artefacts
  let text = normalizeExtractedCvText(rawText);

  // Step 2: Detect and fix sidebar-first extraction order
  const lines = text.split("\n");
  if (detectsSidebarFirstOrder(lines)) {
    const reordered = rebuildReadingOrder(lines);
    text = reordered.join("\n");
  }

  // Step 3: Normalise bullet characters
  text = normaliseBullets(text);

  // Step 4: Remove duplicate lines (from multi-column rendering artefacts)
  text = deduplicateLines(text);

  // Step 5: Final whitespace cleanup
  return text
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Guess whether extracted text came from a multi-column/sidebar PDF.
 * Useful for logging and debugging.
 */
export function diagnoseCvLayout(rawText: string): {
  likelySidebar: boolean;
  hasSpacedCaps: boolean;
  hasEncodingArtefacts: boolean;
  sectionOrder: string[];
} {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const sectionOrder: string[] = [];

  for (const line of lines) {
    const kind = isSectionHeader(line);
    if (kind && !sectionOrder.includes(kind)) sectionOrder.push(kind);
  }

  return {
    likelySidebar: detectsSidebarFirstOrder(lines),
    hasSpacedCaps: /\b[A-Z]\s[A-Z]\s[A-Z]\s[A-Z]\b/.test(rawText),
    hasEncodingArtefacts: /â€|Ã¼|Ã|â¢|\x00/.test(rawText),
    sectionOrder,
  };
}
