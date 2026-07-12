/**
 * Invariant checks. Each check is generic — it encodes a property that must hold
 * for ANY CV, not a value specific to one sample. A check returns null when it
 * passes, or a short failure reason string when it fails. Checks self-skip when
 * the data needed to evaluate them is absent (return "skip").
 */
import type { ResumeProfile } from "./pipeline";

export type Fixture = {
  name: string;
  kind: "text" | "profile";
  text?: string;
  profile?: any;
  jd?: string;
  role?: string;
  // Optional expectations. When present they tighten the generic checks.
  expect?: {
    name?: string;
    minExperience?: number;
    everyJobHasBullets?: boolean;
    minEducation?: number;
    noDuplicateEducation?: boolean;
    skills?: string[]; // must survive verbatim (esp. CamelCase)
    verbatimExperience?: boolean; // rendered bullets must equal source bullets
    headline?: string;
    minProjects?: number;
    experienceTitles?: string[];
  };
};

export type PipeResult = {
  fixture: Fixture;
  parse?: ResumeProfile;
  identity?: {
    selectedName: string;
    needsConfirmation: boolean;
    confidence: number;
    rejectedCandidates: string[];
  };
  canonical?: any | null;
  render: {
    experience: Array<{ title?: string; company?: string; dates?: string; bullets?: string[] }>;
    education: Array<{ degree?: string; institution?: string; dates?: string }>;
    skills: string[];
    profile?: any;
  };
};

export type CheckResult = { id: string; status: "pass" | "fail" | "skip"; detail?: string };

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SECTION = new Set(["summary","profile","experience","education","skills","projects","contact","languages","kontakt","profil","ausbildung","berufserfahrung"]);
const looksLikeName = (s: string) => {
  const w = String(s || "").trim().split(/\s+/).filter(Boolean);
  return w.length >= 2 && w.length <= 4 && w.every((x) => /^[\p{L}][\p{L}.'-]*$/u.test(x));
};

function degreeLevel(degree = "") {
  const m = /\b(ph\.?d|doctorate|master|magister|m\.?sc|m\.?a|mba|bachelor|b\.?sc|b\.?a|b\.?eng|diploma|diplom|associate)\b/i.exec(degree);
  return (m ? m[1] : degree).toLowerCase().replace(/[^a-z]/g, "");
}

export function runChecks(r: PipeResult): CheckResult[] {
  const out: CheckResult[] = [];
  const f = r.fixture;
  const push = (id: string, status: CheckResult["status"], detail?: string) => out.push({ id, status, detail });

  // 1) Identity is not falsely rejected.
  if (r.identity) {
    const expected = f.expect?.name;
    if (expected) {
      const ok = norm(r.identity.selectedName) === norm(expected) && !r.identity.needsConfirmation;
      push("identity_name", ok ? "pass" : "fail",
        ok ? undefined : `selected=${JSON.stringify(r.identity.selectedName)} needsConfirm=${r.identity.needsConfirmation} rejected=${JSON.stringify(r.identity.rejectedCandidates)}`);
    } else if (r.parse?.basics?.name && looksLikeName(r.parse.basics.name)) {
      const ok = !r.identity.needsConfirmation && !!r.identity.selectedName;
      push("identity_not_rejected", ok ? "pass" : "fail",
        ok ? undefined : `a valid-looking name existed but identity needsConfirm=${r.identity.needsConfirmation} rejected=${JSON.stringify(r.identity.rejectedCandidates)}`);
    } else push("identity_not_rejected", "skip");
  }

  // 2) Canonical profile is usable (not discarded) when there is real evidence.
  if (r.canonical !== undefined) {
    const evidence = (r.render.experience.length || r.render.education.length || r.render.skills.length) > 0;
    if (evidence) push("canonical_usable", r.canonical ? "pass" : "fail", r.canonical ? undefined : "buildCanonicalProfile returned null despite real experience/education/skills");
    else push("canonical_usable", "skip");
  }

  // 3) Name is clean (not the address/section/skill/empty, no digits).
  const nm = r.canonical?.basics?.name ?? r.render.profile?.basics?.name ?? r.parse?.basics?.name ?? "";
  if (nm || f.kind === "text") {
    const bad = !nm || /\d/.test(nm) || SECTION.has(norm(nm)) || nm.trim().split(/\s+/).length > 5;
    push("name_clean", bad ? "fail" : "pass", bad ? `name=${JSON.stringify(nm)}` : undefined);
  }

  // 4) Experience preserved (count).
  const minExp = f.expect?.minExperience;
  if (minExp != null) {
    push("experience_count", r.render.experience.length >= minExp ? "pass" : "fail",
      r.render.experience.length >= minExp ? undefined : `got ${r.render.experience.length} jobs, expected >= ${minExp}`);
  }

  // 5) No job silently loses its bullets.
  if (f.expect?.everyJobHasBullets) {
    const empty = r.render.experience.filter((e) => !(e.bullets && e.bullets.length));
    push("experience_bullets", empty.length === 0 ? "pass" : "fail",
      empty.length === 0 ? undefined : `${empty.length} job(s) rendered with 0 bullets: ${empty.map((e) => e.title || e.company).join("; ")}`);
  }

  // 6) Company field isn't a title fragment / empty / dash-led.
  if (r.render.experience.length) {
    const bad = r.render.experience.filter((e) => !e.company || /^[\s\-\u2013\u2014]/.test(e.company));
    push("experience_company_clean", bad.length === 0 ? "pass" : "fail",
      bad.length === 0 ? undefined : `suspect company on: ${bad.map((e) => `${e.title || "?"} @ ${JSON.stringify(e.company)}`).join("; ")}`);
  }

  // 7) Education has no duplicate (same degree-level + institution).
  if (f.expect?.noDuplicateEducation !== false && r.render.education.length) {
    const keys = r.render.education.map((e) => `${degreeLevel(e.degree)}|${norm(e.institution)}`);
    const dup = keys.length !== new Set(keys).size;
    push("education_no_dup", dup ? "fail" : "pass", dup ? `entries=${JSON.stringify(r.render.education.map((e) => `${e.degree} @ ${e.institution} (${e.dates})`))}` : undefined);
  }
  if (f.expect?.minEducation != null) {
    push("education_count", r.render.education.length >= f.expect.minEducation ? "pass" : "fail",
      `got ${r.render.education.length}, expected >= ${f.expect.minEducation}`);
  }

  // 8) Education dates are clean: empty, a single year, or a year range — never a
  //    split fragment like "– 2016" or a bare leading dash.
  if (r.render.education.length) {
    const dateRe = /^$|^(19|20)\d{2}$|^(19|20)\d{2}\s*[-\u2013\u2014]\s*((19|20)\d{2}|present)$/i;
    const bad = r.render.education.filter((e) => !dateRe.test(String(e.dates || "").trim()));
    push("education_dates_clean", bad.length === 0 ? "pass" : "fail",
      bad.length === 0 ? undefined : `malformed dates: ${bad.map((e) => JSON.stringify(e.dates)).join(", ")}`);
  }

  // 9) Skills not dropped and CamelCase tech names not split.
  const wantSkills = f.expect?.skills ?? r.parse?.skills ?? [];
  if (wantSkills.length) {
    const outSet = r.render.skills.map((s) => s);
    const outNoSpace = new Set(r.render.skills.map((s) => norm(s)));
    const dropped = wantSkills.filter((s) => !outNoSpace.has(norm(s)));
    push("skills_not_dropped", dropped.length === 0 ? "pass" : "fail",
      dropped.length === 0 ? undefined : `missing from render: ${JSON.stringify(dropped)}`);

    // CamelCase (internal cap, no space) must appear verbatim, not split.
    const camel = wantSkills.filter((s) => /\p{Ll}\p{Lu}/u.test(s) && !/\s/.test(s));
    const mangled = camel.filter((s) => !outSet.includes(s));
    push("skills_no_mangle", mangled.length === 0 ? "pass" : "fail",
      mangled.length === 0 ? undefined : `split/altered CamelCase skills: ${JSON.stringify(mangled)} -> render has ${JSON.stringify(r.render.skills)}`);
  }

  // 9b) No duplicate / subset-redundant skills, and location not duplicated.
  if (r.render.skills.length) {
    const ws = (v: string) => new Set(v.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
    const sets = r.render.skills.map(ws);
    const lowExact = r.render.skills.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const exactDup = lowExact.length !== new Set(lowExact).size;
    const subsetDup = r.render.skills.some((_a, ai) => sets[ai].size > 0 && r.render.skills.some((_b, bi) => bi !== ai && sets[bi].size > sets[ai].size && [...sets[ai]].every((w) => sets[bi].has(w))));
    push("skills_no_redundant", exactDup || subsetDup ? "fail" : "pass", exactDup || subsetDup ? `skills=${JSON.stringify(r.render.skills)}` : undefined);
  }
  if (r.render.education.length) {
    const k = (v = "") => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const badLoc = r.render.education.filter((e: any) => e.location && k(e.institution).includes(k(e.location)));
    push("education_location_not_duplicated", badLoc.length ? "fail" : "pass", badLoc.length ? `redundant location: ${badLoc.map((e: any) => `${e.institution} · ${e.location}`).join("; ")}` : undefined);
  }

  // 10) Experience bullets preserved verbatim (for profile fixtures that ask).
  if ((f.expect as any)?.verbatimExperience && f.kind === "profile") {
    const srcJobs = (f.profile?.experience || []) as Array<{ company?: string; bullets?: string[] }>;
    let bad = "";
    for (const rj of r.render.experience) {
      const sj = srcJobs.find((s) => norm(s.company) === norm(rj.company));
      const srcB = (sj?.bullets || []).map((b) => b.trim());
      const outB = (rj.bullets || []).map((b) => b.trim());
      const missing = srcB.filter((b) => !outB.includes(b));
      const added = outB.filter((b) => !srcB.some((s) => s === b));
      if (missing.length || added.length) bad += ` [${rj.company}: missing=${missing.length} altered/added=${added.length}]`;
    }
    push("experience_verbatim", bad ? "fail" : "pass", bad || undefined);
  }

  // 11) Header headline must stay a short professional title, not summary prose.
  if (f.expect?.headline) {
    const actual = r.canonical?.basics?.headline ?? r.render.profile?.basics?.headline ?? r.parse?.basics?.headline ?? "";
    const ok = norm(actual) === norm(f.expect.headline);
    push("headline_exact", ok ? "pass" : "fail", ok ? undefined : `headline=${JSON.stringify(actual)} expected=${JSON.stringify(f.expect.headline)}`);
  }

  // 12) Projects and exact experience identities survive parsing.
  if (f.expect?.minProjects != null) {
    const projects = r.canonical?.projects ?? r.render.profile?.projects ?? r.parse?.projects ?? [];
    push("projects_count", projects.length >= f.expect.minProjects ? "pass" : "fail", `got ${projects.length}, expected >= ${f.expect.minProjects}`);
  }
  if (f.expect?.experienceTitles?.length) {
    const actual = r.render.experience.map((e) => norm(e.title));
    const missing = f.expect.experienceTitles.filter((title) => !actual.includes(norm(title)));
    push("experience_titles_exact", missing.length ? "fail" : "pass", missing.length ? `missing titles: ${JSON.stringify(missing)}; actual=${JSON.stringify(r.render.experience.map((e) => e.title))}` : undefined);
  }

  // 13) No AI-preamble / meta-instruction text survives into the rendered CV.
  //     This is a generic property: a real CV never contains an assistant
  //     preamble ("Here's a customized version of your achievements…", "Sure,
  //     I've updated…", "As requested…"). Such lines are leaked LLM output from a
  //     prior tailoring pass and must never appear as a bullet, summary, or
  //     project line. The pattern is structural (a class of phrasings), not a
  //     sample value, so it holds for every CV in every language.
  {
    const AI_PREAMBLE =
      /^\s*(sure|certainly|of course|absolutely|great|okay|here(?:'?s| is)\b|below is|i(?:'?ve| have)\b|i(?:'?ll| will)\b|as requested|as an ai|note:|let me\b)/i;
    const META_REWRITE =
      /\b(customi[sz]ed|tailored|updated|optimi[sz]ed|revised|improved|enhanced)\s+(version|copy)\b|\bversion of your\b|\byour (resume|cv|achievements|experience|bullet)/i;
    const isGarbage = (s = "") => AI_PREAMBLE.test(s) || META_REWRITE.test(s);
    const hits: string[] = [];
    for (const e of r.render.experience) for (const b of e.bullets || []) if (isGarbage(b)) hits.push(b);
    for (const p of (r.render.profile?.projects ?? r.canonical?.projects ?? []) as any[])
      for (const b of p.bullets || []) if (isGarbage(b)) hits.push(b);
    const summary = String(r.canonical?.summary ?? r.render.profile?.summary ?? r.parse?.summary ?? "");
    if (isGarbage(summary)) hits.push(summary);
    if (r.render.experience.length || summary) {
      push("no_ai_preamble", hits.length === 0 ? "pass" : "fail",
        hits.length === 0 ? undefined : `leaked meta text: ${JSON.stringify(hits.slice(0, 3))}`);
    }
  }

  return out;
}
