import { getRecruiterVoiceGender, ELEVEN_DEFAULT_BY_GENDER } from "@/lib/recruiterVoiceConfig";

const ELEVENLABS_API_KEY =
  process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "";

const ELEVENLABS_MODEL = "eleven_turbo_v2_5";

export async function speakWithElevenLabs(
  recruiterId: string,
  text: string,
) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("Missing ElevenLabs API key");
  }

  const gender = getRecruiterVoiceGender(recruiterId);
  const voiceId = ELEVEN_DEFAULT_BY_GENDER[gender];

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