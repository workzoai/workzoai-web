"use client";

/*
 * WorkZo AI - interview code workspace
 *
 * WHAT CHANGED
 *
 * Before: a blank Monaco editor containing "# Write your solution here", a Run
 * button that POSTed straight from the browser to a public third-party endpoint,
 * SQL that simply could not run, and no way to know whether the answer was
 * correct. Alex received the code and nothing else.
 *
 * Now:
 *   - a real PROBLEM, drawn from the assessment engine's question bank, chosen
 *     from the candidate's target role and CV, at a difficulty their CV earns
 *   - SQL runs, in-browser, on SQLite/WASM, against a seeded schema
 *   - a real VERDICT: tests execute; SQL result sets are compared to a reference
 *   - code, output, AND verdict all reach Alex, so he can say "your code threw
 *     an IndexError on the empty case" instead of guessing from the source
 */

import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSqlSandbox,
  type SqlSandbox,
  type SqlResult,
  type SqlVerdict,
} from "@/lib/workzoSqlSandbox";
import {
  readVerdictFromStdout,
  wrapWithHarness,
  type ChallengeLanguage,
  type CodeVerdict,
  type InterviewCodeChallenge,
} from "@/lib/workzoInterviewCodeChallenge";

export type CodeWorkspaceState = {
  code: string;
  language: string;
  /** What the candidate's program printed. Alex sees this. */
  output: string;
  /** Deterministic verdict, when the question supports one. Alex sees this too. */
  verdict: string;
  challengePrompt: string;
};

type CodePanelProps = {
  onCodeChange: (state: CodeWorkspaceState) => void;
  /** When absent, the panel falls back to a free-form scratchpad. */
  challenge?: InterviewCodeChallenge | null;
  sessionId?: string;
};

const FALLBACK_HINTS: Record<string, string> = {
  python: "# Scratchpad. Talk through your approach as you code.\n",
  javascript: "// Scratchpad. Talk through your approach as you code.\n",
  typescript: "// Scratchpad. Talk through your approach as you code.\n",
  sql: "-- Scratchpad. Talk through your approach as you write.\n",
  java: "// Scratchpad. Talk through your approach as you code.\n",
  cpp: "// Scratchpad. Talk through your approach as you code.\n",
};

const ALL_LANGUAGES: ChallengeLanguage[] = ["python", "javascript", "typescript", "sql", "java", "cpp"];

function describeCodeVerdict(v: CodeVerdict): string {
  if (v.status === "unverifiable") return "";
  return `TESTS: ${v.status.toUpperCase()} (${v.passed}/${v.total}). ${v.detail}`;
}

function describeSqlVerdict(v: SqlVerdict, result: SqlResult | null): string {
  if (v.status === "unverifiable") {
    return result?.ok ? `QUERY RAN: ${result.rowCount} row(s) returned.` : "";
  }
  return `QUERY: ${v.status.toUpperCase()}. ${v.detail}`;
}

export default function CodePanel({ onCodeChange, challenge, sessionId }: CodePanelProps) {
  const languages = useMemo<ChallengeLanguage[]>(
    () => (challenge ? challenge.languages : ALL_LANGUAGES),
    [challenge],
  );

  const [language, setLanguage] = useState<ChallengeLanguage>(languages[0] || "python");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputError, setOutputError] = useState(false);
  const [verdict, setVerdict] = useState<string>("");
  const [verdictTone, setVerdictTone] = useState<"pass" | "fail" | "none">("none");
  const [grid, setGrid] = useState<SqlResult | null>(null);
  const [showSchema, setShowSchema] = useState(true);

  const sandboxRef = useRef<SqlSandbox | null>(null);
  const [sandboxError, setSandboxError] = useState<string>("");

  /* ── seed the editor from the challenge ──────────────────────────────── */
  useEffect(() => {
    const starter =
      (challenge?.starterCode as Record<string, string> | undefined)?.[language] ||
      FALLBACK_HINTS[language] ||
      "";
    setCode(starter);
    setOutput(null);
    setVerdict("");
    setVerdictTone("none");
    setGrid(null);
    onCodeChange({
      code: starter,
      language,
      output: "",
      verdict: "",
      challengePrompt: challenge?.prompt || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.questionId, language]);

  /* ── build the SQL sandbox once per challenge ────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    sandboxRef.current?.close();
    sandboxRef.current = null;
    setSandboxError("");

    if (challenge?.kind !== "sql" || !challenge.context) return;

    createSqlSandbox({ context: challenge.context })
      .then((sandbox) => {
        if (cancelled) sandbox.close();
        else sandboxRef.current = sandbox;
      })
      .catch((error) => {
        if (!cancelled) {
          setSandboxError(
            "The SQL sandbox could not start. You can still write the query and talk it through.",
          );
          console.error("[WorkZo] sql sandbox failed", error);
        }
      });

    return () => {
      cancelled = true;
      sandboxRef.current?.close();
      sandboxRef.current = null;
    };
  }, [challenge?.questionId, challenge?.kind, challenge?.context]);

  const push = useCallback(
    (next: Partial<CodeWorkspaceState>) => {
      onCodeChange({
        code,
        language,
        output: output || "",
        verdict,
        challengePrompt: challenge?.prompt || "",
        ...next,
      });
    },
    [code, language, output, verdict, challenge?.prompt, onCodeChange],
  );

  function handleChange(value: string | undefined) {
    const next = value || "";
    setCode(next);
    push({ code: next });
  }

  /* ── SQL: runs entirely in the browser ───────────────────────────────── */
  async function runSql() {
    const sandbox = sandboxRef.current;
    if (!sandbox) {
      setOutput(sandboxError || "The SQL sandbox is still starting. Try again in a moment.");
      setOutputError(true);
      return;
    }

    const result = sandbox.run(code);
    setGrid(result.ok ? result : null);

    if (!result.ok) {
      setOutput(result.error || "The query failed.");
      setOutputError(true);
      setVerdict("");
      setVerdictTone("none");
      push({ output: result.error || "query failed", verdict: "" });
      return;
    }

    const v = challenge?.referenceSolution
      ? sandbox.verify(code, challenge.referenceSolution)
      : ({ status: "unverifiable", detail: "" } as SqlVerdict);

    const summary = describeSqlVerdict(v, result);
    setOutput(`${result.rowCount} row(s) returned.`);
    setOutputError(false);
    setVerdict(summary);
    setVerdictTone(v.status === "pass" ? "pass" : v.status === "unverifiable" ? "none" : "fail");
    push({ output: `${result.rowCount} row(s) returned`, verdict: summary });
  }

  /* ── code: runs on the server, which proxies the sandbox ─────────────── */
  async function runCode() {
    const { source, harnessed } = challenge
      ? wrapWithHarness(language, code, challenge)
      : { source: code, harnessed: false };

    const res = await fetch("/api/code/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionId ? { "x-workzo-session": sessionId } : {}),
      },
      body: JSON.stringify({ language, source }),
    });

    const data = await res.json();

    if (!res.ok) {
      setOutput(data?.error || "The code runner is unavailable.");
      setOutputError(true);
      push({ output: data?.error || "runner unavailable", verdict: "" });
      return;
    }

    const compileError = String(data.compileError || "");
    const stderr = String(data.stderr || "");
    const stdout = String(data.stdout || "");

    if (compileError || stderr) {
      const err = (compileError || stderr).trim();
      setOutput(err);
      setOutputError(true);
      setVerdict("");
      setVerdictTone("none");
      // The error is the most useful thing Alex can react to. Send it.
      push({ output: err, verdict: "" });
      return;
    }

    if (!harnessed || !challenge) {
      setOutput(stdout.trim() || "(no output)");
      setOutputError(false);
      push({ output: stdout.trim(), verdict: "" });
      return;
    }

    const { cleanStdout, verdict: v } = readVerdictFromStdout(stdout, challenge);
    const summary = describeCodeVerdict(v);
    setOutput(cleanStdout || (v.status === "pass" ? "(no output)" : ""));
    setOutputError(false);
    setVerdict(summary);
    setVerdictTone(v.status === "pass" ? "pass" : v.status === "unverifiable" ? "none" : "fail");
    push({ output: cleanStdout, verdict: summary });
  }

  async function run() {
    if (!code.trim() || running) return;
    setRunning(true);
    setOutput(null);
    setOutputError(false);
    try {
      if (language === "sql") await runSql();
      else await runCode();
    } catch (error) {
      setOutput("The run failed. Talk the recruiter through your approach.");
      setOutputError(true);
      console.error("[WorkZo] code run failed", error);
    } finally {
      setRunning(false);
    }
  }

  const visibleTests = (challenge?.tests || []).filter((t) => !t.hidden);
  const hiddenCount = (challenge?.tests || []).length - visibleTests.length;

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {/* ── the problem ─────────────────────────────────────────────────── */}
      {challenge ? (
        <div className="shrink-0 rounded-lg border border-line bg-canvas/60 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
              {challenge.kind === "sql" ? "SQL" : "Code"}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-subtle">
              {challenge.skill} · {challenge.difficulty} · ~{Math.round(challenge.timeSeconds / 60)} min
            </span>
          </div>
          <p className="text-sm leading-relaxed text-body">{challenge.prompt}</p>

          {challenge.context ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowSchema((s) => !s)}
                className="text-[11px] font-semibold uppercase tracking-wider text-subtle hover:text-body"
              >
                {showSchema ? "Hide" : "Show"} {challenge.kind === "sql" ? "schema" : "notes"}
              </button>
              {showSchema ? (
                <pre className="mt-1 overflow-x-auto rounded border border-line bg-black/20 p-2 text-[11px] leading-snug text-muted">
                  {sandboxRef.current?.describe() || challenge.context}
                </pre>
              ) : null}
            </div>
          ) : null}

          {visibleTests.length ? (
            <p className="mt-2 text-[11px] text-subtle">
              {visibleTests.length} example case{visibleTests.length === 1 ? "" : "s"} shown
              {hiddenCount > 0 ? `, ${hiddenCount} hidden edge case${hiddenCount === 1 ? "" : "s"} run on submit` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {languages.length > 1 ? (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as ChallengeLanguage)}
            className="rounded border border-line bg-canvas px-2 py-1 text-xs text-body"
            aria-label="Language"
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded border border-line px-2 py-1 text-xs uppercase text-subtle">
            {language}
          </span>
        )}

        <button
          type="button"
          onClick={run}
          disabled={running || !code.trim()}
          className="rounded bg-brand px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
        >
          {running ? "Running..." : challenge?.tests?.length || challenge?.referenceSolution ? "Run tests" : "Run"}
        </button>

        {verdict ? (
          <span
            className={`truncate rounded px-2 py-1 text-[11px] font-semibold ${
              verdictTone === "pass"
                ? "bg-emerald-500/15 text-emerald-400"
                : verdictTone === "fail"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-white/5 text-subtle"
            }`}
            title={verdict}
          >
            {verdict}
          </span>
        ) : null}
      </div>

      {/* ── editor ──────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line">
        <Editor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          theme="vs-dark"
          value={code}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: language === "python" ? 4 : 2,
          }}
        />
      </div>

      {/* ── result ──────────────────────────────────────────────────────── */}
      {grid && grid.ok && grid.columns.length ? (
        <div className="max-h-40 shrink-0 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-canvas">
              <tr>
                {grid.columns.map((c) => (
                  <th key={c} className="border-b border-line px-2 py-1 font-semibold text-muted">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="odd:bg-white/[0.02]">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 text-body">
                      {cell === null ? "NULL" : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {output !== null ? (
        <pre
          className={`max-h-28 shrink-0 overflow-auto rounded-lg border p-2 text-[11px] leading-snug ${
            outputError ? "border-rose-500/40 text-rose-300" : "border-line text-muted"
          }`}
        >
          {output}
        </pre>
      ) : null}

      {sandboxError ? <p className="shrink-0 text-[11px] text-amber-400">{sandboxError}</p> : null}
    </div>
  );
}
