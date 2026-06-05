"use client";

const PERSONAL_FOUNDER_PATTERNS = [
  /haritha/gi,
  /vijayakumar/gi,
  /harithavj/gi,
  /harithavj30@gmail\.com/gi,
];

function scrubFounderPersonalString(value: string) {
  return PERSONAL_FOUNDER_PATTERNS.reduce<string>(
    (current, pattern) => current.replace(pattern, "[removed]"),
    value,
  );
}

export function containsFounderPersonalDetails(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return PERSONAL_FOUNDER_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function scrubFounderPersonalDetails<T>(value: T): T {
  if (typeof value === "string") return scrubFounderPersonalString(value) as T;

  if (Array.isArray(value)) {
    return value.map((item) => scrubFounderPersonalDetails(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        scrubFounderPersonalDetails(item),
      ]),
    ) as T;
  }

  return value;
}

export function assertNoFounderPersonalDetails(value: unknown, label = "payload") {
  if (containsFounderPersonalDetails(value)) {
    throw new Error(`Founder personal detail detected in ${label}. Remove it before saving.`);
  }
}

export function clearDirtyLegacyWorkZoStorage() {
  if (typeof window === "undefined") return;

  const keys = [
    "workzo_interview_setup",
    "workzoInterviewSetup",
    "workzo_active_interview",
    "workzo_interview_snapshot",
    "workzo_latest_result",
    "workzo_results",
  ];

  try {
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value && containsFounderPersonalDetails(value)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}
