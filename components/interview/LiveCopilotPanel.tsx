"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRecruiterIntentInsight,
  getRecruiterSpecificFollowUp,
} from "@/lib/workzoRecruiterIntent";
import { Brain, ChevronDown, ChevronUp, Lightbulb, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
import { analyzeEmotionalSignals } from "@/lib/workzoEmotionalCoach";
import {
  getCareerMemoryCoachLine,
  readCareerMemory,
  updateCareerMemoryFromAnswer,
  type WorkZoCareerMemory,
} from "@/lib/workzoCareerMemory";

type LiveCopilotPanelProps = {
  question?: string;
  latestAnswer?: string;
  recruiterState?: string;
  recruiterTrust?: number;
  targetRole?: string;
  recruiterId?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function hasMetric(text: string) {
  return /\d|percent|%|reduced|increased|saved|improved|faster|tickets|users|customers|revenue|cost/i.test(text);
}

function hasOwnership(text: string) {
  return /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bowned\b|\bcreated\b|\bimproved\b|\bhandled\b|\bresolved\b|\bimplemented\b/i.test(text);
}

function getIntent(question: string) {
  const lower = question.toLowerCase();

  if (lower.includes("project")) return "Recruiter is testing ownership, impact, and how clearly you explain your contribution.";
  if (lower.includes("challenge") || lower.includes("difficult")) return "Recruiter is testing problem-solving, pressure handling, and recovery.";
  if (lower.includes("why")) return "Recruiter is testing motivation, role fit, and whether your answer feels specific.";
  if (lower.includes("team")) return "Recruiter is testing collaboration without losing personal ownership.";

  return "Recruiter is testing whether your answer is specific, structured, and backed by evidence.";
}

export default function LiveCopilotPanel({
  question = "",
  latestAnswer = "",
  recruiterState = "listening",
  recruiterTrust = 70,
  targetRole = "this role",
  recruiterId = "friendly_hr",
}: LiveCopilotPanelProps) {
  const [open, setOpen] = useState(false);
  const [careerMemory, setCareerMemory] = useState<WorkZoCareerMemory>(() =>
   readCareerMemory(),
  );

  const answer = latestAnswer.trim();

  const signals = useMemo(() => {
    return {
      metric: hasMetric(answer),
      ownership: hasOwnership(answer),
      short: answer.length > 0 && answer.split(/\s+/).length < 35,
      vague: /\bhelped\b|\bworked on\b|\binvolved in\b|\bthings\b|\bstuff\b|\bvarious\b/i.test(answer),
    };
  }, [answer]);

  const recruiterIntent = useMemo(
    () =>
        getRecruiterIntentInsight({
        recruiterId,
        recruiterState: recruiterState as any,
        question,
        trust: recruiterTrust,
        }),
    [recruiterId, recruiterState, question, recruiterTrust],
  );

  const personaFollowUp = useMemo(
    () =>
        getRecruiterSpecificFollowUp({
        recruiterId,
        question,
        answer,
        }),
    [recruiterId, question, answer],
  );

  const emotionalInsights = useMemo(
    () =>
        analyzeEmotionalSignals({
        answer,
        recruiterTrust,
        recruiterState,
        }),
    [answer, recruiterTrust, recruiterState],
  );

  useEffect(() => {
    if (!answer || answer.split(/\s+/).length < 8) return;

    const timer = window.setTimeout(() => {
        setCareerMemory(updateCareerMemoryFromAnswer(answer));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [answer]);

  const rescueLine = useMemo(() => {
    if (!answer) return `Start with one specific example related to ${targetRole}.`;
    if (!signals.ownership) return "Add: “My specific responsibility was…”";
    if (!signals.metric) return "Add a measurable result: time saved, quality improved, tickets reduced, users helped, or process impact.";
    if (signals.short) return "Expand with Situation → Action → Result.";
    if (signals.vague) return "Replace vague wording with one concrete example.";
    return "Your answer has useful signal. Now connect it clearly to the target role.";
  }, [answer, signals, targetRole]);

  const trustTone =
    recruiterTrust < 50 || recruiterState === "skeptical" || recruiterState === "pressuring"
      ? "Recruiter may push back."
      : recruiterTrust > 75
        ? "Recruiter is engaged."
        : "Recruiter needs stronger proof.";

  return (
    <div className="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-[70] w-[min(360px,calc(100vw-32px))] md:bottom-6">
      {open ? (
        <section className="overflow-hidden rounded-[26px] border border-cyan-300/18 bg-[#06111f]/94 shadow-[0_24px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between border-b border-white/[0.06] px-4 py-3 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/12 text-cyan-200">
                <Brain className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black text-white">Live Copilot</p>
                <p className="text-xs font-semibold text-cyan-200">{trustTone}</p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400" />
          </button>

          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Lightbulb className="h-4 w-4" />
                Recruiter intent
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                <strong className="block text-white">{recruiterIntent.headline}</strong>
                <span className="mt-1 block">{recruiterIntent.hiddenEvaluation}</span>
                <span className="mt-2 block text-cyan-200">{recruiterIntent.coachingHint}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300/12 bg-amber-400/[0.06] p-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <ShieldAlert className="h-4 w-4" />
                Rescue hint
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{rescueLine}</p>
            </div>

            <div className="rounded-2xl border border-violet-300/12 bg-violet-400/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                    <Sparkles className="h-4 w-4" />
                    Career memory
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                    {getCareerMemoryCoachLine(careerMemory)}
                </p>
            </div>

            <div className="rounded-2xl border border-rose-300/12 bg-rose-400/[0.06] p-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                    <Sparkles className="h-4 w-4" />
                    Emotional coaching
                </div>

                <div className="mt-3 space-y-2">
                    {emotionalInsights.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-300">
                        Work-O-Bot is monitoring recruiter confidence and emotional signals.
                    </p>
                    ) : (
                    emotionalInsights.map((item) => (
                        <div
                        key={item.signal}
                        className="rounded-2xl border border-white/[0.06] bg-black/20 p-3"
                        >
                        <p className="text-sm font-black text-white">
                            {item.headline}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-400">
                            {item.explanation}
                        </p>

                        <p className="mt-2 text-xs font-semibold text-rose-200">
                            {item.coaching}
                        </p>
                        </div>
                    ))
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {[
                ["Metrics", signals.metric],
                ["Ownership", signals.ownership],
                ["Specific", !signals.vague],
                ["Enough detail", !signals.short],
              ].map(([label, ok]) => (
                <div
                  key={String(label)}
                  className={cn(
                    "rounded-2xl border px-3 py-2",
                    ok
                      ? "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200"
                      : "border-rose-300/15 bg-rose-400/[0.07] text-rose-200",
                  )}
                >
                  {ok ? "✓" : "!"} {label}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-black/18 p-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Likely follow-up
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                “{personaFollowUp}”
              </p>
            </div>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex h-14 items-center gap-3 rounded-full border border-cyan-300/20 bg-[#06111f]/92 px-4 text-sm font-black text-white shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition hover:scale-[1.02]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600">
            <Wand2 className="h-4 w-4" />
          </span>
          Work-O-Bot
          <ChevronUp className="h-4 w-4 text-cyan-200" />
        </button>
      )}
    </div>
  );
}