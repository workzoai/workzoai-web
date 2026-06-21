type Interruption = {
  shouldInterrupt: boolean;
  interruptionMessage: string;
  severity: "low" | "medium" | "high";
};

type RecruiterProfile = {
  id: string;
  name: string;
  title: string;
  avatar: string;
  tone: string;
  questionStyle: string;
  pressureBias: number;
  interruptionBias: number;
  feedbackStyle: string;
};

type RecruiterCardProps = {
  recruiterProfile?: RecruiterProfile | null;
  recruiterPersonality: string;
  companyStyle: string;
  emotionState: string;
  pressureLevel: number;
  currentQuestion: string;
  interruption?: Interruption | null;
  voiceState?: "idle" | "starting" | "listening" | "speaking" | "muted";
};

function getAvatar(emotion: string, companyStyle: string) {
  if (emotion === "impressed") return "😊";
  if (emotion === "skeptical") return "🤨";
  if (emotion === "concerned") return "😐";
  if (emotion === "pressuring") return "🧐";

  if (companyStyle.toLowerCase().includes("startup")) return "👩‍💻";
  if (companyStyle.toLowerCase().includes("corporate")) return "👩🏻‍💼";
  if (companyStyle.toLowerCase().includes("technical")) return "👨‍💻";

  return "👩🏻‍💼";
}

function getSeverityStyle(severity?: string) {
  if (severity === "high") {
    return "border-red-400/30 bg-red-500/15 text-red-100";
  }

  if (severity === "medium") {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }

  return "border-blue-400/30 bg-blue-500/15 text-blue-100";
}

export default function RecruiterCard({
  recruiterProfile,
  recruiterPersonality,
  companyStyle,
  emotionState,
  pressureLevel,
  currentQuestion,
  interruption,
  voiceState = "idle",
}: RecruiterCardProps) {
  const avatar =
    recruiterProfile?.avatar || getAvatar(emotionState, companyStyle);

  const isInterrupting =
    Boolean(interruption?.shouldInterrupt) &&
    Boolean(interruption?.interruptionMessage);

  return (
    <div className="rounded-[32px] border border-white/10 bg-[#0b1220] p-6">
      {isInterrupting && (
        <div
          className={`mb-5 rounded-xl border px-5 py-4 ${getSeverityStyle(
            interruption?.severity
          )}`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚡</div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">
                Recruiter interruption · {interruption?.severity}
              </p>

              <p className="mt-2 text-lg font-semibold leading-7">
                “{interruption?.interruptionMessage}”
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="aspect-video overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a]">
        <div className="flex h-full flex-col items-center justify-center p-6">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-7xl shadow-2xl shadow-blue-500/10">
            {avatar}

            <span
              className={`absolute -right-2 top-8 h-5 w-5 rounded-full shadow-lg ${
                voiceState === "speaking"
                  ? "animate-pulse bg-cyan-400 shadow-cyan-400/40"
                  : voiceState === "listening"
                    ? "animate-pulse bg-green-400 shadow-green-400/40"
                    : "bg-slate-500"
              }`}
            />
          </div>

          <h2 className="mt-6 text-3xl font-semibold">
            {recruiterProfile?.name || "AI Recruiter"}
          </h2>

          <p className="mt-3 text-slate-400">
            {recruiterProfile?.title || recruiterPersonality}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
              Emotion: {emotionState || "neutral"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
              Pressure: {pressureLevel || 0}%
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
              Style: {companyStyle || "Realistic"}
            </span>

            {recruiterProfile?.tone && (
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-200">
                Tone: {recruiterProfile.tone}
              </span>
            )}
          </div>

          <div className="mt-5 max-w-2xl rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center text-lg leading-8 text-slate-200">
            {isInterrupting
              ? interruption?.interruptionMessage
              : currentQuestion ||
                "Tell me about yourself and keep it relevant to the role."}
          </div>
        </div>
      </div>
    </div>
  );
}