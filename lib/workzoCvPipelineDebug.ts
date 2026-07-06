type CvProfileLike = {
  basics?: {
    name?: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  summary?: string;
  experience?: unknown[];
  education?: unknown[];
  projects?: unknown[];
  skills?: unknown[];
  languages?: unknown[];
};

const ENABLE_CV_DEBUG =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_WORKZO_CV_DEBUG === "true";

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[redacted-phone]")
    .replace(/\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+/gi, "[redacted-linkedin]")
    .replace(/\b\d{5}\b[^\n,]*(?:,\s*)?[^\n]*/g, "[redacted-address]");
}

function safePreview(value: unknown, max = 400) {
  try {
    const text =
      typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);

    if (!text) return "";
    const redacted = redactSensitiveText(text);
    return redacted.length > max ? `${redacted.slice(0, max)}...` : redacted;
  } catch {
    return "[unserializable]";
  }
}

function safeBasics(profile?: CvProfileLike | null) {
  const basics = profile?.basics || {};
  return {
    hasName: Boolean(basics.name),
    headline: basics.headline || "",
    hasEmail: Boolean(basics.email),
    hasPhone: Boolean(basics.phone),
    hasLocation: Boolean(basics.location),
    hasLinkedIn: Boolean(basics.linkedin),
  };
}

export function debugCvPipeline(label: string, data?: unknown) {
  if (!ENABLE_CV_DEBUG) return;

  const tag = `%c[WorkZo CV Pipeline] ${label}`;
  const style = "color:#38bdf8;font-weight:700";

  if (typeof window === "undefined") {
    console.log(`[WorkZo CV Pipeline] ${label}`, data);
    return;
  }

  console.groupCollapsed(tag, style);
  console.log(data);
  console.groupEnd();
}

export function debugCvText(
  label: string,
  text?: string,
  extra?: Record<string, unknown>,
) {
  if (!ENABLE_CV_DEBUG) return;

  const value = text || "";
  debugCvPipeline(label, {
    ...(extra || {}),
    chars: value.length,
    lines: value.split(/\n+/).filter(Boolean).length,
    preview: safePreview(value),
  });
}

export function debugCvProfile(
  label: string,
  profile?: unknown,
  extra?: Record<string, unknown>,
) {
  if (!ENABLE_CV_DEBUG) return;

  const safeProfile = profile as CvProfileLike | null | undefined;

  if (!safeProfile || typeof safeProfile !== "object") {
    debugCvPipeline(label, {
      ...(extra || {}),
      profile: safeProfile || null,
    });
    return;
  }

  debugCvPipeline(label, {
    ...(extra || {}),
    basics: safeBasics(safeProfile),
    summaryPreview: safePreview(safeProfile.summary || "", 400),
    counts: {
      experience: Array.isArray(safeProfile.experience) ? safeProfile.experience.length : 0,
      education: Array.isArray(safeProfile.education) ? safeProfile.education.length : 0,
      projects: Array.isArray(safeProfile.projects) ? safeProfile.projects.length : 0,
      skills: Array.isArray(safeProfile.skills) ? safeProfile.skills.length : 0,
      languages: Array.isArray(safeProfile.languages) ? safeProfile.languages.length : 0,
    },
    sample: {
      experience: Array.isArray(safeProfile.experience) ? safeProfile.experience.slice(0, 2) : [],
      education: Array.isArray(safeProfile.education) ? safeProfile.education.slice(0, 2) : [],
      projects: Array.isArray(safeProfile.projects) ? safeProfile.projects.slice(0, 2) : [],
      skills: Array.isArray(safeProfile.skills) ? safeProfile.skills.slice(0, 12) : [],
      languages: Array.isArray(safeProfile.languages) ? safeProfile.languages.slice(0, 6) : [],
    },
  });
}