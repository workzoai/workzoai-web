/*
 * lib/smart-apply/buildCvDocx.ts
 *
 * Build a .docx from a ResumeProfile with ZERO dependencies.
 *
 * WHY NO LIBRARY
 *
 * The app has no docx library, and the existing PDF generator (workzoCvPdf.ts) is
 * deliberately dependency-free too. A .docx is just a ZIP of a few XML files, so we
 * assemble it directly rather than pull in a package. This keeps the CV export
 * self-contained: no new dependency to audit, version, or have break a Vercel build.
 *
 * The ZIP is written by hand (stored, no compression) because that is a few dozen
 * lines and avoids a compression dependency. Word opens stored zips fine.
 *
 * Like the PDF path, this COPIES the tailored profile faithfully. It does not
 * summarise, reorder, or invent. The profile has already passed the evidence gate.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";

/* ── XML helpers ───────────────────────────────────────────────────────────── */

function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type RunOpts = { bold?: boolean; italic?: boolean; size?: number; color?: string };

function run(text: string, opts: RunOpts = {}): string {
  const props: string[] = [];
  if (opts.bold) props.push("<w:b/>");
  if (opts.italic) props.push("<w:i/>");
  if (opts.color) props.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.size) props.push(`<w:sz w:val="${opts.size * 2}"/>`); // half-points
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  // xml:space=preserve so leading/trailing spaces in a run survive.
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

type ParaOpts = { spaceBefore?: number; spaceAfter?: number; bullet?: boolean };

function para(runs: string, opts: ParaOpts = {}): string {
  const spacing = `<w:spacing w:before="${opts.spaceBefore ?? 0}" w:after="${opts.spaceAfter ?? 80}"/>`;
  const bullet = opts.bullet ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "";
  return `<w:p><w:pPr>${spacing}${bullet}</w:pPr>${runs}</w:p>`;
}

function heading(text: string): string {
  return para(run(text.toUpperCase(), { bold: true, size: 11, color: "1D4ED8" }), { spaceBefore: 160, spaceAfter: 60 });
}

/* ── document body ─────────────────────────────────────────────────────────── */

function buildBody(profile: ResumeProfile, targetRole: string): string {
  const b = profile.basics || ({} as ResumeProfile["basics"]);
  const parts: string[] = [];

  // Name and target line.
  if (b.name) parts.push(para(run(b.name, { bold: true, size: 20 }), { spaceAfter: 20 }));
  if (targetRole) parts.push(para(run(targetRole, { size: 11, color: "475569" }), { spaceAfter: 40 }));

  // Contact line.
  const contact = [b.email, b.phone, b.location, b.linkedin].filter(Boolean).join("  |  ");
  if (contact) parts.push(para(run(contact, { size: 9, color: "475569" }), { spaceAfter: 120 }));

  if (profile.summary) {
    parts.push(heading("Summary"));
    parts.push(para(run(profile.summary, { size: 10 })));
  }

  if ((profile.skills || []).length) {
    parts.push(heading("Skills"));
    parts.push(para(run(profile.skills.join("  ·  "), { size: 10 })));
  }

  if ((profile.experience || []).length) {
    parts.push(heading("Experience"));
    for (const role of profile.experience) {
      const header = [role.title, role.company].filter(Boolean).join(", ");
      const line =
        run(header, { bold: true, size: 10.5 }) + (role.dates ? run(`   ${role.dates}`, { size: 9, color: "64748B" }) : "");
      parts.push(para(line, { spaceBefore: 80, spaceAfter: 30 }));
      for (const bullet of role.bullets || []) {
        parts.push(para(run(bullet, { size: 10 }), { bullet: true, spaceAfter: 20 }));
      }
    }
  }

  if ((profile.projects || []).length) {
    parts.push(heading("Projects"));
    for (const project of profile.projects) {
      if (project.name) parts.push(para(run(project.name, { bold: true, size: 10.5 }), { spaceBefore: 60, spaceAfter: 30 }));
      for (const bullet of project.bullets || []) {
        parts.push(para(run(bullet, { size: 10 }), { bullet: true, spaceAfter: 20 }));
      }
    }
  }

  if ((profile.education || []).length) {
    parts.push(heading("Education"));
    for (const edu of profile.education) {
      const line = [edu.degree, edu.institution, edu.dates].filter(Boolean).join(", ");
      if (line) parts.push(para(run(line, { size: 10 }), { spaceAfter: 30 }));
    }
  }

  if ((profile.certifications || []).length) {
    parts.push(heading("Certifications"));
    for (const cert of profile.certifications) parts.push(para(run(cert, { size: 10 }), { bullet: true, spaceAfter: 20 }));
  }

  if ((profile.languages || []).length) {
    parts.push(heading("Languages"));
    parts.push(para(run(profile.languages.join("  ·  "), { size: 10 })));
  }

  const sectPr = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>`;
  return `${parts.join("")}<w:p><w:pPr>${""}</w:pPr></w:p>${sectPr}`;
}

/* ── the fixed OOXML scaffolding ───────────────────────────────────────────── */

function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

// A single bullet list definition (numId 1) so bullet paragraphs render as bullets.
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

/* ── minimal ZIP writer (stored, no compression) ───────────────────────────── */

// CRC32, needed for each zip entry.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

type ZipEntry = { name: string; data: Uint8Array; crc: number; offset: number };

/**
 * Build a valid, stored (uncompressed) ZIP. Word opens stored .docx zips without
 * complaint, so we skip DEFLATE and its dependency entirely.
 */
function zipStored(files: Array<{ name: string; content: string }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

  for (const file of files) {
    const nameBytes = utf8(file.name);
    const data = utf8(file.content);
    const crc = crc32(data);
    const localOffset = offset;

    // Local file header.
    push(u32(0x04034b50));
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method 0 = stored
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(crc));
    push(u32(data.length)); // compressed size == uncompressed
    push(u32(data.length));
    push(u16(nameBytes.length));
    push(u16(0)); // extra len
    push(nameBytes);
    push(data);

    entries.push({ name: file.name, data, crc, offset: localOffset });
  }

  // Central directory.
  const cdStart = offset;
  for (const entry of entries) {
    const nameBytes = utf8(entry.name);
    push(u32(0x02014b50));
    push(u16(20)); // version made by
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method
    push(u16(0)); // time
    push(u16(0)); // date
    push(u32(entry.crc));
    push(u32(entry.data.length));
    push(u32(entry.data.length));
    push(u16(nameBytes.length));
    push(u16(0)); // extra
    push(u16(0)); // comment
    push(u16(0)); // disk number
    push(u16(0)); // internal attrs
    push(u32(0)); // external attrs
    push(u32(entry.offset));
    push(nameBytes);
  }
  const cdSize = offset - cdStart;

  // End of central directory.
  push(u32(0x06054b50));
  push(u16(0));
  push(u16(0));
  push(u16(entries.length));
  push(u16(entries.length));
  push(u32(cdSize));
  push(u32(cdStart));
  push(u16(0)); // comment len

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Build the .docx bytes for a profile. Returns a Uint8Array suitable for
 * downloadBlob(name, bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").
 */
export function buildCvDocxBytes(profile: ResumeProfile, targetRole = ""): Uint8Array {
  const body = buildBody(profile, targetRole);
  return zipStored([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "word/document.xml", content: documentXml(body) },
    { name: "word/_rels/document.xml.rels", content: DOC_RELS },
    { name: "word/numbering.xml", content: NUMBERING },
  ]);
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
