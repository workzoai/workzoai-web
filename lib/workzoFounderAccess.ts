const FOUNDER_DEV_EMAIL_ENV_KEYS = [
  "WORKZO_FOUNDER_DEV_EMAILS",
  "WORKZO_DEV_TESTER_EMAILS",
] as const;

function parseFounderDevEmails(): string[] {
  const values = FOUNDER_DEV_EMAIL_ENV_KEYS
    .map((key) => process.env[key])
    .filter(Boolean)
    .join(",");

  return values
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function getWorkZoFounderDevEmails() {
  return parseFounderDevEmails();
}

export function isWorkZoFounderDevEmail(email?: string | null) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return parseFounderDevEmails().includes(normalized);
}

export const WORKZO_FOUNDER_DEV_LIMITS = {
  interviewsRemaining: 999999,
  interviewLimit: 999999,
  voiceMinutesRemaining: 999999,
  voiceMinutesLimit: 999999,
  videoMinutesRemaining: 999999,
  videoMinutesLimit: 999999,
};
