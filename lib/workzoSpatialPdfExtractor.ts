/*
 * WorkZo AI - layout-aware PDF extraction
 *
 * Global purpose:
 * - Avoid the classic multi-column PDF flattening bug where sidebar skills,
 *   contacts, names, and work history are interleaved into one broken string.
 * - Preserve enough structure for downstream deterministic parsers and OpenRouter
 *   strict JSON extraction to understand the resume like a recruiter sees it.
 *
 * This file contains no user-specific names, companies, schools, or CV samples.
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

export type WorkZoSpatialPage = {
  page: number;
  width: number;
  height: number;
  items: WorkZoSpatialTextItem[];
};

export type WorkZoSpatialExtractionResult = {
  text: string;
  plainText: string;
  layoutAware: boolean;
  layoutType: "single_column" | "multi_column" | "unknown";
  warnings: string[];
};

type FallbackPdfParser = (buffer: Buffer) => Promise<string>;

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function safeText(value: unknown): string {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLine(value: string): string {
  return safeText(value)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([\])}])/g, "$1")
    .trim();
}

function joinTokensIntoLines(items: WorkZoSpatialTextItem[], yTolerance = 3.5): string[] {
  const sorted = [...items]
    .filter((item) => safeText(item.text))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) <= yTolerance) return a.x - b.x;
      return b.y - a.y;
    });

  const rows: WorkZoSpatialTextItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) <= yTolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows
    .map((row) =>
      normalizeLine(
        row
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(" "),
      ),
    )
    .filter(Boolean);
}

function detectColumnClusters(items: WorkZoSpatialTextItem[], pageWidth: number) {
  const clean = items.filter((item) => safeText(item.text) && item.x >= 0 && item.x <= pageWidth);
  if (clean.length < 12) {
    return { isMultiColumn: false, splitX: pageWidth / 2, leftCount: clean.length, rightCount: 0 };
  }

  // Ignore extreme page margins. We want text-body columns, not decorative bullets.
  const xs = clean
    .map((item) => item.x)
    .sort((a, b) => a - b)
    .filter((x) => x > pageWidth * 0.03 && x < pageWidth * 0.97);

  if (xs.length < 12) {
    return { isMultiColumn: false, splitX: pageWidth / 2, leftCount: clean.length, rightCount: 0 };
  }

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

  const leftCount = clean.filter((item) => item.x <= bestSplit).length;
  const rightCount = clean.filter((item) => item.x > bestSplit).length;
  const smallerRatio = Math.min(leftCount, rightCount) / Math.max(1, clean.length);

  // A real two-column/sidebar CV usually has a visible whitespace gutter and
  // meaningful text on both sides. This dynamic split is safer than a fixed A4 midpoint.
  const isMultiColumn = bestGap >= Math.max(34, pageWidth * 0.055) && smallerRatio >= 0.16;
  return { isMultiColumn, splitX: bestSplit, leftCount, rightCount };
}

function reconstructPage(page: WorkZoSpatialPage): { text: string; isMultiColumn: boolean } {
  const { isMultiColumn, splitX } = detectColumnClusters(page.items, page.width || 595);

  if (!isMultiColumn) {
    return {
      text: joinTokensIntoLines(page.items).join("\n"),
      isMultiColumn: false,
    };
  }

  // Detect a full-width header band at the top of the page. In pdf.js user
  // space larger y is nearer the top, so the header lives in the highest ~16%.
  // A header only counts as "full width" if the top band contains items on BOTH
  // sides of the column split — that is exactly the case where naive
  // left-then-right serialization splits the candidate name from the headline
  // (or drops the name behind the entire sidebar). When present, serialize the
  // header first so the parser sees "Name\nHeadline" as the first lines.
  const maxY = page.items.reduce((m, item) => (item.y > m ? item.y : m), -Infinity);
  const headerThreshold = maxY - (page.height || 842) * 0.16;
  const headerBand = page.items.filter((item) => item.y >= headerThreshold);
  const hasCrossColumnHeader =
    Number.isFinite(maxY) &&
    headerBand.some((item) => item.x <= splitX) &&
    headerBand.some((item) => item.x > splitX);

  const bodyItems = hasCrossColumnHeader
    ? page.items.filter((item) => item.y < headerThreshold)
    : page.items;

  const left = bodyItems.filter((item) => item.x <= splitX);
  const right = bodyItems.filter((item) => item.x > splitX);
  const headerText = hasCrossColumnHeader ? joinTokensIntoLines(headerBand).join("\n") : "";
  const leftText = joinTokensIntoLines(left).join("\n");
  const rightText = joinTokensIntoLines(right).join("\n");

  return {
    isMultiColumn: true,
    // Important: do not inject alphabetic layout markers such as
    // "PAGE LEFT COLUMN START" into the resume text. Downstream CV parsers can
    // mistake those markers for names/headlines. Reading order: full-width
    // header first (if any), then the complete left/sidebar column, then the
    // complete right/main column, separated only by blank lines.
    // NOTE: README Phase 5 recommends body-before-sidebar (right before left)
    // once the 50-CV regression suite exists; left→right is retained here to
    // avoid regressing layouts where the left column is the main body.
    text: [headerText, "", leftText, "", rightText].filter(Boolean).join("\n"),
  };
}

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

  // 1. require via createRequire resolves the real installed pdfjs-dist from
  //    node_modules at runtime. Under Next.js server bundling a plain dynamic
  //    import of pdfjs-dist is frequently rewritten or externalized and then
  //    throws at runtime, which is what was silently dropping every multi-column
  //    CV to the naive flattener. This path needs pdfjs-dist listed in
  //    serverExternalPackages (see next.config) so it stays a real node module.
  try {
    // Anchor resolution at the project root. The anchor file need not exist;
    // createRequire only uses it as the base for bare-specifier resolution.
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

  // 2. Fall back to dynamic import for runtimes where require is unavailable.
  for (const specifier of candidates) {
    try {
      const mod = normalize(await import(/* webpackIgnore: true */ specifier));
      if (mod) return mod;
    } catch (error) {
      lastError = error;
    }
  }

  // Make the failure LOUD instead of silently degrading to the naive flattener.
  // If you see this line, layout-aware extraction is OFF and multi-column CVs
  // will be scrambled: install pdfjs-dist and add it to serverExternalPackages.
  console.error(
    "[workzoSpatialPdfExtractor] pdfjs-dist failed to load server-side; " +
      "layout-aware extraction is DISABLED and multi-column CVs will be flattened.",
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
    const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
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
  const layoutAwareText = reconstructed
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n");
  const plainText = pages.map((page) => joinTokensIntoLines(page.items).join("\n")).join("\n\n");
  const hasMultiColumn = reconstructed.some((page) => page.isMultiColumn);

  return {
    text: layoutAwareText || plainText,
    plainText,
    layoutAware: true,
    layoutType: hasMultiColumn ? "multi_column" : "single_column",
    warnings: hasMultiColumn ? ["spatial_multicolumn_reconstruction_used"] : [],
  };
}

function hasLikelyColumnDamage(text: string): boolean {
  const sample = String(text || "").slice(0, 3000);
  if (!sample) return false;
  const compactSectionHeaders = (sample.match(/\b(?:S\s*K\s*I\s*L\s*L\s*S|C\s*O\s*N\s*T\s*A\s*C\s*T|E\s*D\s*U\s*C\s*A\s*T\s*I\s*O\s*N|W\s*O\s*R\s*K\s*E\s*X\s*P\s*E\s*R\s*I\s*E\s*N\s*C\s*E)\b/gi) || []).length;
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
    // fall through to existing parser; extraction must never fail just because
    // the layout-aware engine is unavailable in a given deployment.
  }

  const fallbackText = await fallbackParser(buffer);
  return {
    text: fallbackText,
    plainText: fallbackText,
    layoutAware: false,
    layoutType: hasLikelyColumnDamage(fallbackText) ? "multi_column" : "unknown",
    warnings: hasLikelyColumnDamage(fallbackText)
      ? ["fallback_pdf_parse_used", "possible_multicolumn_flattening"]
      : ["fallback_pdf_parse_used"],
  };
}
