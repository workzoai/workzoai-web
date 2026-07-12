/*
 * WorkZo AI - deterministic CV text sanitizer
 *
 * Runs on EXTRACTED TEXT, before the parser and before any AI call. It repairs
 * the corruption that PDF extraction introduces, on BOTH the layout-aware path
 * and the naive fallback path.
 *
 * WHY IT EXISTS
 * Every defect observed in a broken WorkZo CV output is already present in the
 * raw extracted text. The AI is not inventing them and the fact guard is not
 * failing: the guard is faithfully preserving corrupt source data. Fix the text
 * and every stage downstream of it gets correct for free.
 *
 * THE FOUR CORRUPTION CLASSES, and the structural rule that kills each:
 *
 *  1. WRAP FRAGMENTS. A wrapped line is re-emitted as a standalone line.
 *     Rule: a line wholly CONTAINED in another line of the same section is an
 *     extraction artifact. Containment, not similarity, so real content is safe.
 *
 *  2. DUPLICATE LINES. Same line twice, different case or trailing period.
 *     Rule: fold case/punctuation-insensitive duplicates within a section.
 *
 *  3. HEADER ECHO IN THE BODY. The name/headline band is re-serialized inside a
 *     body section and becomes a fake project or a fake job.
 *     Rule: no entry may be named the candidate. Drop it and its decorative tail.
 *
 *  4. CROSS-SECTION PROSE BLEED. A sidebar list line absorbs body prose from the
 *     neighbouring column at the same vertical position.
 *     Rule: in a LIST section, any word span that also occurs verbatim in a
 *     DIFFERENT section is foreign. Excise the span, keep the rest of the line.
 *
 * Rule 4 is what makes "Seaborn" -> "Seaborn Chennai" impossible: the foreign
 * token provably belongs to another section, however the columns were flattened.
 *
 * Entity-free by construction. No name, company, school, tool, or language is
 * hardcoded. Section boundaries come from the parser's own multilingual lexicon
 * (findSectionKind), so the sanitizer and the parser can never disagree.
 */

import { findSectionKind, type ResumeSectionKind } from "@/lib/workzoResumeParser";
import { isValidHumanName } from "@/lib/workzoResumeProfileManager";

export type SanitizeOptions = {
  /** Canonical name when already known (onboarding, filename). Optional. */
  candidateName?: string;
  /** Minimum key length before a contained line counts as a wrap fragment. */
  minFragmentLength?: number;
  /** Word-window width for cross-section echo detection. */
  echoWindow?: number;
};

export type SanitizeReport = {
  text: string;
  removedFragments: string[];
  removedDuplicates: string[];
  removedHeaderEchoes: string[];
  trimmedBleeds: string[];
  warnings: string[];
};

/** Sections whose content is atomic values, never prose. */
const LIST_SECTIONS: ResumeSectionKind[] = ["languages", "skills", "certifications"];

const BULLET_PREFIX = /^[\s\u2022\u2023\u25E6\u2043\u2219*\u00b7\u2010-\u2015-]+/;

function stripBullet(line: string): string {
  return line.replace(BULLET_PREFIX, "").trim();
}

/** Comparison key: case, punctuation, and spacing insensitive. */
function key(line: string): string {
  return stripBullet(line)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters and digits only, for matching a compacted header echo. */
function compact(value: string): string {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function keyWords(value: string): string[] {
  return key(value).split(" ").filter(Boolean);
}

/* ------------------------------- sectioning ------------------------------ */

type Section = { heading: string; kind: ResumeSectionKind | null; lines: string[] };

function splitIntoSections(text: string): Section[] {
  const sections: Section[] = [{ heading: "", kind: null, lines: [] }];
  for (const line of text.split(/\r?\n/)) {
    const kind = line.trim() ? findSectionKind(line) : null;
    if (kind) sections.push({ heading: line.trim(), kind, lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  return sections;
}

/* --------------------------- rules 1 and 2 ------------------------------- */

/**
 * Entry boundaries inside a section.
 *
 * WHY THIS EXISTS: scoping duplicate-folding to the whole SECTION deletes real
 * data. Two different jobs can legitimately carry the SAME bullet ("Managed a
 * team of twelve"), and section-scoped dedupe silently drops the second one.
 * Extraction artifacts, by contrast, always land inside the entry they were
 * torn from.
 *
 * An entry starts at each non-bullet line (a job header, a project name). If a
 * section has no bullet markers at all there are no entry boundaries to find,
 * so fall back to section scope: in a bullet-less section, an exactly repeated
 * line is an artifact with near-certainty.
 */
function splitIntoEntries(lines: string[]): string[][] {
  const hasBullets = lines.some((l) => BULLET_PREFIX.test(l) && stripBullet(l));
  if (!hasBullets) return [lines];

  const entries: string[][] = [];
  for (const line of lines) {
    const isBullet = BULLET_PREFIX.test(line) && Boolean(stripBullet(line));
    if (!isBullet || !entries.length) entries.push([line]);
    else entries[entries.length - 1].push(line);
  }
  return entries;
}

function dropFragmentsAndDuplicates(
  lines: string[],
  minFragmentLength: number,
  removedFragments: string[],
  removedDuplicates: string[],
): string[] {
  return splitIntoEntries(lines).flatMap((entry) =>
    dropFragmentsAndDuplicatesWithinEntry(entry, minFragmentLength, removedFragments, removedDuplicates),
  );
}

function dropFragmentsAndDuplicatesWithinEntry(
  lines: string[],
  minFragmentLength: number,
  removedFragments: string[],
  removedDuplicates: string[],
): string[] {
  const keys = lines.map(key);
  const keep = lines.map(() => true);
  const seen = new Map<string, number>();

  for (let i = 0; i < lines.length; i += 1) {
    const k = keys[i];
    if (!k) continue;

    if (seen.has(k)) {
      keep[i] = false;
      removedDuplicates.push(lines[i].trim());
      continue;
    }
    seen.set(k, i);

    if (k.length < minFragmentLength) continue;
    for (let j = 0; j < lines.length; j += 1) {
      if (i === j || !keys[j] || !keep[j]) continue;
      if (keys[j].length <= k.length) continue;
      if (keys[j].includes(k)) {
        keep[i] = false;
        removedFragments.push(lines[i].trim());
        break;
      }
    }
  }

  return lines.filter((_, i) => keep[i]);
}

/* -------------------------------- rule 3 --------------------------------- */

/**
 * The header band re-serialized into a body section. It starts at a line that
 * compacts to the candidate's own name and continues through the decorative
 * tail (the headline, and its all-caps repeat). A real entry carries a date, a
 * company separator, or a real sentence, so those stop the drop immediately. A
 * section heading also stops it, because sectioning already split there.
 */
function dropHeaderEchoes(
  lines: string[],
  candidateName: string,
  removedHeaderEchoes: string[],
): string[] {
  const target = compact(candidateName);
  if (target.length < 6) return lines;

  const out: string[] = [];
  let dropping = false;

  for (const line of lines) {
    if (compact(line) === target) {
      dropping = true;
      removedHeaderEchoes.push(line.trim());
      continue;
    }
    if (dropping) {
      if (!line.trim()) continue;
      const isRealContent = /\d{4}/.test(line) || /[|@]/.test(line) || keyWords(line).length > 8;
      if (!isRealContent) {
        removedHeaderEchoes.push(line.trim());
        continue;
      }
      dropping = false;
    }
    out.push(line);
  }

  return out;
}

/* -------------------------------- rule 4 --------------------------------- */

/**
 * Sections whose text is prose. Only prose can BLEED into a list: a sidebar
 * value that absorbed a body sentence. A value that merely happens to also
 * appear in another LIST is not a bleed, it is a coincidence.
 */
const PROSE_SECTIONS: ResumeSectionKind[] = ["summary", "experience", "projects"];

type Tok = { raw: string; words: string[] };

function tokenize(value: string): Tok[] {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, words: keyWords(raw) }));
}

function collectWindows(text: string, echoWindow: number): Set<string> {
  const out = new Set<string>();
  const w = keyWords(text);
  for (let i = 0; i + echoWindow <= w.length; i += 1) {
    out.add(w.slice(i, i + echoWindow).join(" "));
  }
  return out;
}

/**
 * A plausible list value is short and carries no sentence punctuation. A real
 * certification ("AWS Certified Solutions Architect Associate") looks like this
 * even when the candidate also names it in a bullet. Such a value is NEVER
 * touched, which is what stops the bleed rule from eating legitimate content
 * that is simply mentioned twice.
 */
function isPlausibleListValue(value: string): boolean {
  const w = keyWords(value);
  if (!w.length) return true;
  if (w.length > 5) return false;
  if (/[.!?]/.test(value.replace(/\.$/, ""))) return false;
  return true;
}

/**
 * Excise foreign prose from ONE list value. Never truncate, never empty.
 * If every token in the value is foreign, the value is not contaminated: it IS
 * the other text. Leave it alone. That asymmetry is the whole safety property.
 */
function exciseForeignSpan(
  value: string,
  foreign: Set<string>,
  echoWindow: number,
  trimmedBleeds: string[],
): string {
  const toks = tokenize(value);
  if (!toks.length) return value;

  const flat: string[] = [];
  const owner: number[] = [];
  toks.forEach((tok, i) => {
    tok.words.forEach((w) => {
      flat.push(w);
      owner.push(i);
    });
  });
  if (flat.length <= echoWindow) return value;

  const foreignWord = new Array<boolean>(flat.length).fill(false);
  for (let i = 0; i + echoWindow <= flat.length; i += 1) {
    if (foreign.has(flat.slice(i, i + echoWindow).join(" "))) {
      for (let j = i; j < i + echoWindow; j += 1) foreignWord[j] = true;
    }
  }
  if (!foreignWord.some(Boolean)) return value;

  // SAFETY: if the entire value is foreign, this is not a bleed. Do not delete.
  if (foreignWord.every(Boolean)) return value;

  const total = toks.map(() => 0);
  const bad = toks.map(() => 0);
  flat.forEach((_, i) => {
    total[owner[i]] += 1;
    if (foreignWord[i]) bad[owner[i]] += 1;
  });
  const dropTok = toks.map((_, i) => total[i] > 0 && bad[i] === total[i]);

  const kept = toks
    .filter((_, i) => !dropTok[i])
    .map((t) => t.raw)
    .join(" ")
    .replace(/\s+([,;:.])/g, "$1")
    .replace(/^[\s,;:.]+|[\s,;:.]+$/g, "")
    .trim();

  // SAFETY: never return nothing.
  if (!kept) return value;

  trimmedBleeds.push(`${value.trim()}\n           ->  ${kept}`);
  return kept;
}

/**
 * Repair one line of a list section.
 * The line is a comma-separated list of VALUES. Operate per value, never on the
 * line as a whole, so a bleed inside value 2 cannot damage values 1 and 3.
 */
function repairListLine(
  line: string,
  foreign: Set<string>,
  echoWindow: number,
  trimmedBleeds: string[],
): string {
  const values = line.split(",").map((v) => v.trim()).filter(Boolean);
  if (!values.length) return line;

  const repaired = values.map((value) =>
    isPlausibleListValue(value) ? value : exciseForeignSpan(value, foreign, echoWindow, trimmedBleeds),
  );

  // Fold duplicates, and absorb any value wholly contained in another
  // ("Englisch" inside "Englisch - Verhandlungssicher").
  const keys = repaired.map(key);
  const out: string[] = [];
  const seen = new Set<string>();
  repaired.forEach((value, i) => {
    const k = keys[i];
    if (!k || seen.has(k)) return;
    const swallowed = keys.some((other, j) => j !== i && other.length > k.length && other.includes(k));
    if (swallowed) return;
    seen.add(k);
    out.push(value);
  });

  return out.join(", ");
}

/* -------------------------------- pipeline ------------------------------- */

export function sanitizeExtractedCvText(
  rawText: string,
  options: SanitizeOptions = {},
): SanitizeReport {
  const minFragmentLength = options.minFragmentLength ?? 15;
  const echoWindow = options.echoWindow ?? 5;

  const removedFragments: string[] = [];
  const removedDuplicates: string[] = [];
  const removedHeaderEchoes: string[] = [];
  const trimmedBleeds: string[] = [];
  const warnings: string[] = [];

  const text = String(rawText || "");
  if (!text.trim()) {
    return { text, removedFragments, removedDuplicates, removedHeaderEchoes, trimmedBleeds, warnings };
  }

  const sections = splitIntoSections(text);

  const headerBand = (sections[0]?.lines || []).map((l) => l.trim()).filter(Boolean);
  const candidateName = (options.candidateName || headerBand[0] || "").trim();

  // Pass 1: fragments, duplicates, header echoes.
  for (const section of sections) {
    section.lines = dropFragmentsAndDuplicates(
      section.lines,
      minFragmentLength,
      removedFragments,
      removedDuplicates,
    );
    // Rule 3 runs ONLY on entry-shaped sections, and ONLY when the name we are
    // matching is actually a human name. If the header band was corrupted and
    // "candidateName" is really a skill, matching it against list values would
    // delete real skills. The codebase's own validator is the gate.
    if (
      section.kind &&
      !LIST_SECTIONS.includes(section.kind) &&
      isValidHumanName(candidateName)
    ) {
      section.lines = dropHeaderEchoes(section.lines, candidateName, removedHeaderEchoes);
    }
  }

  // Pass 2: cross-section bleed, list sections only.
  const bodyText = sections.map((s) => s.lines.join("\n"));
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (!section.kind || !LIST_SECTIONS.includes(section.kind)) continue;

    // Only PROSE can bleed into a list. Sourcing foreign windows from other
    // lists would let a skill that is also a certification delete itself.
    const foreign = new Set<string>();
    for (let j = 0; j < sections.length; j += 1) {
      if (j === i) continue;
      if (!sections[j].kind || !PROSE_SECTIONS.includes(sections[j].kind as ResumeSectionKind)) continue;
      for (const w of collectWindows(bodyText[j], echoWindow)) foreign.add(w);
    }

    section.lines = section.lines
      .map((line) => (line.trim() ? repairListLine(line, foreign, echoWindow, trimmedBleeds) : line))
      .filter((line) => line.trim() !== "");

    section.lines = dropFragmentsAndDuplicates(
      section.lines,
      minFragmentLength,
      removedFragments,
      removedDuplicates,
    );
  }

  if (removedFragments.length) warnings.push("wrap_fragments_removed");
  if (removedDuplicates.length) warnings.push("duplicate_lines_removed");
  if (removedHeaderEchoes.length) warnings.push("header_echo_removed_from_body");
  if (trimmedBleeds.length) warnings.push("cross_section_bleed_excised");

  const out = sections
    .map((s) => [s.heading, ...s.lines].filter((l) => l !== undefined && l !== "").join("\n"))
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: out, removedFragments, removedDuplicates, removedHeaderEchoes, trimmedBleeds, warnings };
}

export const __workzoCvTextSanitizerVersion = "1.0.0-global";
