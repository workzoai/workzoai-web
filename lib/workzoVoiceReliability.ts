// lib/workzoVoiceReliability.ts

export type VoiceFailureKind =
  | "microphone_blocked"
  | "audio_worklet_failed"
  | "connection_interrupted"
  | "assistant_unavailable"
  | "network_or_room_lookup_timeout"
  | "unknown";

function stringifyVoiceError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error || "");
  } catch {
    return "";
  }
}

export function classifyVoiceError(error: unknown): VoiceFailureKind {
  const message = stringifyVoiceError(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("notallowederror") ||
    lower.includes("permission denied") ||
    lower.includes("microphone") ||
    lower.includes("getusermedia")
  ) {
    return "microphone_blocked";
  }

  if (
    lower.includes("audioworkletnode") ||
    lower.includes("wasm_or_worker_not_ready") ||
    lower.includes("krisp") ||
    lower.includes("mic processor")
  ) {
    return "audio_worklet_failed";
  }

  if (
    lower.includes("room lookup took") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("network")
  ) {
    return "network_or_room_lookup_timeout";
  }

  if (
    lower.includes("meeting has ended") ||
    lower.includes("signaling connection interrupted") ||
    lower.includes("disconnect") ||
    lower.includes("ejection") ||
    lower.includes("transport changed to disconnected")
  ) {
    return "connection_interrupted";
  }

  if (
    lower.includes("assistant") ||
    lower.includes("assistant id") ||
    lower.includes("public key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("404")
  ) {
    return "assistant_unavailable";
  }

  return "unknown";
}

export function getVoiceFailureMessage(kind: VoiceFailureKind) {
  switch (kind) {
    case "microphone_blocked":
      return "Microphone access is blocked. Allow microphone access in the browser and reload the deployed HTTPS site.";
    case "audio_worklet_failed":
      return "Browser audio processing failed. This is often a AI voice/Krisp browser processor warning; retry once in Chrome without extensions.";
    case "connection_interrupted":
      return "AI voice disconnected before the interview started. Check the assistant model/voice provider, assistant status, and network stability.";
    case "assistant_unavailable":
      return "AI voice assistant is unavailable. Check NEXT_PUBLIC_VAPI_PUBLIC_KEY, the selected assistant ID, and that the assistant is saved/published in AI voice.";
    case "network_or_room_lookup_timeout":
      return "AI voice room lookup is taking too long. Test on the deployed HTTPS domain and verify the AI voice realtime model/voice configuration.";
    default:
      return "Standard voice could not start. Open the browser console and check the WorkZo AI voice start debug log.";
  }
}

export async function requestMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone is not available in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());

  return true;
}
