const ELEVENLABS_API_KEY =
  process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "";

const ELEVENLABS_MODEL = "eleven_turbo_v2_5";

const VOICE_MAP: Record<string, string> = {
  friendly_hr: "Sarah",
  startup_recruiter: "Sarah",
  corporate_recruiter: "Brian",
  analytical_hiring_manager: "Brian",
};

export async function speakWithElevenLabs(
  recruiterId: string,
  text: string,
) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("Missing ElevenLabs API key");
  }

  const voiceId =
    recruiterId === "friendly_hr"
      ? "EXAVITQu4vr4xnSDxMaL"
      : recruiterId === "startup_recruiter"
        ? "EXAVITQu4vr4xnSDxMaL"
        : recruiterId === "corporate_recruiter"
          ? "VR6AewLTigWG4xSOukaG"
          : "VR6AewLTigWG4xSOukaG";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.78,
          style: 0.28,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("ElevenLabs request failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve) => {
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };

    audio.play();
  });
}