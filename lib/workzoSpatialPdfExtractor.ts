/*
 * WorkZo AI - layout-aware PDF extraction (v3)
 *
 * WHAT WAS WRONG IN v1
 * The extractor had every token's x, y, and width, then joined each row with
 * `items.map(i => i.text).join(" ")` and collapsed all whitespace. The
 * horizontal distance between tokens, which is the ONLY evidence of a column
 * gutter, was discarded before anything downstream could use it. Two
 * consequences, both observed in production output:
 *
 *   1. A sidebar value and a body sentence on the SAME baseline, separated by a
 *      60pt gutter, were welded into one line with a single space:
 *        "German" + "technical support and customer-facing roles. After a
 *         planned career"  ->  one "language".
 *      The same mechanism turns "Seaborn" into "Seaborn Chennai".
 *
 *   2. Letter-spaced display text (one pdf.js item per glyph) lost its word
 *      breaks: "H A R I T H A  V I J A Y A K U M A R" -> "Harithavijayakumar",
 *      "IT Support Specialist / Data Analyst" -> "Itsupportspecialist / Dataanalyst".
 *      That corrupted line then reappeared downstream as a fake project entry.
 *
 * Column DETECTION could not save this, and did not: whenever
 * detectColumnClusters decided "single column" (narrow gutter, uneven balance),
 * every row was joined straight across the page and the corruption happened
 * anyway. Detection was load-bearing for correctness, and it was not reliable
 * enough to be.
 *
 * WHAT THIS DOES
 * A row is no longer a line. A row is a list of SEGMENTS, split only where the
 * whitespace crosses a true column gutter (detected by vertical projection, see
 * the geometry core below). Two columns are now physically incapable of merging
 * into one line, even when column detection is wrong, while a right-aligned date
 * stays on the line it belongs to.
 *
 * Column detection is demoted: it decides reading ORDER only. It can no longer
 * decide correctness.
 *
 * Public API is unchanged. `text` is still the primary output.
 */

import { createRequire } from "module";

export type WorkZoSpatialTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

/** Backward-compatible alias used by the geometry regression suites. */
export type SpatialItem = WorkZoSpatialTextItem;

export type WorkZoSpatialPage = {
  page: number;
  width: number;
  height: number;
  items: WorkZoSpatialTextItem[];
};

/**
 * A geometric block: lines that share a page, a column, and a vertical band.
 * Section boundaries in a CV are geometric, not textual. Carrying column and
 * y-range forward lets a section own a column plus a y-band instead of a
 * substring, which is what makes cross-column bleed structurally impossible
 * rather than something the model has to be begged not to do.
 */
export type WorkZoSpatialBlock = {
  page: number;
  /** 0 = left/sidebar, 1 = right/main, -1 = full-width header band. */
  column: number;
  /** pdf.js user space: larger y is nearer the top of the page. */
  yTop: number;
  yBottom: number;
  xStart: number;
  lines: string[];
};

export type WorkZoSpatialExtractionResult = {
  text: string;
  plainText: string;
  layoutAware: boolean;
  layoutType: "single_column" | "multi_column" | "unknown";
  warnings: string[];
  /** Geometry-preserving view of the same content. Empty on the fallback path. */
  blocks: WorkZoSpatialBlock[];
};

type FallbackPdfParser = (buffer: Buffer) => Promise<string>;

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type RowSegment = { x: number; y: number; text: string };

/** Horizontal whitespace band detected as a persistent page column gutter. */
export type Gutter = { x1: number; x2: number };

/* ------------------------- geometry core (v4) ----------------------------- *
 * WHY v3 WAS NOT GLOBAL
 * v3 hard-broke a row wherever the gap between two tokens exceeded a threshold.
 * That breaks a layout far more common than a sidebar:
 *
 *     Senior Engineer, Acme GmbH                          2018 - 2021
 *     ^-------------------------^  330pt of whitespace  ^-----------^
 *
 * A right-aligned date is a TAB STOP, not a column. v3 tore the date off its own
 * job and emitted it as a separate line. It "fixed" two-column CVs by breaking
 * every single-column CV with right-aligned dates, which is most of them.
 *
 * THE ACTUAL DISCRIMINATOR
 * A column gutter is whitespace that runs VERTICALLY DOWN THE PAGE. A tab stop
 * is a gap present on some rows and written straight through on others (bullets
 * and prose cross it). So: project all text onto the x axis, count how many ROWS
 * put ink in each band, and call a band a gutter only when it is empty across
 * nearly every row. Break a row only where its gap actually crosses one.
 *
 * Decided per page, from that page's own ink. No template, no lexicon, no page
 * size assumption, no CV-specific tuning.
 * -------------------------------------------------------------------------- */

function safeText(value: unknown): string {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function medianFontSize(items: WorkZoSpatialTextItem[]): number {
  return median(items.map((i) => i.height).filter((h) => h > 0)) || 10;
}

function itemWidth(item: WorkZoSpatialTextItem, fontSize: number): number {
  if (Number.isFinite(item.width) && item.width > 0) return item.width;
  return Math.max(1, item.text.length * fontSize * 0.5);
}

/** Group items into visual rows, tolerant of baseline jitter. */
export function groupIntoRows(
  items: WorkZoSpatialTextItem[],
  fontSize: number = medianFontSize(items),
): WorkZoSpatialTextItem[][] {
  const yTolerance = Math.max(2, fontSize * 0.4);
  const sorted = [...items].filter((i) => i.text.trim()).sort((a, b) => b.y - a.y);

  const rows: WorkZoSpatialTextItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= yTolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows;
}

/**
 * Vertical whitespace projection.
 *
 * A gutter must satisfy ALL of:
 *   - empty on at least GUTTER_EMPTY_RATIO of the page's text rows,
 *   - at least MIN_GUTTER_WIDTH wide,
 *   - have real text on BOTH sides (otherwise it is just a page margin).
 *
 * A right-aligned date column fails the first test: bullets and prose lines run
 * straight through that x band, so it is occupied on most rows.
 */
export function detectGutters(items: WorkZoSpatialTextItem[], pageWidth: number): Gutter[] {
  const fontSize = medianFontSize(items);
  const rows = groupIntoRows(items, fontSize);
  if (rows.length < 6) return [];

  const BIN = 2; // pt
  const bins = Math.max(1, Math.ceil(pageWidth / BIN));
  const rowsCovering = new Array<number>(bins).fill(0);

  for (const row of rows) {
    const covered = new Set<number>();
    for (const item of row) {
      const start = Math.max(0, Math.floor(item.x / BIN));
      const end = Math.min(bins - 1, Math.floor((item.x + itemWidth(item, fontSize)) / BIN));
      for (let b = start; b <= end; b += 1) covered.add(b);
    }
    covered.forEach((b) => {
      rowsCovering[b] += 1;
    });
  }

  // A band is "empty" if almost no row puts ink in it. Deliberately strict: a
  // single stray full-width line (a horizontal rule rendered as text, a footer)
  // must not be able to erase a real gutter, but a band that half the rows write
  // through is definitely not a gutter.
  const EMPTY_MAX_ROWS = Math.max(1, Math.floor(rows.length * 0.06));
  const MIN_GUTTER_WIDTH = Math.max(18, pageWidth * 0.03);

  const gutters: Gutter[] = [];
  let runStart = -1;

  for (let b = 0; b <= bins; b += 1) {
    const empty = b < bins && rowsCovering[b] <= EMPTY_MAX_ROWS;
    if (empty && runStart === -1) runStart = b;
    if (!empty && runStart !== -1) {
      const x1 = runStart * BIN;
      const x2 = b * BIN;
      if (x2 - x1 >= MIN_GUTTER_WIDTH) {
        // Must have substantial ink on BOTH sides, or it is a margin.
        const leftInk = rowsCovering.slice(0, runStart).reduce((a, c) => a + c, 0);
        const rightInk = rowsCovering.slice(b).reduce((a, c) => a + c, 0);
        const minSide = Math.min(leftInk, rightInk);
        const totalInk = leftInk + rightInk;
        if (totalInk > 0 && minSide / totalInk >= 0.1) gutters.push({ x1, x2 });
      }
      runStart = -1;
    }
  }

  return gutters;
}

/**
 * A run of single-character items is letter-spaced display text. Word boundaries
 * survive in the gap sizes: small gaps are letter tracking, large gaps are
 * spaces. Compare each gap to the run's OWN median gap, so this holds at any
 * font size and any tracking value, in any script.
 */
function resolveLetterSpacedRun(items: WorkZoSpatialTextItem[], fontSize: number): string {
  const gaps: number[] = [];
  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    gaps.push(items[i].x - (prev.x + itemWidth(prev, fontSize)));
  }
  const typical = median(gaps.filter((g) => g >= 0));
  const wordBreak = Math.max(typical * 1.8, fontSize * 0.25);

  let out = items[0].text;
  for (let i = 1; i < items.length; i += 1) {
    out += gaps[i - 1] > wordBreak ? " " : "";
    out += items[i].text;
  }
  return out;
}

/** Does the whitespace between two tokens actually cross a gutter? */
function crossesGutter(leftEdge: number, rightEdge: number, gutters: Gutter[]): boolean {
  return gutters.some((g) => {
    const overlap = Math.min(rightEdge, g.x2) - Math.max(leftEdge, g.x1);
    // The gap must swallow most of the gutter, not merely touch it.
    return overlap > 0 && overlap >= (g.x2 - g.x1) * 0.8;
  });
}

/**
 * Split one visual row into segments, breaking ONLY at true gutters.
 * A tab stop (right-aligned dates) stays on its own line as a wide space.
 */
export function segmentRow(
  items: WorkZoSpatialTextItem[],
  guttersOrPageWidth: Gutter[] | number,
  fontSize: number,
): RowSegment[] {
  const row = [...items].filter((i) => i.text.trim()).sort((a, b) => a.x - b.x);
  if (!row.length) return [];

  // Backward-compatible test/helper signature:
  //   segmentRow(items, pageWidth, fontSize)
  // Production extraction passes page-level gutters directly. When a page
  // width is supplied, infer only exceptionally large gaps on this row. This
  // preserves the older regression contract without weakening the canonical
  // page-level gutter detection used by the extractor.
  const gutters: Gutter[] = Array.isArray(guttersOrPageWidth)
    ? guttersOrPageWidth
    : (() => {
        const pageWidth = guttersOrPageWidth;
        const minGap = Math.max(24, fontSize * 2.2, pageWidth * 0.06);
        const inferred: Gutter[] = [];
        for (let i = 1; i < row.length; i += 1) {
          const leftEdge = row[i - 1].x + itemWidth(row[i - 1], fontSize);
          const rightEdge = row[i].x;
          if (rightEdge - leftEdge >= minGap) inferred.push({ x1: leftEdge, x2: rightEdge });
        }
        return inferred;
      })();

  // Intra-word glyph splits arrive with a gap at or near zero. Anything above a
  // hair of a millimetre is a real word space. Keep this LOW: a high threshold
  // welds "Senior" and "Engineer" into "SeniorEngineer".
  const WORD_GAP = Math.max(0.5, fontSize * 0.08);

  const segments: RowSegment[] = [];
  let buffer: WorkZoSpatialTextItem[] = [row[0]];

  const flush = () => {
    if (!buffer.length) return;
    const singles = buffer.filter((i) => i.text.trim().length === 1).length;
    const isLetterSpaced = buffer.length >= 4 && singles / buffer.length >= 0.8;

    let text: string;
    if (isLetterSpaced) {
      text = resolveLetterSpacedRun(buffer, fontSize);
    } else {
      text = buffer[0].text;
      for (let i = 1; i < buffer.length; i += 1) {
        const prev = buffer[i - 1];
        const gap = buffer[i].x - (prev.x + itemWidth(prev, fontSize));
        const needsSpace =
          gap > WORD_GAP && !/\s$/.test(text) && !/^\s/.test(buffer[i].text);
        text += needsSpace ? " " : "";
        text += buffer[i].text;
      }
    }

    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) segments.push({ x: buffer[0].x, y: buffer[0].y, text: clean });
    buffer = [];
  };

  for (let i = 1; i < row.length; i += 1) {
    const prev = row[i - 1];
    const leftEdge = prev.x + itemWidth(prev, fontSize);
    const rightEdge = row[i].x;

    if (rightEdge > leftEdge && crossesGutter(leftEdge, rightEdge, gutters)) {
      flush();
      buffer = [row[i]];
    } else {
      buffer.push(row[i]);
    }
  }
  flush();

  return segments;
}

/**
 * Convert one page into stable row segments while preserving reading geometry.
 *
 * This helper intentionally performs page-level gutter detection once, then
 * applies those gutters to every visual row. Keeping it centralized prevents
 * reconstructPage() and the plain-text fallback from drifting apart.
 */
function pageSegments(page: WorkZoSpatialPage): RowSegment[] {
  const items = page.items.filter((item) => item.text.trim());
  if (!items.length) return [];

  const fontSize = medianFontSize(items);
  const gutters = detectGutters(items, page.width || 595);
  const yTolerance = Math.max(2, fontSize * 0.4);

  return groupIntoRows(items, fontSize)
    .flatMap((row) => segmentRow(row, gutters, fontSize))
    .sort((a, b) => {
      const yDelta = b.y - a.y;
      return Math.abs(yDelta) > yTolerance ? yDelta : a.x - b.x;
    });
}

/* --------------------------- column reconstruction ------------------------ */

/**
 * Reading ORDER only. Correctness no longer depends on this being right,
 * because segments already cannot cross a gutter.
 */
function detectSplitX(segments: RowSegment[], pageWidth: number) {
  if (segments.length < 8) return { isMultiColumn: false, splitX: pageWidth / 2 };

  const xs = segments
    .map((s) => s.x)
    .filter((x) => x > pageWidth * 0.03 && x < pageWidth * 0.97)
    .sort((a, b) => a - b);
  if (xs.length < 8) return { isMultiColumn: false, splitX: pageWidth / 2 };

  let bestGap = 0;
  let bestSplit = pageWidth / 2;
  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];
    const midpoint = (xs[i] + xs[i - 1]) / 2;
    if (midpoint < pageWidth * 0.22 || midpoint > pageWidth * 0.78) continue;
    if (gap > bestGap) {
      bestGap = gap;
      bestSplit = midpoint;
    }
  }

  const left = segments.filter((s) => s.x <= bestSplit).length;
  const right = segments.filter((s) => s.x > bestSplit).length;
  const smallerRatio = Math.min(left, right) / Math.max(1, segments.length);
  const isMultiColumn = bestGap >= Math.max(30, pageWidth * 0.05) && smallerRatio >= 0.12;

  return { isMultiColumn, splitX: bestSplit };
}

function toBlock(page: number, column: number, segments: RowSegment[]): WorkZoSpatialBlock | null {
  if (!segments.length) return null;
  return {
    page,
    column,
    yTop: Math.max(...segments.map((s) => s.y)),
    yBottom: Math.min(...segments.map((s) => s.y)),
    xStart: Math.min(...segments.map((s) => s.x)),
    lines: segments.map((s) => s.text),
  };
}

function reconstructPage(page: WorkZoSpatialPage): {
  text: string;
  isMultiColumn: boolean;
  blocks: WorkZoSpatialBlock[];
} {
  const segments = pageSegments(page);
  const width = page.width || 595;
  const height = page.height || 842;
  const { isMultiColumn, splitX } = detectSplitX(segments, width);

  if (!isMultiColumn) {
    const block = toBlock(page.page, 0, segments);
    return {
      text: segments.map((s) => s.text).join("\n"),
      isMultiColumn: false,
      blocks: block ? [block] : [],
    };
  }

  // A full-width header band exists when the top band carries segments on BOTH
  // sides of the split. That is exactly the case where naive left-then-right
  // serialization separates the name from the headline, or buries the name
  // behind the entire sidebar.
  const maxY = segments.reduce((m, s) => (s.y > m ? s.y : m), -Infinity);
  const headerThreshold = maxY - height * 0.16;
  const headerBand = segments.filter((s) => s.y >= headerThreshold);
  const hasCrossColumnHeader =
    Number.isFinite(maxY) &&
    headerBand.some((s) => s.x <= splitX) &&
    headerBand.some((s) => s.x > splitX);

  const body = hasCrossColumnHeader ? segments.filter((s) => s.y < headerThreshold) : segments;
  const left = body.filter((s) => s.x <= splitX);
  const right = body.filter((s) => s.x > splitX);

  const blocks = [
    hasCrossColumnHeader ? toBlock(page.page, -1, headerBand) : null,
    toBlock(page.page, 0, left),
    toBlock(page.page, 1, right),
  ].filter(Boolean) as WorkZoSpatialBlock[];

  // No alphabetic layout markers in the text: downstream parsers mistake them
  // for names and headlines. Reading order: header, then sidebar, then body.
  const text = [
    hasCrossColumnHeader ? headerBand.map((s) => s.text).join("\n") : "",
    left.map((s) => s.text).join("\n"),
    right.map((s) => s.text).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { text, isMultiColumn: true, blocks };
}

/* -------------------------------- pdf.js loader --------------------------- */

async function loadPdfJs(): Promise<any | null> {
  const candidates = [
    "pdfjs-dist/legacy/build/pdf.mjs",
    "pdfjs-dist/legacy/build/pdf.js",
    "pdfjs-dist/build/pdf.mjs",
    "pdfjs-dist/build/pdf.js",
  ];

  const normalize = (mod: any) =>
    mod?.getDocument ? mod : mod?.default?.getDocument ? mod.default : null;

  let lastError: unknown = null;

  try {
    const nodeRequire = createRequire(`${process.cwd()}/workzo-pdf-resolver.js`);
    for (const specifier of candidates) {
      try {
        const mod = normalize(nodeRequire(specifier));
        if (mod) return mod;
      } catch (error) {
        lastError = error;
      }
    }
  } catch (error) {
    lastError = error;
  }

  for (const specifier of candidates) {
    try {
      const mod = normalize(await import(/* webpackIgnore: true */ specifier));
      if (mod) return mod;
    } catch (error) {
      lastError = error;
    }
  }

  // IF THIS LINE APPEARS IN YOUR LOGS, NOTHING ELSE IN THIS FILE IS RUNNING.
  // Layout-aware extraction is OFF, every multi-column CV is being flattened by
  // the naive parser, and the corruption this file exists to prevent WILL occur.
  // Fix: install pdfjs-dist and add it to serverExternalPackages in next.config.
  console.error(
    "[workzoSpatialPdfExtractor] CRITICAL: pdfjs-dist failed to load server-side. " +
      "Layout-aware extraction is DISABLED and multi-column CVs will be scrambled.",
    lastError,
  );
  return null;
}

async function extractWithPdfJs(buffer: Buffer): Promise<WorkZoSpatialExtractionResult | null> {
  const pdfjs = await loadPdfJs();
  if (!pdfjs?.getDocument) return null;

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;

  const pages: WorkZoSpatialPage[] = [];
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    // disableCombineTextItems keeps glyph-level items intact. That is what makes
    // letter-spaced headers recoverable instead of pre-welded by pdf.js itself.
    const content = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: true,
    });

    const items: WorkZoSpatialTextItem[] = (content.items || [])
      .map((raw: PdfJsTextItem): WorkZoSpatialTextItem | null => {
        const transform = Array.isArray(raw.transform) ? raw.transform : [];
        const text = safeText(raw.str);
        if (!text) return null;
        return {
          text,
          x: Number(transform[4] || 0),
          y: Number(transform[5] || 0),
          width: Number(raw.width || 0),
          height: Number(raw.height || transform[3] || 0),
          page: pageIndex,
        };
      })
      .filter(Boolean) as WorkZoSpatialTextItem[];

    pages.push({
      page: pageIndex,
      width: Number(viewport.width || 595),
      height: Number(viewport.height || 842),
      items,
    });
  }

  const reconstructed = pages.map(reconstructPage);
  const layoutAwareText = reconstructed.map((p) => p.text).filter(Boolean).join("\n\n");

  // plainText is segment-safe too, so even the "plain" view can no longer weld
  // two columns together.
  const plainText = pages
    .map((p) => pageSegments(p).map((s) => s.text).join("\n"))
    .join("\n\n");

  const hasMultiColumn = reconstructed.some((p) => p.isMultiColumn);

  return {
    text: layoutAwareText || plainText,
    plainText,
    layoutAware: true,
    layoutType: hasMultiColumn ? "multi_column" : "single_column",
    warnings: hasMultiColumn ? ["spatial_multicolumn_reconstruction_used"] : [],
    blocks: reconstructed.flatMap((p) => p.blocks),
  };
}

function hasLikelyColumnDamage(text: string): boolean {
  const sample = String(text || "").slice(0, 3000);
  if (!sample) return false;
  const compactSectionHeaders = (
    sample.match(
      /\b(?:S\s*K\s*I\s*L\s*L\s*S|C\s*O\s*N\s*T\s*A\s*C\s*T|E\s*D\s*U\s*C\s*A\s*T\s*I\s*O\s*N|W\s*O\s*R\s*K\s*E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E)\b/gi,
    ) || []
  ).length;
  const mixedSignals = [
    /skills?[\s\S]{0,120}(?:\b[A-Z][a-z]+\s+[A-Z][a-z]+\b)[\s\S]{0,120}(?:experience|education)/i,
    /contact[\s\S]{0,120}(?:work experience|berufserfahrung)/i,
    /education\s*work\s*experience/i,
  ].some((re) => re.test(sample));
  return compactSectionHeaders >= 2 || mixedSignals;
}

export async function extractPdfTextLayoutAware(
  buffer: Buffer,
  fallbackParser: FallbackPdfParser,
): Promise<WorkZoSpatialExtractionResult> {
  try {
    const spatial = await extractWithPdfJs(buffer);
    if (spatial?.text?.trim()) return spatial;
  } catch (error) {
    console.error("[workzoSpatialPdfExtractor] layout-aware extraction threw", error);
  }

  const fallbackText = await fallbackParser(buffer);
  const damaged = hasLikelyColumnDamage(fallbackText);
  return {
    text: fallbackText,
    plainText: fallbackText,
    layoutAware: false,
    layoutType: damaged ? "multi_column" : "unknown",
    // No geometry on this path. Treat an empty blocks array as "layout unknown",
    // never as "single column". On this path the text sanitizer is the only
    // thing standing between raw flattening and the parser, so it must run.
    blocks: [],
    warnings: damaged
      ? ["fallback_pdf_parse_used", "possible_multicolumn_flattening"]
      : ["fallback_pdf_parse_used"],
  };
}

export const __workzoSpatialPdfExtractorVersion = "4.0.0-gutter-projection";
