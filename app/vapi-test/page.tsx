"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

type RecruiterKey = "Sarah" | "Priya" | "Daniel" | "Markus";

const recruiters: Record<RecruiterKey, { env: string; label: string }> = {
  Sarah: {
    env: "NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID",
    label: "Sarah - Friendly HR",
  },
  Priya: {
    env: "NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID",
    label: "Priya - Startup Recruiter",
  },
  Daniel: {
    env: "NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID",
    label: "Daniel - Analytical Hiring Manager",
  },
  Markus: {
    env: "NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID",
    label: "Markus - Corporate Interviewer",
  },
};

const assistantIds: Record<RecruiterKey, string | undefined> = {
  Sarah: process.env.NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID,
  Priya: process.env.NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID,
  Daniel: process.env.NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID,
  Markus: process.env.NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID,
};

export default function VapiTestPage() {
  const vapiRef = useRef<any>(null);

  const [selectedRecruiter, setSelectedRecruiter] =
    useState<RecruiterKey>("Sarah");
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "ended" | "error"
  >("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const assistantId = assistantIds[selectedRecruiter];

  function addLog(message: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${message}`, ...prev].slice(0, 80));
  }

  useEffect(() => {
    if (!publicKey) {
      addLog("Missing NEXT_PUBLIC_VAPI_PUBLIC_KEY");
      return;
    }

    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("connected");
      addLog("AI voice call started successfully.");
    });

    vapi.on("call-end", () => {
      setStatus("ended");
      addLog("AI voice call ended.");
    });

    vapi.on("speech-start", () => {
      addLog("Recruiter speech started. Audio output should be audible now.");
    });

    vapi.on("speech-end", () => {
      addLog("Recruiter speech ended.");
    });

    vapi.on("message", (message: any) => {
      addLog(`Message: ${JSON.stringify(message)}`);
    });

    vapi.on("error", (error: any) => {
      setStatus("error");
      addLog(`AI voice error: ${JSON.stringify(error)}`);
      console.error("AI voice test error:", error);
    });

    return () => {
      try {
        vapi.stop();
      } catch {
        // ignore cleanup errors
      }
      vapiRef.current = null;
    };
  }, [publicKey]);

  async function startTest() {
    if (!vapiRef.current) {
      addLog("AI voice instance not ready.");
      return;
    }

    if (!assistantId) {
      setStatus("error");
      addLog(
        `Missing assistant ID for ${selectedRecruiter}. Add ${recruiters[selectedRecruiter].env} in .env.local.`
      );
      return;
    }

    try {
      setStatus("connecting");
      addLog(`Starting AI voice test for ${selectedRecruiter}...`);
      addLog(`Assistant ID: ${assistantId}`);

      await vapiRef.current.start(assistantId);
    } catch (error: any) {
      setStatus("error");
      addLog(`Start failed: ${error?.message || JSON.stringify(error)}`);
      console.error("AI voice start failed:", error);
    }
  }

  function stopTest() {
    try {
      vapiRef.current?.stop();
      setStatus("ended");
      addLog("Stopped manually.");
    } catch (error: any) {
      setStatus("error");
      addLog(`Stop failed: ${error?.message || JSON.stringify(error)}`);
    }
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    try {
      vapiRef.current?.setMuted(nextMuted);
      addLog(nextMuted ? "Microphone muted." : "Microphone unmuted.");
    } catch (error: any) {
      addLog(`Mute toggle failed: ${error?.message || JSON.stringify(error)}`);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            WorkZo AI Phase 2
          </p>

          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            Isolated AI voice Test Room
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
            This page only tests AI voice connection, recruiter audio, microphone
            input, and assistant stability. It does not use analytics,
            interview intelligence, history, scoring, or the main interview
            flow.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Choose recruiter assistant</h2>

            <div className="mt-5 space-y-3">
              {(Object.keys(recruiters) as RecruiterKey[]).map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    if (status === "connected" || status === "connecting") {
                      addLog("Stop the current call before switching recruiter.");
                      return;
                    }

                    setSelectedRecruiter(name);
                    setStatus("idle");
                    addLog(`Selected ${name}.`);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedRecruiter === name
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <p className="font-bold">{recruiters[name].label}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Env: {recruiters[name].env}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-slate-400">Current status</p>
              <p className="mt-1 text-lg font-black uppercase tracking-wide">
                {status}
              </p>

              <p className="mt-4 text-sm text-slate-400">Selected assistant</p>
              <p className="mt-1 break-all text-sm">
                {assistantId || "Missing assistant ID"}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={startTest}
                disabled={status === "connecting" || status === "connected"}
                className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start AI voice Test
              </button>

              <button
                onClick={stopTest}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Stop
              </button>

              <button
                onClick={toggleMute}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                {isMuted ? "Unmute Mic" : "Mute Mic"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Live AI voice logs</h2>

            <div className="mt-5 h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Logs will appear here after starting a test.
                </p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <pre
                      key={`${log}-${index}`}
                      className="whitespace-pre-wrap break-words rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300"
                    >
                      {log}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">
          <p className="font-bold">Required .env.local values:</p>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">
{`NEXT_PUBLIC_WORKZO_VOICE_PROVIDER=tts

NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key

NEXT_PUBLIC_VAPI_SARAH_ASSISTANT_ID=your_sarah_assistant_id
NEXT_PUBLIC_VAPI_PRIYA_ASSISTANT_ID=your_priya_assistant_id
NEXT_PUBLIC_VAPI_DANIEL_ASSISTANT_ID=your_daniel_assistant_id
NEXT_PUBLIC_VAPI_MARKUS_ASSISTANT_ID=your_markus_assistant_id`}
          </pre>
        </div>
      </div>
    </main>
  );
}