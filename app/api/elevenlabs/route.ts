import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ElevenLabs is used for premium voice quality.
// Free users fall back to browser TTS — they never hit this route.
// Premium and Premium Pro both get ElevenLabs access.

type RecruiterId =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter"; // was "german_corporate" — now matches recruiterAssets.ts

const DEFAULT_VOICE_IDS: Record<RecruiterId, string> = {
  friendly_hr: "EXAVITQu4vr4xnSDxMaL",
  startup_recruiter: "EXAVITQu4vr4xnSDxMaL",
  corporate_recruiter: "VR6AewLTigWG4xSOukaG",
  analytical_hiring_manager: "VR6AewLTigWG4xSOukaG",
};

function getVoiceId(recruiterId: RecruiterId) {
  if (recruiterId === "friendly_hr") {
    return process.env.ELEVENLABS_VOICE_SARAH || DEFAULT_VOICE_IDS.friendly_hr;
  }
  if (recruiterId === "startup_recruiter") {
    return process.env.ELEVENLABS_VOICE_PRIYA || DEFAULT_VOICE_IDS.startup_recruiter;
  }
  if (recruiterId === "corporate_recruiter") {
    return process.env.ELEVENLABS_VOICE_MARKUS || DEFAULT_VOICE_IDS.corporate_recruiter;
  }
  return process.env.ELEVENLABS_VOICE_DANIEL || DEFAULT_VOICE_IDS.analytical_hiring_manager;
}

function normalizeRecruiterId(value: unknown): RecruiterId {
  if (value === "friendly_hr") return "friendly_hr";
  if (value === "startup_recruiter") return "startup_recruiter";
  // Accept both old "german_corporate" key and canonical "corporate_recruiter"
  if (value === "corporate_recruiter" || value === "german_corporate") return "corporate_recruiter";
  if (value === "analytical_hiring_manager") return "analytical_hiring_manager";
  return "startup_recruiter";
}

export async function POST(request: NextRequest) {
  // ── Auth + plan gate ────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }

  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ElevenLabs is premium voice — free users use browser TTS instead.
  if (resolved.plan === "free") {
    return NextResponse.json(
      { error: "upgrade_required", requiredPlan: "premium", message: "Premium voice requires an upgrade." },
      { status: 403 },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

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
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

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
