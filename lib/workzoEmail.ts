import "server-only";

export async function sendWorkZoTransactionalEmail(input: { to?: string | null; subject: string; html: string; text: string }) {
  const to = input.to?.trim();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WORKZO_EMAIL_FROM || "WorkZo AI <hello@workzoai.com>";
  if (!to || !apiKey) return { ok: false, skipped: true, reason: !to ? "missing_to" : "missing_resend_api_key" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: input.subject, html: input.html, text: input.text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email failed: ${response.status} ${detail}`);
  }
  return { ok: true, skipped: false };
}

export async function sendWorkZoPurchaseConfirmation(input: { to?: string | null; planLabel: string; manageUrl: string; startUrl: string }) {
  return sendWorkZoTransactionalEmail({
    to: input.to,
    subject: `Your ${input.planLabel} plan is active`,
    text: `Welcome to WorkZo AI. Your ${input.planLabel} plan is active. Start your first interview: ${input.startUrl}. Manage billing: ${input.manageUrl}.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h1>Your ${input.planLabel} plan is active</h1><p>Welcome to WorkZo AI. Your plan is ready.</p><ul><li>Start a realistic AI interview</li><li>Review your feedback report</li><li>Use CV, Cover Letter, and Job Assist tools if included in your plan</li></ul><p><a href="${input.startUrl}">Start your first interview</a></p><p><a href="${input.manageUrl}">Manage billing</a></p></div>`,
  });
}
