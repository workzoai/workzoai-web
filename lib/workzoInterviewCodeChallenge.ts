/*
 * WorkZo AI - interview code challenge
 *
 * WHAT THIS FIXES
 *
 * The interview code workspace opened a BLANK editor containing:
 *
 *     # Write your solution here
 *
 * No problem statement. No signature. No constraints. No examples. Alex had to
 * invent a question conversationally, every time, and nothing checked whether
 * the answer was correct. A technical screen without a stated problem is not a
 * screen, and a coding school cannot be sold "did my student solve it?" when the
 * answer is an LLM's impression of some text.
 *
 * Meanwhile `workzoTechnicalAssessmentEngine.ts` already contained a question
 * bank with exactly the right shape (question, context/schema, scoringGuide,
 * timeSeconds) and was referenced ZERO times inside the interview. The hard part
 * was built and never plugged in.
 *
 * This module is the bridge. It turns a TechnicalQuestion into something the
 * candidate can actually run and something that can actually be graded:
 *
 *   - a problem statement and the schema, shown above the editor
 *   - starter code with the required function signature, per language
 *   - a TEST HARNESS that executes the candidate's function against real cases
 *     and returns a deterministic pass/fail, rather than an opinion
 *
 * Verification degrades honestly:
 *   tests present        -> real PASS/FAIL per case
 *   reference SQL present-> real PASS/FAIL against the reference result set
 *   neither              -> "unverifiable": run the code, show the output, and
 *                           let Alex judge against the scoringGuide. We never
 *                           claim a verdict we did not earn.
 */

import {
  buildTechnicalAssessment,
  type TechnicalQuestion,
} from "./workzoTechnicalAssessmentEngine";

export type ChallengeLanguage = "python" | "javascript" | "typescript" | "sql" | "java" | "cpp";

export type CodeTestCase = {
  /** Positional arguments passed to the candidate's function. */
  args: unknown[];
  expected: unknown;
  /** Shown to the candidate. Hidden cases (edge cases) are revealed only after a run. */
  hidden?: boolean;
};

export type InterviewCodeChallenge = {
  questionId: string;
  skill: string;
  kind: "code" | "sql";
  difficulty: string;
  /** The problem, shown above the editor. */
  prompt: string;
  /** Schema (SQL) or constraints (code). */
  context: string;
  /** What a good answer contains. Sent to Alex, never shown to the candidate. */
  scoringGuide: string;
  timeSeconds: number;
  /** Function the candidate must define, for code questions. */
  entryPoint?: string;
  tests?: CodeTestCase[];
  referenceSolution?: string;
  /** Languages this challenge can be answered in. */
  languages: ChallengeLanguage[];
  starterCode: Partial<Record<ChallengeLanguage, string>>;
};

export type TestOutcome = {
  index: number;
  passed: boolean;
  args: unknown[];
  expected: unknown;
  got?: unknown;
  error?: string;
  hidden?: boolean;
};

export type CodeVerdict = {
  status: "pass" | "fail" | "error" | "unverifiable";
  passed: number;
  total: number;
  detail: string;
  outcomes?: TestOutcome[];
};

/* ───────────────────────────── starter code ───────────────────────────── */

function pyLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None");
}

function buildStarter(question: TechnicalQuestion, entryPoint: string, tests: CodeTestCase[]) {
  const visible = tests.filter((t) => !t.hidden).slice(0, 2);
  const arity = tests[0]?.args.length ?? 1;
  const params = Array.from({ length: arity }, (_, i) => `arg${i + 1}`);

  const examplesPy = visible
    .map((t) => `#   ${entryPoint}(${t.args.map(pyLiteral).join(", ")})  ->  ${pyLiteral(t.expected)}`)
    .join("\n");
  const examplesJs = visible
    .map((t) => `//   ${entryPoint}(${t.args.map((a) => JSON.stringify(a)).join(", ")})  ->  ${JSON.stringify(t.expected)}`)
    .join("\n");

  return {
    python: `# ${question.question.split("\n")[0]}\n#\n# Examples:\n${examplesPy}\n#\n# Talk through your approach as you code.\n\ndef ${entryPoint}(${params.join(", ")}):\n    pass\n`,
    javascript: `// ${question.question.split("\n")[0]}\n//\n// Examples:\n${examplesJs}\n//\n// Talk through your approach as you code.\n\nfunction ${entryPoint}(${params.join(", ")}) {\n  \n}\n`,
    typescript: `// ${question.question.split("\n")[0]}\n//\n// Examples:\n${examplesJs}\n\nfunction ${entryPoint}(${params.map((p) => `${p}: any`).join(", ")}): any {\n  \n}\n`,
  };
}

/* ────────────────────────────── test harness ──────────────────────────── */

/**
 * The candidate's code is executed VERBATIM, then a harness we append calls
 * their function against each case and prints one machine-readable line. We
 * parse only that line, so anything they print themselves still shows up as
 * normal stdout and never corrupts the verdict.
 *
 * Comparison is by canonical JSON, which is stricter than `==` and does not
 * silently pass `"1"` for `1`.
 */
const MARKER = "__WORKZO_TESTS__";

export function buildPythonHarness(code: string, entryPoint: string, tests: CodeTestCase[]): string {
  const cases = JSON.stringify(tests.map((t) => ({ args: t.args, expected: t.expected })));
  return `${code}

# ---- WorkZo test harness (appended, not part of your solution) ----
import json as __json
__cases = __json.loads(${JSON.stringify(cases)})
__results = []
for __i, __c in enumerate(__cases):
    try:
        __got = ${entryPoint}(*__c["args"])
        try:
            __ok = __json.loads(__json.dumps(__got)) == __c["expected"]
        except Exception:
            __ok = __got == __c["expected"]
        __results.append({"i": __i, "pass": bool(__ok), "got": __got})
    except Exception as __e:
        __results.append({"i": __i, "pass": False, "error": type(__e).__name__ + ": " + str(__e)})
print("${MARKER}" + __json.dumps(__results, default=str))
`;
}

export function buildJsHarness(code: string, entryPoint: string, tests: CodeTestCase[]): string {
  const cases = JSON.stringify(tests.map((t) => ({ args: t.args, expected: t.expected })));
  return `${code}

// ---- WorkZo test harness (appended, not part of your solution) ----
const __cases = ${cases};
const __results = __cases.map((c, i) => {
  try {
    const got = ${entryPoint}(...c.args);
    const ok = JSON.stringify(got) === JSON.stringify(c.expected);
    return { i, pass: ok, got };
  } catch (e) {
    return { i, pass: false, error: (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : String(e)) };
  }
});
console.log("${MARKER}" + JSON.stringify(__results));
`;
}

export function wrapWithHarness(
  language: ChallengeLanguage,
  code: string,
  challenge: InterviewCodeChallenge,
): { source: string; harnessed: boolean } {
  const tests = challenge.tests || [];
  const entry = challenge.entryPoint;
  if (!tests.length || !entry) return { source: code, harnessed: false };

  if (language === "python") return { source: buildPythonHarness(code, entry, tests), harnessed: true };
  if (language === "javascript" || language === "typescript") {
    return { source: buildJsHarness(code, entry, tests), harnessed: true };
  }
  // Java and C++ are runnable but not auto-graded: their harness needs a full
  // class/main scaffold and a type-aware comparator. Honest degradation beats a
  // fake verdict, so these fall back to "run and show the output".
  return { source: code, harnessed: false };
}

/**
 * Splits a run's stdout into what the CANDIDATE printed and what the harness
 * reported. The candidate's own prints must survive: they debug with them.
 */
export function readVerdictFromStdout(
  stdout: string,
  challenge: InterviewCodeChallenge,
): { cleanStdout: string; verdict: CodeVerdict } {
  const tests = challenge.tests || [];
  const lines = String(stdout || "").split("\n");
  const markerLine = lines.find((l) => l.startsWith(MARKER));
  const cleanStdout = lines.filter((l) => !l.startsWith(MARKER)).join("\n").trim();

  if (!markerLine) {
    return {
      cleanStdout,
      verdict: {
        status: "unverifiable",
        passed: 0,
        total: tests.length,
        detail: tests.length
          ? "the harness did not run: your code may have crashed before the tests, or the function name does not match"
          : "no tests for this question, judged on approach and output",
      },
    };
  }

  try {
    const raw = JSON.parse(markerLine.slice(MARKER.length)) as Array<{
      i: number;
      pass: boolean;
      got?: unknown;
      error?: string;
    }>;
    const outcomes: TestOutcome[] = raw.map((r) => ({
      index: r.i,
      passed: Boolean(r.pass),
      args: tests[r.i]?.args ?? [],
      expected: tests[r.i]?.expected,
      got: r.got,
      error: r.error,
      hidden: tests[r.i]?.hidden,
    }));
    const passed = outcomes.filter((o) => o.passed).length;
    const total = outcomes.length;
    const firstFail = outcomes.find((o) => !o.passed);

    // If EVERY case failed because the function does not exist, say so plainly.
    // "ReferenceError: two_sum is not defined" repeated four times teaches a
    // student nothing. "Your function must be named two_sum" teaches them the
    // one thing they need.
    const entry = challenge.entryPoint || "";
    const allUndefined =
      total > 0 &&
      passed === 0 &&
      outcomes.every((o) =>
        new RegExp(`(NameError|ReferenceError).*\\b${entry}\\b`).test(o.error || ""),
      );
    if (allUndefined) {
      return {
        cleanStdout,
        verdict: {
          status: "fail",
          passed: 0,
          total,
          detail: `your solution must define a function named \`${entry}\`. Nothing else ran.`,
          outcomes,
        },
      };
    }

    return {
      cleanStdout,
      verdict: {
        status: passed === total ? "pass" : "fail",
        passed,
        total,
        detail:
          passed === total
            ? `all ${total} test cases passed`
            : firstFail?.error
              ? `${passed}/${total} passed. Case ${(firstFail.index ?? 0) + 1} threw ${firstFail.error}`
              : `${passed}/${total} passed. Case ${(firstFail?.index ?? 0) + 1} expected ${JSON.stringify(firstFail?.expected)}, got ${JSON.stringify(firstFail?.got)}`,
        outcomes,
      },
    };
  } catch {
    return {
      cleanStdout,
      verdict: { status: "error", passed: 0, total: tests.length, detail: "could not read the test results" },
    };
  }
}

/* ─────────────────────────── challenge selection ──────────────────────── */

/**
 * Picks the coding or SQL question for THIS interview, from the candidate's
 * target role and CV. Difficulty is already inferred from the CV by the
 * assessment engine, so a bootcamp graduate gets a foundational problem and a
 * senior engineer does not.
 */
export function selectInterviewChallenge(input: {
  targetRole: string;
  cvText?: string;
  /** Pass the previous question id to rotate to a different one. */
  excludeQuestionId?: string;
}): InterviewCodeChallenge | null {
  const assessment = buildTechnicalAssessment({
    targetRole: input.targetRole,
    cvText: input.cvText,
    maxQuestions: 8,
  });

  const runnable = assessment.questions.filter(
    (q: TechnicalQuestion) => (q.type === "code" || q.type === "sql") && q.id !== input.excludeQuestionId,
  );
  const question = runnable[0];
  if (!question) return null;

  return toChallenge(question);
}

export function toChallenge(question: TechnicalQuestion): InterviewCodeChallenge {
  const q = question as TechnicalQuestion & {
    entryPoint?: string;
    tests?: CodeTestCase[];
    referenceSolution?: string;
  };

  if (question.type === "sql") {
    return {
      questionId: question.id,
      skill: question.skill,
      kind: "sql",
      difficulty: question.difficulty,
      prompt: question.question,
      context: question.context || "",
      scoringGuide: question.scoringGuide,
      timeSeconds: question.timeSeconds,
      referenceSolution: q.referenceSolution,
      languages: ["sql"],
      starterCode: { sql: "-- Write your query here.\n-- The tables below are real: run it and check the result.\n\n" },
    };
  }

  const entryPoint = q.entryPoint || "solve";
  const tests = q.tests || [];
  const starter = buildStarter(question, entryPoint, tests);

  return {
    questionId: question.id,
    skill: question.skill,
    kind: "code",
    difficulty: question.difficulty,
    prompt: question.question,
    context: question.context || "",
    scoringGuide: question.scoringGuide,
    timeSeconds: question.timeSeconds,
    entryPoint,
    tests,
    languages: ["python", "javascript", "typescript"],
    starterCode: starter,
  };
}

export const __workzoInterviewCodeChallengeVersion = "1.0.0";
