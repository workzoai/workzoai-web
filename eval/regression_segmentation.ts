/**
 * WorkZo CV pipeline - extractor geometry regression.
 *
 *   npx tsx eval/regression_segmentation.ts
 *
 * These are the exact geometries that corrupted real CVs. They assert that a
 * column gutter can never be joined into a word space, and that letter-spaced
 * display text keeps its word breaks.
 *
 * NOTE: segmentRow / groupIntoRows / medianFontSize are module-internal in
 * workzoSpatialPdfExtractor.ts. To run this suite, either export them, or paste
 * this file's item fixtures into a scratch test. They are kept here as the
 * specification of the geometry contract the extractor must satisfy.
 */
import { segmentRow, groupIntoRows, medianFontSize, type SpatialItem } from "@/lib/workzoSpatialPdfExtractor";

const PAGE_W = 595;
let failures = 0;
function check(name: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
}

const item = (text: string, x: number, y: number, w: number, h = 11): SpatialItem =>
  ({ text, x, y, width: w, height: h, page: 1 });

// CASE 1: sidebar value and body prose on the SAME baseline, separated by a gutter.
// This is the exact geometry that produced "German: Conversational technical support
// and customer-facing roles."  Old code welded them. New code must not.
const row1: SpatialItem[] = [
  item("German", 40, 500, 38),
  item("Conversational", 82, 500, 72),
  // 60pt gutter, then the body column:
  item("technical", 300, 500, 45),
  item("support", 350, 500, 40),
  item("and", 394, 500, 20),
  item("customer-facing", 418, 500, 78),
  item("roles.", 500, 500, 30),
];
const segs1 = segmentRow(row1, PAGE_W, 11);
check("two-column row does not merge", segs1.map((s) => s.text).join(" || "),
  "German Conversational || technical support and customer-facing roles.");

// CASE 2: the sidebar skill / contact-column city collision. "Seaborn" + "Chennai".
const row2: SpatialItem[] = [
  item("Seaborn", 40, 400, 42),
  item("Chennai", 320, 400, 44),
];
const segs2 = segmentRow(row2, PAGE_W, 11);
check("skill and city never weld", segs2.map((s) => s.text).join(" || "), "Seaborn || Chennai");

// CASE 3: letter-spaced display name, one pdf.js item per glyph.
// Tight gaps inside a word, wide gap between words. Old code produced
// "Harithavijayakumar". New code must recover the space.
const name = "HARITHA";
const surname = "VIJAYAKUMAR";
const row3: SpatialItem[] = [];
let x = 40;
for (const ch of name) { row3.push(item(ch, x, 700, 9, 18)); x += 12; }   // gap 3
x += 14;                                                                  // word gap
for (const ch of surname) { row3.push(item(ch, x, 700, 9, 18)); x += 12; }
const segs3 = segmentRow(row3, PAGE_W, 18);
check("letter-spaced name keeps its word break", segs3.map((s) => s.text).join(" || "),
  "HARITHA VIJAYAKUMAR");

// CASE 4: letter-spaced headline with a slash separator.
const row4: SpatialItem[] = [];
x = 40;
const push = (s: string, gapAfter: number, w = 9) => { for (const ch of s) { row4.push(item(ch, x, 680, w, 14)); x += w + 3; } x += gapAfter; };
push("IT", 10); push("Support", 10); push("Specialist", 10);
row4.push(item("/", x, 680, 6, 14)); x += 16;
push("Data", 10); push("Analyst", 0);
const segs4 = segmentRow(row4, PAGE_W, 14);
check("letter-spaced headline reconstructs words", segs4.map((s) => s.text).join(" || "),
  "IT Support Specialist / Data Analyst");

// CASE 5: an ordinary single-column sentence must be untouched.
const row5: SpatialItem[] = [
  item("Automated", 40, 300, 55),
  item("processes", 99, 300, 52),
  item("with", 155, 300, 22),
  item("Python.", 181, 300, 40),
];
check("ordinary prose is unchanged", segmentRow(row5, PAGE_W, 11).map((s) => s.text).join(" || "),
  "Automated processes with Python.");

// CASE 6: glyph-split word (no letter spacing, zero gaps) must rejoin, not gain spaces.
const row6: SpatialItem[] = [
  item("Ma", 40, 200, 16), item("tp", 56, 200, 12), item("lotlib", 68, 200, 30),
];
check("glyph-split word rejoins", segmentRow(row6, PAGE_W, 11).map((s) => s.text).join(" || "),
  "Matplotlib");

// CASE 7: rows group by baseline, and a full page of mixed columns stays separated.
const page: SpatialItem[] = [...row1, ...row2, ...row5];
const rows = groupIntoRows(page);
const allSegs = rows.flatMap((r) => segmentRow(r, PAGE_W, medianFontSize(page)));
const merged = allSegs.some((s) => /German.*technical|Seaborn.*Chennai/.test(s.text));
check("no cross-column merge anywhere on the page", merged ? "MERGED" : "clean", "clean");

console.log(failures === 0 ? "\nALL SEGMENTATION TESTS PASSED" : `\n${failures} FAILED`);
