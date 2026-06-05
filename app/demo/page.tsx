"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Mic, Play, Sparkles, Volume2 } from "lucide-react";

const demoRoles = [
  "Customer Success Manager",
  "Data Analyst",
  "Software Engineer",
  "IT Support Specialist",
];

const recruiters = [
  { id: "sarah", name: "Sarah", style: "Friendly HR Recruiter", voiceHint: "female" },
  { id: "daniel", name: "Daniel", style: "Analytical Hiring Manager", voiceHint: "male" },
  { id: "priya", name: "Priya", style: "Startup Recruiter", voiceHint: "female" },
];

const questions = [
  "Tell me briefly about yourself and why this role interests you.",
  "Give me one example where you solved a real problem.",
  "What measurable result or impact came from your work?",
];

function pickVoice(voices: SpeechSynthesisVoice[], recruiterId: string) {
  const femaleVoiceNames = [
    "zira",
    "jenny",
    "aria",
    "samantha",
    "susan",
    "victoria",
    "karen",
    "moira",
    "tessa",
    "serena",
    "ava",
    "emma",
    "amy",
    "joanna",
    "salli",
    "female",
  ];

  const maleVoiceNames = [
    "david",
    "mark",
    "george",
    "daniel",
    "alex",
    "tom",
    "male",
  ];

  const isMaleRecruiter = recruiterId === "daniel";

  const preferredNames = isMaleRecruiter ? maleVoiceNames : femaleVoiceNames;
  const blockedNames = isMaleRecruiter ? femaleVoiceNames : maleVoiceNames;

  const englishVoices = voices.filter((voice) => /^en/i.test(voice.lang || ""));

  const exactPreferred = englishVoices.find((voice) => {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return preferredNames.some((preferred) => name.includes(preferred));
  });

  if (exactPreferred) return exactPreferred;

  const safeEnglish = englishVoices.find((voice) => {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return !blockedNames.some((blocked) => name.includes(blocked));
  });

  return safeEnglish || englishVoices[0] || voices[0] || null;
}

function speak(text: string, recruiterId: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  const isMaleRecruiter = recruiterId === "daniel";

  utterance.rate = isMaleRecruiter ? 0.92 : 1;
  utterance.pitch = isMaleRecruiter ? 0.82 : 1.35;
  utterance.lang = "en-US";

  const preferred = pickVoice(voices, recruiterId);
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

function ensureVoicesLoaded() {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();

  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => resolve(), 600);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve();
    };
  });
}


export default function DemoPage() {
  const [role, setRole] = useState(demoRoles[0]);
  const [recruiter, setRecruiter] = useState(recruiters[0]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const currentQuestion = useMemo(() => {
    return `Hi, I'm ${recruiter.name}. This is a quick WorkZo demo for a ${role} interview. ${questions[questionIndex]}`;
  }, [questionIndex, recruiter.name, role]);

  async function startDemo() {
    setStarted(true);
    setQuestionIndex(0);
    await ensureVoicesLoaded();
    speak(currentQuestion, recruiter.id);
  }

  async function nextQuestion() {
    const next = Math.min(questionIndex + 1, questions.length - 1);
    setQuestionIndex(next);
    const text = `Question ${next + 1}. ${questions[next]}`;
    await ensureVoicesLoaded();
    speak(text, recruiter.id);
  }

  const finished = started && questionIndex >= questions.length - 1;

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-slate-300 hover:text-white">
            WorkZo AI
          </Link>
          <Link
            href="/pricing?intent=interview"
            className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
          >
            Start free interview
          </Link>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
              <Sparkles className="h-4 w-4" />
              Voice demo · no login · no CV
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-tight">
              Hear how WorkZo interviews feel in under 2 minutes.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              This demo uses browser TTS, not AI voice or AI video recruiter. It does not ask for your CV, JD, or account.
              For the real CV-based experience, start a free interview after the demo.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {demoRoles.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-black ${
                    role === item
                      ? "border-blue-300/40 bg-blue-500/20 text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {recruiters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRecruiter(item)}
                  className={`rounded-2xl border p-4 text-left ${
                    recruiter.id === item.id
                      ? "border-cyan-300/40 bg-cyan-400/15"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <p className="font-black">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.style}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={startDemo}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 text-sm font-black text-white hover:bg-blue-400"
              >
                <Play className="h-4 w-4" />
                Try voice demo
              </button>
              <Link
                href="/pricing?intent=interview"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 px-6 text-sm font-black text-slate-200 hover:bg-white/10"
              >
                Start free interview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-cyan-400/10 p-6">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-500/20">
                  <Mic className="h-7 w-7 text-blue-200" />
                </div>
                <div>
                  <p className="text-xl font-black">{recruiter.name}</p>
                  <p className="text-sm text-slate-300">{recruiter.style}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                  Demo Question {started ? questionIndex + 1 : 0} of 3
                </p>
                <p className="mt-3 text-lg font-bold leading-8 text-white">
                  {started ? currentQuestion : "Choose a role and recruiter, then start the voice demo."}
                </p>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={async () => { await ensureVoicesLoaded(); speak(currentQuestion, recruiter.id); }}
                  disabled={!started}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-40"
                >
                  <Volume2 className="h-4 w-4" />
                  Replay
                </button>
                <button
                  type="button"
                  onClick={nextQuestion}
                  disabled={!started || finished}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5">
              <p className="flex items-center gap-2 text-sm font-black text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Demo summary
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                The full interview uses your CV and job description, asks deeper follow-ups,
                and gives a results report. Free users get 2 full AI voice interviews.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
