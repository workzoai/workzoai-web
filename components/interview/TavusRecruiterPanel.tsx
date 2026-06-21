"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clock3, Loader2, PhoneOff, Video } from "lucide-react";

type TavusRecruiterPanelProps = {
  recruiterName?: string;
  recruiterTrust?: number;
  pressure?: number;
  onUnavailable?: () => void;
  onStarted?: () => void;
  onEnded?: () => void;
};

type SessionState = "idle" | "starting" | "live" | "ending" | "ended" | "unavailable";

const MAX_SESSION_SECONDS = 10 * 60;
const INACTIVITY_SECONDS = 2 * 60;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function TavusRecruiterPanel({
  recruiterName = "Recruiter",
  recruiterTrust = 50,
  pressure = 50,
  onUnavailable,
  onStarted,
  onEnded,
}: TavusRecruiterPanelProps) {
  const [conversationUrl, setConversationUrl] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [status, setStatus] = useState<SessionState>("idle");
  const [message, setMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inactiveSeconds, setInactiveSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestConversationIdRef = useRef("");

  const remainingSeconds = Math.max(0, MAX_SESSION_SECONDS - elapsedSeconds);
  const inactiveRemainingSeconds = Math.max(0, INACTIVITY_SECONDS - inactiveSeconds);

  const warning = useMemo(() => {
    if (status !== "live") return "";
    if (remainingSeconds <= 60) return "Video session will auto-end soon.";
    if (inactiveRemainingSeconds <= 30) return "No activity detected. Video session will auto-end soon.";
    return "";
  }, [inactiveRemainingSeconds, remainingSeconds, status]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (inactivityRef.current) clearInterval(inactivityRef.current);
    timerRef.current = null;
    inactivityRef.current = null;
  }, []);

  const resetInactivity = useCallback(() => setInactiveSeconds(0), []);

  const endVideoInterview = useCallback(
    async (reason = "manual") => {
      const id = latestConversationIdRef.current || conversationId;
      clearTimers();

      if (!id) {
        setConversationUrl("");
        setConversationId("");
        latestConversationIdRef.current = "";
        setStatus("ended");
        onEnded?.();
        return;
      }

      setStatus("ending");

      try {
        await fetch("/api/tavus/conversation", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, reason }),
        });
      } catch {
        // Keep the UI safe even if remote session ending fails.
      } finally {
        setConversationUrl("");
        setConversationId("");
        latestConversationIdRef.current = "";
        setStatus("ended");
        onEnded?.();
      }
    },
    [clearTimers, conversationId, onEnded]
  );

  const startTimers = useCallback(() => {
    clearTimers();
    setElapsedSeconds(0);
    setInactiveSeconds(0);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    inactivityRef.current = setInterval(() => {
      setInactiveSeconds((value) => value + 1);
    }, 1000);
  }, [clearTimers]);

  useEffect(() => {
    if (status !== "live") return;
    if (elapsedSeconds >= MAX_SESSION_SECONDS) void endVideoInterview("max_session_time");
  }, [elapsedSeconds, endVideoInterview, status]);

  useEffect(() => {
    if (status !== "live") return;
    if (inactiveSeconds >= INACTIVITY_SECONDS) void endVideoInterview("inactive_timeout");
  }, [endVideoInterview, inactiveSeconds, status]);

  useEffect(() => {
    if (status !== "live") return;

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "click"];
    for (const event of events) window.addEventListener(event, resetInactivity, { passive: true });

    return () => {
      for (const event of events) window.removeEventListener(event, resetInactivity);
    };
  }, [resetInactivity, status]);

  useEffect(() => {
    return () => {
      clearTimers();

      if (latestConversationIdRef.current) {
        void fetch("/api/tavus/conversation", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: latestConversationIdRef.current,
            reason: "component_unmount",
          }),
        });
      }
    };
  }, [clearTimers]);

  async function startVideoInterview() {
    setStatus("starting");
    setMessage("");

    try {
      const response = await fetch("/api/tavus/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterName, recruiterTrust, pressure }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Live video is unavailable right now.");
      }

      const url =
        data?.conversationUrl ||
        data?.conversation_url ||
        data?.daily_room_url ||
        data?.dailyRoomUrl ||
        data?.raw?.conversation_url ||
        data?.raw?.daily_room_url ||
        data?.raw?.url ||
        "";

      const id =
        data?.conversationId ||
        data?.conversation_id ||
        data?.raw?.conversation_id ||
        data?.raw?.id ||
        "";

      if (!url) throw new Error("Live video is unavailable right now.");

      setConversationUrl(url);
      setConversationId(id);
      latestConversationIdRef.current = id;
      setStatus("live");
      startTimers();
      onStarted?.();
    } catch (error) {
      setConversationUrl("");
      setConversationId("");
      latestConversationIdRef.current = "";
      setStatus("unavailable");
      setMessage(error instanceof Error ? error.message : "Live video is unavailable right now.");
      onUnavailable?.();
    }
  }

  if (conversationUrl && status === "live") {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          src={conversationUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          className="absolute inset-0 h-full w-full border-0 bg-black"
          title={`${recruiterName} live video recruiter`}
        />

        <div className="pointer-events-none absolute left-4 top-4 z-[80] rounded-lg border border-white/10 bg-slate-950/72 px-3 py-2 text-xs font-black text-white backdrop-blur-xl">
          Live video · {formatTime(elapsedSeconds)} / {formatTime(MAX_SESSION_SECONDS)}
        </div>

        <button
          type="button"
          onClick={() => void endVideoInterview("manual_end")}
          className="absolute right-4 top-4 z-[90] inline-flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-xs font-black text-white shadow-[0_16px_38px_rgba(244,63,94,.24)] transition hover:bg-red-500"
        >
          <PhoneOff className="h-4 w-4" />
          End Live Video
        </button>

        {warning && (
          <div className="absolute inset-x-4 bottom-20 z-[90] mx-auto max-w-lg rounded-lg border border-amber-300/20 bg-amber-500/14 p-3 text-center text-xs font-bold leading-5 text-amber-100 backdrop-blur-xl">
            {warning}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <div className="pointer-events-auto mx-4 w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.06] p-5 text-center shadow-[0_24px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-cyan-400/12 text-cyan-100">
          <Video className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-xl font-black text-white">
          {status === "unavailable"
            ? "Live video is unavailable"
            : status === "ended"
              ? "Live video ended"
              : "Start live video interview"}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {status === "unavailable"
            ? "Switch to Standard and continue the interview."
            : "This starts the live video recruiter call. You can switch to Standard anytime."}
        </p>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">
          <div className="flex items-center justify-center gap-2 font-black text-cyan-100">
            <Clock3 className="h-4 w-4" />
            Auto-end after {Math.round(MAX_SESSION_SECONDS / 60)} minutes
          </div>
          <p className="mt-1 text-slate-400">
            Also ends after {Math.round(INACTIVITY_SECONDS / 60)} minutes of inactivity.
          </p>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            <div className="mb-1 flex items-center justify-center gap-2 font-black">
              <AlertTriangle className="h-4 w-4" />
              Notice
            </div>
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={startVideoInterview}
          disabled={status === "starting" || status === "ending"}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-black text-white shadow-[0_0_30px_rgba(34,211,238,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "starting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting call...
            </>
          ) : status === "ending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Ending...
            </>
          ) : (
            "Start Live Video Call"
          )}
        </button>
      </div>
    </div>
  );
}
