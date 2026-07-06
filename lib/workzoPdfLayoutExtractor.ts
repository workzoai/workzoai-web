"use client";

/**
 * WorkZo AI, Layout-Aware PDF Text Rebuilder
 * Path: lib/workzoPdfLayoutExtractor.ts
 *
 * Use this in onboarding before calling extractResumeProfile().
 *
 * Why:
 * pdf text extraction from sidebar CVs often returns:
 *   sidebar → headers → main content → project bullets → experience
 * instead of the visual reading order.
 *
 * This helper accepts positioned text items when available and rebuilds:
 *   left column + right column in readable order.
 *
 * If you currently only have plain text, keep using the parser.
 */

export type WorkZoPdfTextItem = {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  page?: number;
};

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function rebuildPdfTextByLayout(items: WorkZoPdfTextItem[]) {
  if (!items.length) return "";

  const pages = new Map<number, WorkZoPdfTextItem[]>();

  for (const item of items) {
    const text = clean(item.text);
    if (!text) continue;
    const page = item.page || 1;
    pages.set(page, [...(pages.get(page) || []), { ...item, text }]);
  }

  const pageTexts: string[] = [];

  for (const [, pageItems] of [...pages.entries()].sort(([a], [b]) => a - b)) {
    const xs = pageItems.map((item) => item.x).sort((a, b) => a - b);
    const medianX = xs[Math.floor(xs.length / 2)] || 0;

    const left = pageItems.filter((item) => item.x < medianX);
    const right = pageItems.filter((item) => item.x >= medianX);

    const sortVisual = (a: WorkZoPdfTextItem, b: WorkZoPdfTextItem) => {
      const yDiff = b.y - a.y; // PDF coordinates usually increase upward
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.x - b.x;
    };

    const leftText = left.sort(sortVisual).map((item) => item.text).join("\n");
    const rightText = right.sort(sortVisual).map((item) => item.text).join("\n");

    // Put main-like content first if it contains profile/experience/project headers.
    const leftLooksMain = /profile|experience|projects|work experience/i.test(leftText);
    const rightLooksMain = /profile|experience|projects|work experience/i.test(rightText);

    if (rightLooksMain && !leftLooksMain) {
      pageTexts.push(rightText, leftText);
    } else {
      pageTexts.push(leftText, rightText);
    }
  }

  return pageTexts.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
