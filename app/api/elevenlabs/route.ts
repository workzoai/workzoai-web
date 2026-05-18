import { NextRequest, NextResponse } from "next/server";

type RecruiterId =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate";

const DEFAULT_VOICE_IDS: Record<RecruiterId, string> = {
  friendly_hr: "EXAVITQu4vr4xnSDxMaL",
  startup_recruiter: "EXAVITQu4vr4xnSDxMaL",
  german_corporate: "VR6AewLTigWG4xSOukaG",
  analytical_hiring_manager: "VR6AewLTigWG4xSOukaG",
};

function getVoiceId(recruiterId: RecruiterId) {
  if (recruiterId === "friendly_hr") {
    return process.env.ELEVENLABS_VOICE_SARAH || DEFAULT_VOICE_IDS.friendly_hr;
  }

  if (recruiterId === "startup_recruiter") {
    return process.env.ELEVENLABS_VOICE_PRIYA || DEFAULT_VOICE_IDS.startup_recruiter;
  }

  if (recruiterId === "german_corporate") {
    return process.env.ELEVENLABS_VOICE_MARKUS || DEFAULT_VOICE_IDS.german_corporate;
  }

  return process.env.ELEVENLABS_VOICE_DANIEL || DEFAULT_VOICE_IDS.analytical_hiring_manager;
}

function normalizeRecruiterId(value: unknown): RecruiterId {
  if (value === "friendly_hr") return "friendly_hr";
  if (value === "startup_recruiter") return "startup_recruiter";
  if (value === "german_corporate") return "german_corporate";
  if (value === "analytical_hiring_manager") return "analytical_hiring_manager";
  return "startup_recruiter";
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY in .env.local" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      recruiterId?: unknown;
      text?: unknown;
    };

    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const recruiterId = normalizeRecruiterId(body.recruiterId);
    const voiceId = getVoiceId(recruiterId);
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.44,
            similarity_boost: 0.82,
            style: 0.28,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "ElevenLabs request failed", details },
        { status: response.status },
      );
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ElevenLabs voice route crashed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
