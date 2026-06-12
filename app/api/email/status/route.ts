import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY);
  const hasFromAddress = Boolean(process.env.WORKZO_EMAIL_FROM);
  return NextResponse.json({
    ok: hasResendApiKey && hasFromAddress,
    hasResendApiKey,
    hasFromAddress,
    from: hasFromAddress ? process.env.WORKZO_EMAIL_FROM : null,
    message: hasResendApiKey && hasFromAddress
      ? "Transactional email is configured."
      : "Set RESEND_API_KEY and WORKZO_EMAIL_FROM in Vercel/production environment variables.",
  });
}
