export function safeClientTime() {
  if (typeof window === "undefined") return "--:--";

  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.max(0, Math.min(100, Math.round(number)));
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocalStorage<T>(key: string, fallback: T): T {
  if (!hasBrowserStorage()) return fallback;

  return safeJsonParse<T>(window.localStorage.getItem(key), fallback);
}

export function writeLocalStorage(key: string, value: unknown) {
  if (!hasBrowserStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore blocked storage.
  }
}
