import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { resolveRecruiterVoiceKey, RECRUITER_VOICE_TABLE, ELEVEN_DEFAULT_BY_GENDER } from "@/lib/recruiterVoiceConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ElevenLabs is used for premium voice quality.
// Free users fall back to browser TTS — they never hit this route.
// Premium and Premium Pro both get ElevenLabs access.

function getVoiceId(recruiterId: string) {
  const key = resolveRecruiterVoiceKey(recruiterId);
  const entry = RECRUITER_VOICE_TABLE[key];
  return process.env[entry.elevenEnv] || ELEVEN_DEFAULT_BY_GENDER[entry.gender];
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

    const recruiterId = typeof body.recruiterId === "string" ? body.recruiterId : "";
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
