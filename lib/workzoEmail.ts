import "server-only";

// WorkZo transactional email via Resend.
//
// Required env vars:
//   RESEND_API_KEY    , from resend.com dashboard
//   WORKZO_EMAIL_FROM , defaults to "WorkZo AI <noreply@workzoai.com>"
//
// All emails are fire-and-forget in the webhook, errors are logged but
// never block the subscription activation flow.

const DEFAULT_FROM = "WorkZo AI <noreply@workzoai.com>";

// ── Shared design tokens ────────────────────────────────────────────────────
const COLOR = {
  bg: "#0f1117",
  card: "#16181f",
  border: "#ffffff14",
  primary: "#6366f1",       // indigo, main CTA
  primaryDark: "#4f46e5",
  text: "#f1f5f9",
  muted: "#94a3b8",
  success: "#10b981",
  pro: "#a78bfa",           // purple accent for Premium Pro
};

function emailShell(content: string, previewText: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>WorkZo AI</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body,html{margin:0;padding:0;background:${COLOR.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
img{border:0;display:block}
a{color:${COLOR.primary}}
</style>
</head>
<body style="background:${COLOR.bg};margin:0;padding:0">
<span style="display:none;max-height:0;overflow:hidden">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.bg};padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:32px">
    <span style="font-size:22px;font-weight:700;color:${COLOR.text};letter-spacing:-0.5px">WorkZo <span style="color:${COLOR.primary}">AI</span></span>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:16px;padding:40px 36px">
    ${content}
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding-top:28px">
    <p style="font-size:12px;color:${COLOR.muted};margin:0">WorkZo AI · workzoai.com</p>
    <p style="font-size:12px;color:${COLOR.muted};margin:6px 0 0">You received this email because you signed up for WorkZo AI.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(label: string, url: string, color = COLOR.primary) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">
<tr><td align="center" style="background:${color};border-radius:10px">
<a href="${url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${label}</a>
</td></tr>
</table>`;
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
<tr><td style="border-top:1px solid ${COLOR.border};font-size:0">&nbsp;</td></tr>
</table>`;
}

function featureRow(icon: string, text: string) {
  return `<tr>
<td width="28" valign="top" style="padding:5px 0;font-size:16px">${icon}</td>
<td style="padding:5px 0;font-size:14px;color:${COLOR.muted};line-height:1.5">${text}</td>
</tr>`;
}

// ── Email templates ─────────────────────────────────────────────────────────

function buildPremiumTemplate(input: { startUrl: string; manageUrl: string }) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${COLOR.text};line-height:1.2">Your Premium plan is active</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLOR.muted};line-height:1.6">Welcome to WorkZo AI. You now have full access to AI-powered interview practice, CV improvement, cover letters, and more.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1e2029;border-radius:10px;padding:20px 24px;margin-bottom:4px">
    <tr><td>
      <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:.08em;color:${COLOR.muted};text-transform:uppercase">What's included</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${featureRow("🎙️", "<strong style='color:${COLOR.text}'>300 AI voice minutes / month</strong> for realistic recruiter practice")}
        ${featureRow("📄", "CV improvement, ATS optimisation, and STAR bullet rewrites")}
        ${featureRow("✉️", "Personalised cover letter generator")}
        ${featureRow("🔍", "Job assist, matching, gap analysis, and application strategy")}
        ${featureRow("📊", "Advanced interview reports with trust score and coaching")}
      </table>
    </td></tr>
    </table>

    ${ctaButton("Start your first interview →", input.startUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:${COLOR.muted}">
      Need to manage your subscription?
      <a href="${input.manageUrl}" style="color:${COLOR.primary}">Billing settings →</a>
    </p>
  `;

  return emailShell(content, "Your Premium plan is ready, start practising now.");
}

function buildPremiumProTemplate(input: { startUrl: string; manageUrl: string }) {
  const content = `
    <div style="display:inline-block;background:#3b2f6e;border-radius:6px;padding:4px 12px;margin-bottom:20px">
      <span style="font-size:12px;font-weight:600;color:${COLOR.pro};letter-spacing:.06em;text-transform:uppercase">Premium Pro</span>
    </div>

    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${COLOR.text};line-height:1.2">You're on the full platform</h1>
    <p style="margin:0 0 24px;font-size:15px;color:${COLOR.muted};line-height:1.6">Everything in Premium, plus 600 AI voice minutes, 60 AI video minutes, career roadmaps, and your personal AI career coach.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1e2029;border-radius:10px;padding:20px 24px;margin-bottom:4px">
    <tr><td>
      <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:.08em;color:${COLOR.muted};text-transform:uppercase">What's included</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${featureRow("♾️", "<strong style='color:${COLOR.text}'>600 AI voice minutes/month</strong>")}
        ${featureRow("🎥", "60 min / month of <strong style='color:${COLOR.text}'>AI video interviews</strong>")}
        ${featureRow("🧠", "AI Career Coach, blockers, priorities, and hiring readiness")}
        ${featureRow("🗺️", "Career roadmaps: 30 / 60 / 90 day plans")}
        ${featureRow("🔁", "Replay intelligence, best/weakest answers, trust drops, rewrites")}
        ${featureRow("📄", "CV improvement, ATS, cover letters, job assist")}
      </table>
    </td></tr>
    </table>

    ${ctaButton("Start your first interview →", input.startUrl, COLOR.pro)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:${COLOR.muted}">
      Manage your subscription anytime in
      <a href="${input.manageUrl}" style="color:${COLOR.pro}">billing settings →</a>
    </p>
  `;

  return emailShell(content, "Your Premium Pro plan is active, the full career platform is ready.");
}

// ── Plain text fallbacks ────────────────────────────────────────────────────

function buildPlainText(input: { planLabel: string; startUrl: string; manageUrl: string }) {
  return `Your ${input.planLabel} plan is active, WorkZo AI

Welcome to WorkZo AI. Your ${input.planLabel} plan is ready.

Start your first interview: ${input.startUrl}
Manage billing: ${input.manageUrl}

WorkZo AI · workzoai.com
`.trim();
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function sendWorkZoTransactionalEmail(input: {
  to?: string | null;
  subject: string;
  html: string;
  text: string;
}) {
  const to = input.to?.trim();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WORKZO_EMAIL_FROM || DEFAULT_FROM;

  if (!to || !apiKey) {
    return { ok: false, skipped: true, reason: !to ? "missing_to" : "missing_resend_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email failed: ${response.status} ${detail}`);
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, skipped: false, id: data?.id };
}

export async function sendWorkZoPurchaseConfirmation(input: {
  to?: string | null;
  planLabel: string;
  plan?: string;
  manageUrl: string;
  startUrl: string;
}) {
  const isPro = input.plan === "premium_pro" || input.planLabel?.toLowerCase().includes("pro");

  const html = isPro
    ? buildPremiumProTemplate({ startUrl: input.startUrl, manageUrl: input.manageUrl })
    : buildPremiumTemplate({ startUrl: input.startUrl, manageUrl: input.manageUrl });

  return sendWorkZoTransactionalEmail({
    to: input.to,
    subject: `Your ${input.planLabel} plan is active, WorkZo AI`,
    html,
    text: buildPlainText({
      planLabel: input.planLabel,
      startUrl: input.startUrl,
      manageUrl: input.manageUrl,
    }),
  });
}
