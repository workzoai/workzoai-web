/*
  WorkZo AI — PDF → page images for the vision extractor.

  The one piece of this whole approach that depends on your runtime. Two viable
  options on Next.js / Vercel; pick one:

  OPTION A (recommended, fully in your control): rasterize to PNG with pdfjs-dist
  + @napi-rs/canvas. @napi-rs/canvas ships prebuilt binaries and runs on the
  Vercel Node runtime, unlike the classic `canvas` package which needs native
  build tooling and usually fails on serverless. This file implements Option A.

    npm i pdfjs-dist @napi-rs/canvas

  Make sure the route that calls this uses the Node.js runtime, not Edge:
    export const runtime = "nodejs";

  OPTION B (zero rasterization): send the PDF straight to a document-capable model
  via `pdfDataUrl` in extractCvWithVision. Simpler, but PDF support varies by model
  on OpenRouter, so it's less portable. Keep pageImages as the default path.

  Tuning:
  - DPI ~150 is the sweet spot: legible to the model, small token footprint.
  - Cap pages (CVs are 1–3 pages); ignore the rest to bound cost.
*/

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

export type RasterizeOptions = {
  /** Dots per inch. 150 balances legibility vs. token cost. */
  dpi?: number;
  /** Hard cap on pages sent to the model. */
  maxPages?: number;
};

/**
 * Convert a PDF (as bytes) into an array of PNG data URLs, one per page.
 * Returns data URLs ready to drop into extractCvWithVision({ pageImages }).
 */
export async function rasterizePdfToImages(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: RasterizeOptions = {},
): Promise<string[]> {
  const dpi = options.dpi ?? 150;
  const maxPages = options.maxPages ?? 4;
  const scale = dpi / 72; // PDF user space is 72 DPI.

  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const doc = await getDocument({ data, disableFontFace: true }).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");

    // pdfjs expects a canvas-2d-like context; @napi-rs/canvas is compatible.
    await page.render({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: ctx as any,
      viewport,
      background: "#ffffff",
    }).promise;

    const buffer = canvas.toBuffer("image/png");
    images.push(`data:image/png;base64,${buffer.toString("base64")}`);
    page.cleanup();
  }

  await doc.cleanup();
  return images;
}
