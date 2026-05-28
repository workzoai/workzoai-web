export type WorkZoCvTemplate = "ATS Classic" | "Modern Sidebar" | "Technical Compact" | "Career Pivot";

export type WorkZoStructuredCv = {
  fullName: string;
  targetRole: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
  projects: Array<{ name: string; bullets: string[] }>;
  education: string[];
  certifications: string[];
  languages: string[];
  suggestedAdditions: string[];
  jdKeywords: string[];
};

const STOP_WORDS = new Set([
  "the","and","for","with","that","this","from","your","you","are","our","will","have","has","was","were","but","not","all","can","into","about","over","under","role","job","team","work","working","experience","skills","years","year","candidate","responsibilities","requirements","preferred","required","must","should","plus","good","strong","excellent","knowledge","ability","able","including","using","within","across","etc","like","based","their","they","them","we","company","business","position","customer","customers"
]);

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unique(items: string[], limit = 24) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = cleanText(item).replace(/^[-•*]\s*/, "");
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
    if (out.length >= limit) break;
  }
  return out;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractJdKeywords(jdText: string, limit = 18) {
  const jd = cleanText(jdText).toLowerCase();
  const phraseMatches = jd.match(/\b(?:customer success|account management|sales executive|business development|lead generation|cold calling|crm|hubspot|salesforce|pipeline|prospecting|negotiation|stakeholder management|technical support|data analysis|sql|python|excel|power bi|tableau|german|french|dutch|english)\b/g) || [];
  const words = jd
    .replace(/[^a-z0-9äöüßéèêëàâîïôûùçñ\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  return unique([...phraseMatches, ...words], limit);
}

function sectionAfter(text: string, headings: string[]) {
  const lines = cleanText(text).split("\n");
  const lowerHeadings = headings.map((h) => h.toLowerCase());
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const normalized = lines[i].trim().replace(/[:]/g, "").toLowerCase();
    if (lowerHeadings.some((h) => normalized === h || normalized.includes(h))) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  const out: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const headingLike = /^[A-Z][A-Z\s/&-]{3,}$/.test(line) || /^(summary|profile|experience|education|skills|projects|certifications|languages|contact)\b/i.test(line);
    if (headingLike && out.length > 0) break;
    if (line) out.push(line);
  }
  return out.join("\n");
}

function guessName(cvText: string, email: string) {
  const lines = cleanText(cvText).split("\n").map((line) => line.trim()).filter(Boolean);
  const bad = /@|linkedin|github|http|www|phone|email|address|street|weg|straße|strasse|germany|deutschland|wurzburg|würzburg|\d/gi;
  for (const line of lines.slice(0, 8)) {
    const compact = line.replace(/[^a-zA-ZÀ-ÿ\s.'-]/g, "").trim();
    const words = compact.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && !bad.test(line)) return titleCase(compact);
  }
  if (email) {
    const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
    if (local.split(/\s+/).length >= 2) return titleCase(local);
  }
  return "Your Name";
}

function guessLocation(cvText: string) {
  const lines = cleanText(cvText).split("\n").map((line) => line.trim()).filter(Boolean);
  const locationLine = lines.find((line) => /germany|deutschland|würzburg|wurzburg|berlin|munich|münchen|hamburg|chennai|india/i.test(line));
  return locationLine ? locationLine.replace(/\s*\|\s*/g, ", ").slice(0, 80) : "";
}

function parseBullets(section: string, fallbackText: string, max = 8) {
  const source = section || fallbackText;
  const lines = cleanText(source)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => /^[-•*]/.test(line)).map((line) => line.replace(/^[-•*]\s*/, ""));
  if (bullets.length) return unique(bullets, max);
  return unique(lines.filter((line) => line.length > 30 && line.length < 190), max);
}

function matchSupportedKeywords(cvText: string, jdKeywords: string[]) {
  const lowerCv = cvText.toLowerCase();
  return jdKeywords.filter((keyword) => lowerCv.includes(keyword.toLowerCase()));
}

function buildTailoredSummary({ cvText, targetRole, supportedKeywords }: { cvText: string; targetRole: string; supportedKeywords: string[] }) {
  const lower = cvText.toLowerCase();
  const strengths: string[] = [];
  if (/customer|client|support|b2b|b2c|ticket|resolution/.test(lower)) strengths.push("customer-facing support and stakeholder communication");
  if (/sql|python|excel|power bi|tableau|dashboard|data/.test(lower)) strengths.push("data-informed problem solving and reporting");
  if (/sales|crm|lead|pipeline|prospect|account/.test(lower)) strengths.push("commercial and sales-adjacent communication");
  if (/technical|software|api|product|engineer/.test(lower)) strengths.push("technical troubleshooting and product understanding");
  const keywordLine = supportedKeywords.slice(0, 5).join(", ");
  return `${targetRole || "Professional"} candidate with experience in ${strengths.slice(0, 3).join(", ") || "structured problem solving and clear communication"}. Brings a practical background that can be positioned toward ${targetRole || "the target role"}${keywordLine ? `, with supported relevance to ${keywordLine}` : ""}. Focused on clear ownership, role-fit evidence, and ATS-friendly language without adding unsupported claims.`;
}

function buildExperienceBullets(cvText: string, jdKeywords: string[]) {
  const lower = cvText.toLowerCase();
  const bullets: string[] = [];
  const supported = matchSupportedKeywords(cvText, jdKeywords);
  if (/support|customer|client|ticket|b2b|b2c|resolution/.test(lower)) {
    bullets.push("Handled customer-facing issues with ownership, clear communication, and structured follow-up across support contexts.");
    bullets.push("Translated customer needs and technical issues into clear actions for faster resolution and better stakeholder understanding.");
  }
  if (/technical|software|api|product|engineer|troubleshoot/.test(lower)) {
    bullets.push("Investigated technical issues, documented patterns, and communicated practical solutions to technical and non-technical users.");
  }
  if (/sql|python|excel|dashboard|power bi|tableau|data/.test(lower)) {
    bullets.push("Applied analytical thinking with tools such as SQL, Python, Excel, dashboards, or reporting workflows where supported by experience.");
  }
  if (/sales|crm|lead|prospect|pipeline|account|business development/.test(lower)) {
    bullets.push("Positioned customer communication and problem-solving experience toward sales conversations, qualification, and relationship building.");
  }
  if (supported.length) {
    bullets.push(`Aligned existing experience with job-description themes: ${supported.slice(0, 8).join(", ")}.`);
  }
  bullets.push("Add measurable proof where true: ticket volume, response time, conversion support, customer count, time saved, quality improvement, or revenue impact.");
  return unique(bullets, 8);
}

export function buildTailoredCv(cvTextInput: string, jdTextInput: string, manualRole = "") {
  const cvText = cleanText(cvTextInput);
  const jdText = cleanText(jdTextInput);
  const email = cvText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = cvText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() || "";
  const linkedin = cvText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/\S+/i)?.[0] || "";
  const jdKeywords = extractJdKeywords(jdText);
  const roleFromJd = jdText.match(/(?:job title|position|role)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() || jdText.match(/\b(sales executive|customer success manager|data analyst|technical support engineer|business development representative|account executive)\b/i)?.[0] || "";
  const targetRole = manualRole || roleFromJd || "Target Role";
  const supportedKeywords = matchSupportedKeywords(cvText, jdKeywords);
  const skillsSection = sectionAfter(cvText, ["skills", "technical skills", "core skills", "competencies"]);
  const rawSkills = unique([
    ...skillsSection.split(/[,;\n]/),
    ...supportedKeywords,
    ...((cvText.match(/\b(SQL|Python|Excel|Power BI|Tableau|CRM|Salesforce|HubSpot|Data Analysis|Technical Support|Customer Support|Stakeholder Management|Communication)\b/gi) || [])),
  ], 18);
  const experienceSection = sectionAfter(cvText, ["experience", "professional experience", "work experience", "employment history"]);
  const educationSection = sectionAfter(cvText, ["education", "academic background", "qualifications"]);
  const projectSection = sectionAfter(cvText, ["projects", "selected projects"]);
  const certificateSection = sectionAfter(cvText, ["certifications", "certificates"]);
  const languageSection = sectionAfter(cvText, ["languages", "language"]);

  return {
    fullName: guessName(cvText, email),
    targetRole,
    contact: { email, phone, location: guessLocation(cvText), linkedin },
    summary: buildTailoredSummary({ cvText, targetRole, supportedKeywords }),
    skills: rawSkills.length ? rawSkills : supportedKeywords.slice(0, 12),
    experience: [
      {
        title: targetRole === "Target Role" ? "Relevant Experience" : `Relevant Experience for ${targetRole}`,
        company: "Based on your CV",
        dates: "",
        bullets: buildExperienceBullets(cvText, jdKeywords),
      },
    ],
    projects: parseBullets(projectSection, "", 4).map((bullet, index) => ({ name: index === 0 ? "Role-relevant proof point" : `Proof point ${index + 1}`, bullets: [bullet] })),
    education: parseBullets(educationSection, "", 6),
    certifications: parseBullets(certificateSection, "", 6),
    languages: parseBullets(languageSection, "", 6),
    suggestedAdditions: unique([
      ...jdKeywords.filter((keyword) => !cvText.toLowerCase().includes(keyword.toLowerCase())).slice(0, 8).map((keyword) => `Only add ${keyword} if you truly have this experience.`),
      "Add exact metrics where true: ticket volume, customer count, response time, revenue impact, conversion support, or time saved.",
    ], 10),
    jdKeywords,
  } satisfies WorkZoStructuredCv;
}

export function structuredCvToText(cv: WorkZoStructuredCv) {
  const lines: string[] = [];
  lines.push(cv.fullName || "Your Name");
  if (cv.targetRole) lines.push(cv.targetRole);
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedin].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);
  lines.push("", "PROFESSIONAL SUMMARY", cv.summary);
  if (cv.skills.length) lines.push("", "CORE SKILLS", ...cv.skills.map((skill) => `- ${skill}`));
  lines.push("", "PROFESSIONAL EXPERIENCE");
  cv.experience.forEach((job) => {
    lines.push([job.title, job.company, job.dates].filter(Boolean).join(" | "));
    job.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  });
  if (cv.projects.length) {
    lines.push("", "PROJECTS / PROOF POINTS");
    cv.projects.forEach((project) => {
      lines.push(project.name);
      project.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }
  if (cv.education.length) lines.push("", "EDUCATION", ...cv.education.map((item) => `- ${item}`));
  if (cv.certifications.length) lines.push("", "CERTIFICATIONS", ...cv.certifications.map((item) => `- ${item}`));
  if (cv.languages.length) lines.push("", "LANGUAGES", ...cv.languages.map((item) => `- ${item}`));
  if (cv.suggestedAdditions.length) lines.push("", "DETAILS TO CONFIRM BEFORE USING", ...cv.suggestedAdditions.map((item) => `- ${item}`));
  return lines.join("\n");
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type PdfDrawLine = { text: string; x: number; y: number; size: number; font?: "regular" | "bold"; color?: string };

function hexToRgb(color = "111827") {
  const clean = color.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function buildPdfDocument(pages: PdfDrawLine[][]) {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageKids: number[] = [];
  const pageContentIds: number[] = [];
  pages.forEach((lines) => {
    const stream = lines
      .map((line) => {
        const font = line.font === "bold" ? "F2" : "F1";
        return `BT /${font} ${line.size} Tf ${hexToRgb(line.color)} ${line.x.toFixed(1)} ${line.y.toFixed(1)} Td (${pdfEscape(line.text)}) Tj ET`;
      })
      .join("\n");
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageContentIds.push(contentId);
  });
  const pagesIdPlaceholder = objects.length + pageContentIds.length + 1;
  pageContentIds.forEach((contentId) => {
    const pageId = add(`<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageKids.push(pageId);
  });
  const pagesId = add(`<< /Type /Pages /Kids [${pageKids.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageKids.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export function buildCvPdfBytes(cv: WorkZoStructuredCv, template: WorkZoCvTemplate) {
  const pages: PdfDrawLine[][] = [[]];
  let page = pages[0];
  const isSidebar = template === "Modern Sidebar" || template === "Career Pivot";
  const compact = template === "Technical Compact";
  const accent = template === "Career Pivot" ? "7c3aed" : template === "Modern Sidebar" ? "0e7490" : template === "Technical Compact" ? "1d4ed8" : "111827";
  let y = 800;
  const left = isSidebar ? 190 : 52;
  const maxChars = compact ? 92 : isSidebar ? 72 : 88;
  const addLine = (text: string, options: Partial<PdfDrawLine> = {}) => {
    if (y < 54) {
      page = [];
      pages.push(page);
      y = 800;
    }
    page.push({ text, x: options.x ?? left, y, size: options.size ?? 9.2, font: options.font ?? "regular", color: options.color ?? "111827" });
    y -= options.size ? options.size + 4 : 13;
  };
  const addWrapped = (text: string, options: Partial<PdfDrawLine> = {}) => {
    wrapText(text, options.x && options.x < 120 ? 28 : maxChars).forEach((line) => addLine(line, options));
  };
  const section = (title: string) => {
    y -= 6;
    addLine(title.toUpperCase(), { font: "bold", size: 9.5, color: accent });
  };

  if (isSidebar) {
    page.push({ text: "WORKZO CV", x: 52, y: 806, size: 10, font: "bold", color: accent });
    let sy = 770;
    const side = (text: string, size = 8.2, bold = false) => {
      if (sy > 60) page.push({ text, x: 52, y: sy, size, font: bold ? "bold" : "regular", color: "111827" });
      sy -= size + 5;
    };
    side("CONTACT", 9, true);
    [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedin].filter(Boolean).forEach((item) => wrapText(item, 24).forEach((line) => side(line, 7.5)));
    sy -= 10;
    side("SKILLS", 9, true);
    cv.skills.slice(0, 18).forEach((skill) => wrapText(`- ${skill}`, 24).forEach((line) => side(line, 7.5)));
    if (cv.languages.length) {
      sy -= 10;
      side("LANGUAGES", 9, true);
      cv.languages.slice(0, 6).forEach((item) => side(`- ${item}`, 7.5));
    }
  }

  addLine(cv.fullName || "Your Name", { font: "bold", size: 22, color: accent });
  addLine(cv.targetRole || "Professional CV", { size: 11, color: "334155" });
  if (!isSidebar) addWrapped([cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedin].filter(Boolean).join(" | "), { size: 8.2, color: "475569" });
  section("Professional Summary");
  addWrapped(cv.summary, { size: compact ? 8.4 : 9.2 });
  if (!isSidebar && cv.skills.length) {
    section("Core Skills");
    addWrapped(cv.skills.slice(0, 18).join(" • "), { size: 8.6 });
  }
  section("Professional Experience");
  cv.experience.forEach((job) => {
    addWrapped([job.title, job.company, job.dates].filter(Boolean).join(" | "), { font: "bold", size: 9.5 });
    job.bullets.slice(0, compact ? 5 : 7).forEach((bullet) => addWrapped(`- ${bullet}`, { size: compact ? 8.2 : 8.7 }));
    y -= 4;
  });
  if (cv.projects.length) {
    section("Projects / Proof Points");
    cv.projects.slice(0, 4).forEach((project) => {
      addWrapped(project.name, { font: "bold", size: 8.8 });
      project.bullets.slice(0, 3).forEach((bullet) => addWrapped(`- ${bullet}`, { size: 8.3 }));
    });
  }
  if (cv.education.length) {
    section("Education");
    cv.education.slice(0, 6).forEach((item) => addWrapped(`- ${item}`, { size: 8.4 }));
  }
  if (cv.certifications.length) {
    section("Certifications");
    cv.certifications.slice(0, 6).forEach((item) => addWrapped(`- ${item}`, { size: 8.4 }));
  }
  if (cv.suggestedAdditions.length) {
    section("Details to Confirm");
    cv.suggestedAdditions.slice(0, 8).forEach((item) => addWrapped(`- ${item}`, { size: 8.1, color: "64748b" }));
  }
  return buildPdfDocument(pages);
}

export function downloadBlob(filename: string, bytes: Uint8Array | string, mime: string) {
  let blob: Blob;

  if (typeof bytes === "string") {
    blob = new Blob([bytes], { type: mime });
  } else {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(bytes);
    blob = new Blob([arrayBuffer], { type: mime });
  }

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
