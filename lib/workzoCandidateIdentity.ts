"use client";

import {
  readLatestInterviewSetup,
  saveLatestInterviewSetup,
  type WorkZoInterviewSetup,
} from "@/lib/workzoInterviewSetup";

export type WorkZoCandidateIdentity = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
};

const IDENTITY_KEY = "workzo_candidate_identity";

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isGenericName(value = "") {
  const name = clean(value);
  if (!name) return true;
  if (/^(candidate|user|workzo user|there)$/i.test(name)) return true;
  // GLOBAL FIX: structural role/section grammar instead of an enumerated
  // skills blocklist. The old list missed headline fragments like
  // "Junior Data" / "Junior Data Scientist", which were then persisted in
  // localStorage as a "valid" identity and resurfaced in later interviews
  // even after the CV parsed correctly.
  return /\b(junior|senior|lead|head|chief|principal|staff|intern|trainee|graduate|engineer|developer|scientist|analyst|manager|specialist|consultant|designer|architect|recruiter|director|assistant|associate|officer|coordinator|administrator|technician|resume|cv|profile|summary|contact|skills?|experience|education|projects?|languages?|certifications?|bachelor|master|degree|bootcamp|university|college|school|data|science|support|technical|professional|public\s+relations|project\s+management|communication|leadership|teamwork|time\s+management|critical\s+thinking)\b/i.test(name);
}

function readStoredIdentity(): WorkZoCandidateIdentity | null {
  if (typeof window === "undefined") return null;

  const raw =
    window.sessionStorage.getItem(IDENTITY_KEY) ||
    window.localStorage.getItem(IDENTITY_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.name || isGenericName(parsed.name)) return null;

    return {
      name: clean(parsed.name),
      headline: clean(parsed.headline) || "Professional",
      email: clean(parsed.email),
      phone: clean(parsed.phone),
      location: clean(parsed.location),
      linkedin: clean(parsed.linkedin),
    };
  } catch {
    return null;
  }
}

export function extractCandidateIdentity(setup?: WorkZoInterviewSetup | null): WorkZoCandidateIdentity {
  const source = setup || readLatestInterviewSetup();
  const profile = source?.resumeProfile || {};
  const basics = profile?.basics || {};

  const rawName =
    clean(basics.name) ||
    clean(source?.candidateName) ||
    clean(source?.name) ||
    "";

  const name = isGenericName(rawName) ? "" : rawName;

  const headline =
    clean(basics.headline) ||
    clean(source?.candidateHeadline) ||
    clean(source?.targetRole) ||
    clean(source?.role) ||
    "Professional";

  return {
    name,
    headline,
    email: clean(basics.email || source?.candidateEmail),
    phone: clean(basics.phone || source?.candidatePhone),
    location: clean(basics.location || source?.candidateLocation),
    linkedin: clean(basics.linkedin || source?.candidateLinkedin),
  };
}

export function saveCandidateIdentity(identity: Partial<WorkZoCandidateIdentity>) {
  if (typeof window === "undefined") return;

  const payload: WorkZoCandidateIdentity = {
    name: isGenericName(clean(identity.name)) ? "" : clean(identity.name),
    headline: clean(identity.headline) || "Professional",
    email: clean(identity.email),
    phone: clean(identity.phone),
    location: clean(identity.location),
    linkedin: clean(identity.linkedin),
  };

  window.sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(payload));
  window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(payload));
}

export function readCandidateIdentity(): WorkZoCandidateIdentity {
  const setup = readLatestInterviewSetup();
  const fromSetup = extractCandidateIdentity(setup);

  if (!isGenericName(fromSetup.name)) {
    saveCandidateIdentity(fromSetup);
    return fromSetup;
  }

  const stored = readStoredIdentity();
  if (stored) return stored;

  return fromSetup;
}

export function syncCandidateIdentityFromSetup(setup?: WorkZoInterviewSetup | null) {
  const current = setup || readLatestInterviewSetup();
  const identity = extractCandidateIdentity(current);

  if (!isGenericName(identity.name)) {
    saveCandidateIdentity(identity);

    if (current) {
      saveLatestInterviewSetup({
        ...current,
        candidateName: identity.name,
        candidateHeadline: identity.headline,
        candidateEmail: identity.email,
        candidatePhone: identity.phone,
        candidateLocation: identity.location,
        candidateLinkedin: identity.linkedin,
      });
    }
  }

  return identity;
}
