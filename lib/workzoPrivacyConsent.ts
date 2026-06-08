export type WorkZoCookieConsentChoice = "accepted" | "rejected" | "custom";

export type WorkZoCookieConsent = {
  choice: WorkZoCookieConsentChoice;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export const WORKZO_COOKIE_CONSENT_KEY = "workzo_cookie_consent";

export function readWorkZoCookieConsent(): WorkZoCookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(WORKZO_COOKIE_CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkZoCookieConsent>;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      choice: parsed.choice === "accepted" || parsed.choice === "custom" || parsed.choice === "rejected" ? parsed.choice : "rejected",
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveWorkZoCookieConsent(input: {
  choice: WorkZoCookieConsentChoice;
  analytics?: boolean;
  marketing?: boolean;
}) {
  if (typeof window === "undefined") return null;

  const next: WorkZoCookieConsent = {
    choice: input.choice,
    necessary: true,
    analytics: input.choice === "accepted" ? true : Boolean(input.analytics),
    marketing: input.choice === "accepted" ? true : Boolean(input.marketing),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(WORKZO_COOKIE_CONSENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("workzo-cookie-consent-updated", { detail: next }));
  } catch {
    // Ignore blocked storage. The app should remain usable.
  }

  return next;
}

export function clearWorkZoCookieConsent() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(WORKZO_COOKIE_CONSENT_KEY);
    window.dispatchEvent(new CustomEvent("workzo-cookie-consent-updated"));
  } catch {
    // Ignore blocked storage.
  }
}

export function hasWorkZoAnalyticsConsent() {
  return readWorkZoCookieConsent()?.analytics === true;
}

export function hasWorkZoMarketingConsent() {
  return readWorkZoCookieConsent()?.marketing === true;
}
