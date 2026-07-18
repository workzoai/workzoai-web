/*
 * lib/jobs/textStems.ts
 *
 * ONE text-normalization module, shared by the requirement extractor and the
 * evidence matcher.
 *
 * These two must agree on what a "content word" is. When they did not, the
 * extractor emitted the same requirement twice in two surface forms, once from
 * the class reader ("German (FLUENT)") and once from the skills phrase extractor
 * ("Fluent German"), and the scorer then charged the candidate the missing-language
 * penalty TWICE for one gap: 36 points for a single missing language.
 *
 * Two modules, two private copies of "what counts as a word", one silent bug. So
 * there is now one copy, and it lives here.
 */

/*
 * Evaluative filler. A job ad says "valid nursing licence", "strong SQL", "proven
 * track record". The adjective is the employer's opinion, not a thing a CV can
 * evidence, and counting it as a content token is how a genuinely licensed nurse
 * fails a licence check: "valid nursing licence" against "Registered Nurse licence,
 * Bavaria" scores 1 content token out of 3 and reads as missing.
 */
const FILLER = new Set([
  "valid", "strong", "excellent", "proven", "demonstrable", "solid", "good", "great", "deep",
  "extensive", "relevant", "hands", "significant", "substantial", "sound", "working", "practical",
  "prior", "previous", "professional", "successful", "outstanding", "fluent", "native",
  "the", "and", "with", "of", "in", "for", "your", "our", "you", "must", "have", "has",
  "min", "minimum", "least", "years", "year", "experience",
  "gute", "sehr", "fundierte", "nachweisliche", "solide", "jahre", "erfahrung",
  "bonne", "solide", "excellente", "ans",
  "buen", "buena", "excelente", "anos", "años",
]);

export function tokens(value: string): string[] {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/*
 * Conservative suffix stemmer. "nursing" and "nurse" must meet; "java" and
 * "javascript" must not. A suffix is only stripped when at least four characters
 * survive, which keeps short technical tokens (java, sql, rust) intact.
 */
export function stem(token: string): string {
  const t = token.toLowerCase();
  for (const suffix of ["ing", "ed", "es", "s", "e"]) {
    if (t.length - suffix.length >= 4 && t.endsWith(suffix)) {
      return t.slice(0, t.length - suffix.length);
    }
  }
  return t;
}

/** Content stems: filler removed, stemmed, deduplicated. */
export function contentStems(value: string): string[] {
  const out = new Set<string>();
  for (const t of tokens(value)) {
    if (FILLER.has(t)) continue;
    out.add(stem(t));
  }
  return [...out];
}

/*
 * Word-boundary containment. `"java".includes("javascript")` is true and is exactly
 * how a JavaScript developer got credited with Java. This is not. Boundaries are
 * Unicode-aware because the CV corpus is multilingual and a \b-only regex mishandles
 * accented tokens.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return re.test(haystack);
}

/**
 * Do two requirement phrases refer to the same underlying requirement?
 *
 * "German (FLUENT)" and "Fluent German" carry the same content stem set once the
 * level word and the parenthetical are stripped. So do "valid nursing licence" and
 * "Nursing Licence". Either being a subset of the other means the smaller one adds
 * nothing, so it is a duplicate rather than a second requirement.
 */
export function isSameRequirement(a: string, b: string): boolean {
  const sa = new Set(contentStems(a));
  const sb = new Set(contentStems(b));
  if (!sa.size || !sb.size) return false;

  const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  for (const s of small) {
    if (!large.has(s)) return false;
  }
  return true;
}
