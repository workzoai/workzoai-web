/**
 * Regression: name / headline / language — production logs + PROPERTY-BASED tests.
 *
 *   npx tsx eval/regression_cv_identity_properties.ts
 *
 * Two halves, deliberately:
 *
 *   PART A — every failure in the uploaded production logs, replayed verbatim.
 *            Real fixtures, but the ASSERTIONS are invariants, never
 *            "name === 'Haritha Vijayakumar'".
 *
 *   PART B — PROPERTY-BASED tests. Thousands of generated profiles from a
 *            deterministic PRNG (seeded, so failures reproduce exactly).
 *            Fixed fixtures only prove the cases we thought of; these assert
 *            the invariants hold across a generated space, which is what stops
 *            a future "fix" from re-breaking a layout nobody had in mind.
 *
 * The property generators use synthetic names/skills in scripts and shapes the
 * uploaded CVs never contained (Cyrillic, Greek, particles, mononyms), so
 * passing cannot be achieved by special-casing anything in the logs.
 */
import {
  buildCanonicalResumeProfile,
  canonicalizeLanguages,
  isContaminatedName,
  isSectionComposite,
  resolveHeadline,
  splitPackedLanguages,
  canonicalLanguageName,
  letterBlob,
  SECTION_NAMES,
} from "@/lib/workzoCvCanonicalBuilder";
import { validateCanonicalProfile } from "@/lib/workzoCvValidator";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const P = (o: Partial<ResumeProfile> = {}): ResumeProfile => ({
  rawText: "", basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
  summary: "", experience: [], education: [], skills: [], projects: [], languages: [],
  certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
  ...o,
} as ResumeProfile);

/* ==========================================================================
 * PART A — PRODUCTION LOG FAILURES
 * ======================================================================== */

/* --- A1. Headline: the parser was right and we overrode it with a job title -
 * Logged: parser headline 'DATA SCIENTIST/ ANALYST' -> shipped
 * 'Technical Support Engineer' (experience[0].title). Also seen on
 * 'JUNIOR CUSTOMER SUCCESS MANAGER' and 'Senior Product Manager - AI & SaaS'.
 */
{
  const cases = [
    { header: "DATA SCIENTIST/ ANALYST", job: "Technical Support Engineer" },
    { header: "JUNIOR CUSTOMER SUCCESS MANAGER", job: "Technical Support Engineer" },
    { header: "Senior Product Manager - AI & SaaS Platforms", job: "Lead Product Manager" },
    { header: "Junior Data Scientist", job: "YOURLATESTPOSITION" },
  ];
  for (const c of cases) {
    const parsed = P({
      basics: { name: "A B", headline: c.header, email: "", phone: "", location: "", linkedin: "" },
      experience: [{ title: c.job, company: "X", location: "", dates: "2018 - 2020", bullets: ["b"] }],
    });
    const { profile } = buildCanonicalResumeProfile({ parsed, rawText: `A B\n${c.header}\n` });
    check(`logs:headline_not_latest_job:${c.job}`, profile.basics.headline !== c.job,
      `shipped the latest job title "${c.job}" over the header "${c.header}"`);
    check(`logs:headline_keeps_header:${c.header.slice(0, 20)}`,
      letterBlob(profile.basics.headline) === letterBlob(c.header),
      `got "${profile.basics.headline}"`);
  }
}

/* --- A2. Headline blanked because it appeared inside its own summary -------
 * Logged: parser 'PR Manager', summary 'Results-driven PR Manager with...'
 * -> shipped ''.
 */
{
  const parsed = P({
    basics: { name: "O W", headline: "PR Manager", email: "", phone: "", location: "", linkedin: "" },
    summary: "Results-driven PR Manager with over 5 years of experience in creating and managing comprehensive public relations strategies.",
  });
  const { profile } = buildCanonicalResumeProfile({ parsed, rawText: "O W\n" });
  check("logs:headline_survives_mention_in_summary", profile.basics.headline === "PR Manager",
    `got "${profile.basics.headline}"`);
}

/* --- A3. …but a headline that IS the summary's opening is still a bleed ---- */
{
  const bleed = "Ex-Technical support engineer and product specialist transitioning";
  const parsed = P({
    basics: { name: "A B", headline: bleed, email: "", phone: "", location: "", linkedin: "" },
    summary: `${bleed} into a Data Scientist role after completing a bootcamp.`,
  });
  const { profile } = buildCanonicalResumeProfile({ parsed, rawText: "A B\n" });
  check("logs:headline_rejects_summary_prefix", profile.basics.headline !== bleed,
    `got "${profile.basics.headline}"`);
}

/* --- A4. Headline became a section heading --------------------------------
 * Logged: headline 'SUMMARY OF SKILLS' via header_below_name.
 */
{
  const parsed = P({ basics: { name: "Alice Milani", headline: "Project management", email: "", phone: "", location: "", linkedin: "" },
    skills: ["Project management", "Software development"] });
  const { profile } = buildCanonicalResumeProfile({
    parsed, rawText: "ALICE MILANI\nS U M M A R Y O F S K I L L S\nProject management\n",
  });
  check("logs:headline_never_section_composite", !isSectionComposite(profile.basics.headline || "x"),
    `got "${profile.basics.headline}"`);
  check("logs:headline_never_own_skill",
    !["project management", "software development"].includes((profile.basics.headline || "").toLowerCase()),
    `got "${profile.basics.headline}"`);
}

/* --- A5. Name assembled from the skills sidebar ----------------------------
 * Logged: 'Tools Ticketing-systeme' shipped with needsConfirmation:false.
 * Also 'Tableau Api' and 'Key Projects'.
 */
{
  const cases = [
    { name: "Tools Ticketing-systeme", skills: ["Ticketing-Systeme", "Remote Support Tools", "Windows"] },
    { name: "Tableau Api", skills: ["Tableau", "API", "Python"] },
    { name: "Key Projects", skills: ["Product Strategy", "Agile"] },
  ];
  for (const c of cases) {
    check(`logs:name_contamination_detected:${c.name}`, isContaminatedName(c.name, { skills: c.skills }));

    const { profile, report } = buildCanonicalResumeProfile({
      parsed: P({ basics: { name: c.name, headline: "", email: "", phone: "", location: "", linkedin: "" }, skills: c.skills }),
      rawText: "S O M E O N E  R E A L\n",
    });
    check(`logs:name_never_shipped:${c.name}`, profile.basics.name !== c.name,
      `shipped "${profile.basics.name}"`);
    // Boolean(): `a && b` where `a` is a string yields `string | boolean`, and
    // check() takes a boolean. Under the project's strict tsconfig this is a
    // hard build error, not a lint nit.
    check(`logs:name_flagged_or_replaced:${c.name}`,
      Boolean(report.needsConfirmation || (profile.basics.name && !isContaminatedName(profile.basics.name, { skills: c.skills }))),
      "a contaminated name must be suppressed, not silently kept");

    const v = validateCanonicalProfile({
      parsed: P(),
      final: P({ basics: { name: c.name, headline: "", email: "", phone: "", location: "", linkedin: "" }, skills: c.skills }),
    });
    check(`logs:name_validator_catches:${c.name}`,
      v.violations.some((x) => x.rule === "name_token_is_skill" || x.rule === "name_is_section_composite"),
      v.violations.map((x) => x.rule).join(",") || "no violations");
  }
}

/* --- A6. languages_dropped was a FALSE ALARM on correct output -------------
 * Logged: 'Deutsch - B2' -> 'German (B2)' reported as a dropped language, and
 * the packed 'English (Fluent) - German (Intermediate) - Spanish (Native)'
 * reported as the phantom key 'englishfluentgermanintermediatespanish'.
 */
{
  const cases: Array<{ label: string; langs: string[]; expect: number }> = [
    { label: "endonym", langs: ["Deutsch - B2", "English - C1"], expect: 2 },
    { label: "packed_three", langs: ["English (Fluent) - German (Intermediate) - Spanish (Native)", "German - Intermediate", "Spanish - Native", "English - Fluent"], expect: 3 },
    { label: "packed_two", langs: ["English (Fluent) - German (Professional Working Proficiency)", "German - Professional", "English - Fluent"], expect: 2 },
    { label: "de_konversation", langs: ["English - FLIESSEND", "Deutsch (Konversationsniveau)"], expect: 2 },
    { label: "five_variants", langs: ["English - FLUENT", "German - Conversational", "English: Fluent", "German: Conversational", "German - B1"], expect: 2 },
  ];
  for (const c of cases) {
    const parsed = P({ languages: c.langs });
    const { profile } = buildCanonicalResumeProfile({ parsed, rawText: "" });
    check(`logs:lang_count:${c.label}`, profile.languages.length === c.expect,
      `got ${profile.languages.length}: ${profile.languages.join(", ")}`);

    const v = validateCanonicalProfile({ parsed, final: profile });
    check(`logs:lang_no_false_drop:${c.label}`,
      !v.violations.some((x) => x.rule === "languages_dropped"),
      v.violations.map((x) => x.detail).join(" | "));
  }
}

/* --- A7. …but a REAL drop is still caught --------------------------------- */
{
  const parsed = P({ languages: ["English - B4", "Turkish - B4 and presentable", "Arabic - NATIVE"] });
  const v = validateCanonicalProfile({ parsed, final: P({ languages: ["Arabic (Native)"] }) });
  check("logs:lang_real_drop_still_caught",
    v.violations.some((x) => x.rule === "languages_dropped"));
}

/* --- A8. Header-fragment warning must not fire on experience lines --------- */
{
  const clean = validateCanonicalProfile({
    parsed: P(),
    final: P({ basics: { name: "S D", headline: "Product Design Engineer", email: "", phone: "", location: "", linkedin: "" } }),
    rawText: "S D\nProduct Design Engineer\nBERUFSERFAHRUNG\nAUG 2022 - HEUTE PRODUCT DESIGN ENGINEER\n",
  });
  check("logs:fragment_no_false_positive_on_experience_line",
    !clean.violations.some((x) => x.rule === "headline_is_header_fragment"),
    clean.violations.map((x) => x.rule).join(","));

  const truncated = validateCanonicalProfile({
    parsed: P(),
    final: P({ basics: { name: "H V", headline: "Manager", email: "", phone: "", location: "", linkedin: "" } }),
    rawText: "H V\nJ U N I O R  C U S T O M E R  S U C C E S S  M A N A G E R\nKONTAKT\n",
  });
  check("logs:fragment_true_positive_retained",
    truncated.violations.some((x) => x.rule === "headline_is_header_fragment"));
}

/* ==========================================================================
 * PART B — PROPERTY-BASED TESTS
 * ======================================================================== */

/** Deterministic PRNG (mulberry32). Seeded so any failure reproduces exactly. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

// Deliberately NOT drawn from the uploaded CVs: other scripts, particles,
// mononyms, apostrophes, hyphens. If a fix were sample-specific these break.
const GIVEN = ["Þórdís", "Ngozi", "Іван", "Γεώργιος", "Jean-Luc", "Siobhán", "Nguyễn", "Ali", "Мария", "Aoife"];
const FAMILY = ["van der Berg", "O'Brien", "Ólafsdóttir", "Мельник", "Παπαδόπουλος", "bin Rashid", "Nkemelu", "de la Cruz", "Þórsson", "Ferreira-Silva"];
const TITLES = ["Cloud Architect", "Hebammenleitung", "Ingénieur Systèmes", "Actuarial Analyst", "Marine Biologist", "Chef de Partie", "Оператор станка", "Structural Draughtsman"];
const SKILLS = ["Kubernetes", "Autopsie", "Rhino 3D", "Solvency II", "Хирургия", "Braising", "MATLAB", "Δίκτυα"];
const LANGS = ["English", "Deutsch", "Français", "Español", "Português", "Nederlands", "Svenska", "Türkçe"];
const LEVELS = ["Fluent", "B2", "C1", "Native", "Muttersprache", "Conversational", "A2"];

const SEEDS = 400;

/* --- P1. A real name is NEVER treated as contaminated (no false positives) - */
{
  let bad = 0;
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(1000 + i);
    const name = `${pick(r, GIVEN)} ${pick(r, FAMILY)}`;
    const skills = [pick(r, SKILLS), pick(r, SKILLS), pick(r, SKILLS)];
    if (isContaminatedName(name, { skills })) { bad += 1; if (bad === 1) failures.push(`prop:name_false_positive — seed ${1000 + i}: "${name}" vs ${skills}`); }
  }
  check("prop:real_names_never_contaminated", bad === 0, `${bad}/${SEEDS} real names wrongly flagged`);
}

/* --- P2. A name built from THIS profile's skills is ALWAYS caught ---------- */
{
  let missed = 0;
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(2000 + i);
    const skills = [pick(r, SKILLS), pick(r, SKILLS), pick(r, SKILLS)];
    const fake = `${pick(r, skills)} ${pick(r, skills)}`;
    if (!isContaminatedName(fake, { skills })) { missed += 1; if (missed === 1) failures.push(`prop:name_missed — seed ${2000 + i}: "${fake}" vs ${skills}`); }
  }
  check("prop:skill_assembled_names_always_caught", missed === 0, `${missed}/${SEEDS} missed`);
}

/* --- P3. Language identity is PRESERVED under every alias/level permutation - */
{
  let lost = 0;
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(3000 + i);
    const chosen = [pick(r, LANGS), pick(r, LANGS), pick(r, LANGS)];
    const expected = new Set(chosen.map((l) => letterBlob(canonicalLanguageName(l))));
    // Emit each language in a random surface form, plus a duplicate variant.
    const raw: string[] = [];
    for (const l of chosen) {
      const lvl = pick(r, LEVELS);
      raw.push(pick(r, [`${l} - ${lvl}`, `${l}: ${lvl}`, `${l} (${lvl})`, `${l}`, `${l} ${lvl}`]));
    }
    raw.push(`${pick(r, chosen)} (${pick(r, LEVELS)})`);

    const out = canonicalizeLanguages(raw);
    const got = new Set(out.map((e) => letterBlob(canonicalLanguageName(e.replace(/\s*\(.*\)$/, "")))));
    for (const key of expected) {
      if (!got.has(key)) { lost += 1; if (lost === 1) failures.push(`prop:lang_lost — seed ${3000 + i}: ${JSON.stringify(raw)} -> ${JSON.stringify(out)}`); break; }
    }
  }
  check("prop:language_identity_never_lost", lost === 0, `${lost}/${SEEDS} lost a language`);
}

/* --- P4. Languages: no duplicate identity ever survives -------------------- */
{
  let dupes = 0;
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(4000 + i);
    const l = pick(r, LANGS);
    const raw = [`${l} - ${pick(r, LEVELS)}`, `${l}: ${pick(r, LEVELS)}`, `${l} (${pick(r, LEVELS)})`, l];
    if (canonicalizeLanguages(raw).length !== 1) { dupes += 1; if (dupes === 1) failures.push(`prop:lang_dupe — seed ${4000 + i}: ${JSON.stringify(raw)} -> ${JSON.stringify(canonicalizeLanguages(raw))}`); }
  }
  check("prop:language_variants_always_merge", dupes === 0, `${dupes}/${SEEDS} left duplicates`);
}

/* --- P5. The validator NEVER contradicts a correct build ------------------- *
 * The strongest property: for any generated profile, building then validating
 * must produce zero errors. This is what the shipped languages_dropped alarm
 * violated — the validator disagreeing with correct output.
 */
{
  let contradictions = 0;
  let firstDetail = "";
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(5000 + i);
    const name = `${pick(r, GIVEN)} ${pick(r, FAMILY)}`;
    const title = pick(r, TITLES);
    const parsed = P({
      basics: { name, headline: title, email: "", phone: "", location: "", linkedin: "" },
      summary: `Experienced ${title} with a track record of delivery.`,
      skills: [pick(r, SKILLS), pick(r, SKILLS)],
      languages: [`${pick(r, LANGS)} - ${pick(r, LEVELS)}`, `${pick(r, LANGS)} (${pick(r, LEVELS)})`],
      experience: [{ title: pick(r, TITLES), company: "Acme", location: "", dates: "2019 - 2022", bullets: ["b"] }],
    });
    const rawText = `${name}\n${title}\nPROFILE\n`;
    const { profile } = buildCanonicalResumeProfile({ parsed, rawText });
    const v = validateCanonicalProfile({ parsed, final: profile, rawText });
    const errs = v.violations.filter((x) => x.severity === "error");
    if (errs.length) {
      contradictions += 1;
      if (!firstDetail) firstDetail = `seed ${5000 + i}: ${errs.map((e) => e.rule).join(",")} | ${errs[0].detail}`;
    }
  }
  check("prop:validator_never_contradicts_builder", contradictions === 0,
    `${contradictions}/${SEEDS} — ${firstDetail}`);
}

/* --- P6. Determinism: same input, same output, always ---------------------- */
{
  let unstable = 0;
  for (let i = 0; i < 120; i += 1) {
    const r = rng(6000 + i);
    const parsed = P({
      basics: { name: `${pick(r, GIVEN)} ${pick(r, FAMILY)}`, headline: pick(r, TITLES), email: "", phone: "", location: "", linkedin: "" },
      skills: [pick(r, SKILLS)], languages: [`${pick(r, LANGS)} - ${pick(r, LEVELS)}`],
      experience: [{ title: pick(r, TITLES), company: "A", location: "", dates: "2019 - 2022", bullets: ["b"] }],
    });
    const raw = `${parsed.basics.name}\n${parsed.basics.headline}\n`;
    const a = JSON.stringify(buildCanonicalResumeProfile({ parsed, rawText: raw }).profile);
    const b = JSON.stringify(buildCanonicalResumeProfile({ parsed, rawText: raw }).profile);
    if (a !== b) unstable += 1;
  }
  check("prop:deterministic", unstable === 0, `${unstable}/120 nondeterministic`);
}

/* --- P7. A section heading is NEVER a valid headline ----------------------- */
{
  let leaked = 0;
  for (const section of SECTION_NAMES) {
    const spaced = section.toUpperCase().split("").join(" ");
    const { headline } = resolveHeadline({ headerBelowName: spaced, forbidden: new Set() });
    if (headline) { leaked += 1; if (leaked === 1) failures.push(`prop:section_leaked — "${spaced}" -> "${headline}"`); }
  }
  check("prop:section_headings_never_headline", leaked === 0, `${leaked}/${SECTION_NAMES.length} leaked`);
}

/* --- P8. splitPackedLanguages never invents or loses a language ------------ */
{
  let wrong = 0;
  for (let i = 0; i < SEEDS; i += 1) {
    const r = rng(7000 + i);
    const n = 1 + Math.floor(r() * 3);
    const langs = Array.from({ length: n }, () => pick(r, LANGS));
    const packed = langs.map((l) => `${l} (${pick(r, LEVELS)})`).join(" - ");
    if (splitPackedLanguages(packed).length !== n) {
      wrong += 1;
      if (wrong === 1) failures.push(`prop:pack_split — seed ${7000 + i}: "${packed}" -> ${JSON.stringify(splitPackedLanguages(packed))}`);
    }
  }
  check("prop:packed_split_exact", wrong === 0, `${wrong}/${SEEDS} wrong arity`);
}

/* ======================================================================= */
const total = passed + failures.length;
console.log("=".repeat(70));
console.log(`CV IDENTITY (logs + properties): ${passed}/${total} = ${((passed / total) * 100).toFixed(1)}%`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  \u2717 ${f}`);
}
console.log("=".repeat(70));
process.exit(failures.length ? 1 : 0);
