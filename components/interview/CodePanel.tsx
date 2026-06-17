"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";

const LANGUAGES = ["python", "javascript", "typescript", "sql", "java", "cpp"];

type CodePanelProps = {
  onCodeChange: (code: string, language: string) => void;
};

export default function CodePanel({ onCodeChange }: CodePanelProps) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");

  function handleChange(value: string | undefined) {
    const next = value || "";
    setCode(next);
    onCodeChange(next, language);
  }

  function handleLanguageChange(lang: string) {
    setLanguage(lang);
    onCodeChange(code, lang);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Code Workspace
        </span>
        <div className="flex gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${
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
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbers: "on",
            tabSize: 2,
            wordWrap: "on",
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/10 px-4 py-2 text-[10px] text-slate-600">
        Type your solution — the recruiter sees your code alongside your spoken answer
      </div>
    </div>
  );
}