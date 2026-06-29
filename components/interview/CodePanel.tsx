"use client";

import Editor from "@monaco-editor/react";
import { useState, useRef } from "react";

const LANGUAGES = ["python", "javascript", "typescript", "sql", "java", "cpp"];

// Language hints shown to the candidate
const LANGUAGE_HINTS: Record<string, string> = {
  python: "# Write your solution here\n# Talk through your approach as you code\n",
  javascript: "// Write your solution here\n// Talk through your approach as you code\n",
  typescript: "// Write your solution here\n// Talk through your approach as you code\n",
  sql: "-- Write your query here\n-- Talk through your approach as you code\n",
  java: "// Write your solution here\n// Talk through your approach as you code\n",
  cpp: "// Write your solution here\n// Talk through your approach as you code\n",
};

// Common patterns Alex will probe based on language
const COMPLEXITY_PROMPTS: Record<string, string[]> = {
  python: ["What's the time complexity?", "Can you do this in O(n)?", "What about space complexity?"],
  javascript: ["What's the time complexity?", "How does this handle async?", "Any memory leaks?"],
  typescript: ["What's the time complexity?", "Why these types?", "How do you handle null?"],
  sql: ["What's the execution plan?", "How does this scale?", "Can you add an index?"],
  java: ["What's the time complexity?", "Thread safety?", "Memory footprint?"],
  cpp: ["What's the time complexity?", "Memory management?", "Stack vs heap?"],
};

type CodePanelProps = {
  onCodeChange: (code: string, language: string) => void;
};

export default function CodePanel({ onCodeChange }: CodePanelProps) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(LANGUAGE_HINTS["python"]);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [outputError, setOutputError] = useState(false);
  const editorRef = useRef<unknown>(null);

  function handleChange(value: string | undefined) {
    const next = value || "";
    setCode(next);
    onCodeChange(next, language);
  }

  function handleLanguageChange(lang: string) {
    setLanguage(lang);
    const hint = LANGUAGE_HINTS[lang] || "";
    setCode(hint);
    onCodeChange(hint, lang);
    setOutput(null);
  }

  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setOutput(null);
    setOutputError(false);

    try {
      // Use Piston API (free, no auth required, runs code in sandboxed env)
      const langMap: Record<string, { language: string; version: string }> = {
        python: { language: "python", version: "3.10.0" },
        javascript: { language: "javascript", version: "18.15.0" },
        typescript: { language: "typescript", version: "5.0.3" },
        java: { language: "java", version: "15.0.2" },
        cpp: { language: "c++", version: "10.2.0" },
      };

      if (language === "sql") {
        setOutput("SQL execution not available in the interview sandbox.\nDescribe your query logic to the recruiter verbally.");
        setRunning(false);
        return;
      }

      const lang = langMap[language];
      if (!lang) {
        setOutput(`Language '${language}' is not runnable in the sandbox. Describe your logic verbally.`);
        setRunning(false);
        return;
      }

      const res = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang.language,
          version: lang.version,
          files: [{ name: "solution", content: code }],
          stdin: "",
          args: [],
          compile_timeout: 10000,
          run_timeout: 5000,
        }),
      });

      const data = await res.json();
      const stdout = data?.run?.stdout || "";
      const stderr = data?.run?.stderr || "";
      const compileErr = data?.compile?.stderr || "";

      if (compileErr) {
        setOutput(compileErr.trim());
        setOutputError(true);
      } else if (stderr) {
        setOutput(stderr.trim());
        setOutputError(true);
      } else if (stdout) {
        setOutput(stdout.trim());
        setOutputError(false);
      } else {
        setOutput("(no output)");
        setOutputError(false);
      }
    } catch {
      setOutput("Could not connect to the code runner. Check your connection and try again.");
      setOutputError(true);
    } finally {
      setRunning(false);
    }
  }

  const prompts = COMPLEXITY_PROMPTS[language] || [];

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Code Workspace
          </span>
          <span className="rounded border border-blue-400/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-300">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                language === lang
                  ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleChange}
          onMount={(editor) => { editorRef.current = editor; }}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            tabSize: 2,
            wordWrap: "on",
            renderLineHighlight: "line",
            overviewRulerLanes: 0,
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>

      {/* Run bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-[#0a0e17] px-4 py-2">
        <div className="flex items-center gap-2">
          {prompts.map((p) => (
            <span key={p} className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] text-slate-600">
              {p}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={runCode}
          disabled={running || !code.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-400 disabled:opacity-40"
        >
          {running ? (
            <>
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Running...
            </>
          ) : (
            <>▶ Run</>
          )}
        </button>
      </div>

      {/* Output panel */}
      {output !== null && (
        <div className={`border-t px-4 py-3 max-h-32 overflow-y-auto ${outputError ? "border-red-500/20 bg-red-500/[0.05]" : "border-emerald-500/20 bg-emerald-500/[0.04]"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[9px] font-black uppercase tracking-wide ${outputError ? "text-red-400" : "text-emerald-400"}`}>
              {outputError ? "Error" : "Output"}
            </span>
            <button type="button" onClick={() => setOutput(null)} className="text-[9px] text-slate-600 hover:text-slate-400">
              Clear
            </button>
          </div>
          <pre className={`text-[11px] leading-5 font-mono whitespace-pre-wrap ${outputError ? "text-red-200" : "text-emerald-100"}`}>
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
