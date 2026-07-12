import { segmentRow, detectGutters, groupIntoRows, medianFontSize, type SpatialItem } from "@/lib/workzoSpatialPdfExtractor";
const W = 595;
let fail = 0;
const it = (t: string, x: number, y: number, w: number, h = 11): SpatialItem => ({ text: t, x, y, width: w, height: h, page: 1 });
const line = (words: string[], x0: number, y: number, h = 11) => {
  const out: SpatialItem[] = []; let x = x0;
  for (const w of words) { const wd = w.length * h * 0.5; out.push(it(w, x, y, wd, h)); x += wd + h * 0.28; }
  return out;
};
// Segment a whole page, gutters computed from the page (as production does).
function page(items: SpatialItem[]): string[] {
  const fs = medianFontSize(items);
  const g = detectGutters(items, W);
  return groupIntoRows(items, fs).flatMap((r) => segmentRow(r, g, fs)).map((s) => s.text);
}
function check(name: string, cond: boolean, detail = "") {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond && detail) console.log("      " + detail);
}

/* B1: SINGLE COLUMN, right-aligned dates. Common. Must NOT split, must NOT weld. */
const b1: SpatialItem[] = [];
for (let i = 0; i < 8; i++) b1.push(...line(["Delivered", "technical", "support", "for", "network", "products", "and", "escalations"], 40, 600 - i * 14));
b1.push(...line(["Senior", "Engineer,", "Acme", "GmbH"], 40, 460));
b1.push(it("2018", 480, 460, 24), it("-", 507, 460, 5), it("2021", 515, 460, 24));
const o1 = page(b1);
check("B1 right-aligned date stays with its job title",
  o1.some((l) => /Senior Engineer, Acme GmbH\s+2018 - 2021/.test(l)), JSON.stringify(o1.slice(-2)));
check("B1 no words welded", !o1.some((l) => /[a-z][A-Z]/.test(l.replace(/GmbH/g, ""))), JSON.stringify(o1[0]));
check("B1 no gutter invented in a single-column page", detectGutters(b1, W).length === 0,
  JSON.stringify(detectGutters(b1, W)));

/* B2: TWO COLUMN sidebar, narrow gutter. Must split. */
const b2: SpatialItem[] = [];
for (let i = 0; i < 12; i++) {
  b2.push(...line(["Skill" + i], 40, 600 - i * 14));
  b2.push(...line(["Delivered", "technical", "support", "for", "network", "products"], 200, 600 - i * 14));
}
b2.push(...line(["German"], 40, 420));
b2.push(...line(["technical", "support", "and", "customer-facing", "roles."], 200, 420));
const o2 = page(b2);
check("B2 sidebar and body never weld",
  o2.includes("German") && o2.some((l) => l.startsWith("technical support and customer-facing")),
  JSON.stringify(o2.filter((l) => /German|customer-facing/.test(l))));
check("B2 gutter detected", detectGutters(b2, W).length >= 1, JSON.stringify(detectGutters(b2, W)));

/* B3: THREE COLUMN. Must produce three segments per row. */
const b3: SpatialItem[] = [];
for (let i = 0; i < 12; i++) {
  b3.push(...line(["Alpha" + i], 40, 600 - i * 14));
  b3.push(...line(["Beta" + i], 240, 600 - i * 14));
  b3.push(...line(["Gamma" + i], 440, 600 - i * 14));
}
const g3 = detectGutters(b3, W);
const row3 = groupIntoRows(b3, 11)[0];
check("B3 three columns produce three segments",
  segmentRow(row3, g3, 11).length === 3, JSON.stringify(segmentRow(row3, g3, 11).map((s) => s.text)));

/* B4: letter-spaced header on an otherwise single-column page. */
const b4: SpatialItem[] = [...b1];
let x = 40;
for (const ch of "HARITHA") { b4.push(it(ch, x, 700, 9, 18)); x += 12; }
x += 14;
for (const ch of "VIJAYAKUMAR") { b4.push(it(ch, x, 700, 9, 18)); x += 12; }
const o4 = page(b4);
check("B4 letter-spaced name recovers its word break",
  o4.some((l) => l === "HARITHA VIJAYAKUMAR"), JSON.stringify(o4.filter((l) => /HARITHA/.test(l))));

/* B5: a table-like row inside a single column (skills grid). Tab stops, no gutter. */
const b5: SpatialItem[] = [];
for (let i = 0; i < 10; i++) b5.push(...line(["Delivered", "technical", "support", "across", "regions", "and", "teams", "globally"], 40, 600 - i * 14));
b5.push(it("Python", 40, 440, 34), it("SQL", 200, 440, 20), it("Tableau", 360, 440, 40));
const o5 = page(b5);
check("B5 a skills grid row is not shredded when no gutter exists",
  o5.some((l) => /Python\s+SQL\s+Tableau/.test(l)), JSON.stringify(o5.filter((l) => /Python/.test(l))));

console.log(fail === 0 ? "\nALL GEOMETRY TESTS PASSED" : `\n${fail} FAILED`);
