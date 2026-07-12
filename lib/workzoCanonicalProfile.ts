import { extractResumeProfileComplex, type ResumeProfile } from "./workzoResumeParser";
import { recoverNameFromRawText } from "./workzoProfileIntegrityGuard";
import { determineCanonicalIdentity, healSpacedHeaders, resolveTargetHeadline } from "./workzoCvIdentityEngine";

/**
 * CV ENGINE VERSION, and why it matters.
 *
 * A parsed profile is cached in localStorage and previously read back verbatim,
 * so a profile parsed by an OLD build was served forever. Every parser fix
 * (languages, de-duplication, name recovery) was silently bypassed for anyone
 * who had already uploaded a CV: the app kept replaying the stale parse.
 *
 * BUMP THIS STRING whenever the parsing pipeline changes. Any cached profile
 * stamped with a different version is discarded and rebuilt with the current
 * parser, so fixes actually reach existing users instead of only new ones.
 */
export const WORKZO_CV_ENGINE_VERSION = "cv-engine-v6.0-segmenter-role-company-shape-mononym-preamble-guard";

export type WorkZoCanonicalProfile = ResumeProfile & {
  canonicalVersion?: string;
  identityConfidence?: number;
  identityNeedsConfirmation?: boolean;
  selectedNameSource?: string;
  fileName?: string;
  updatedAt?: string;
};

const CANONICAL_PROFILE_STORAGE_KEY = "workzo.canonicalCvProfile.v3";
const SHARED_SOURCE_STORAGE_KEY = "workzo_cv_source";
const INTERVIEW_LANGUAGE_STORAGE_KEY = "workzo.interviewLanguage.locked";

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function storageTargets(): Storage[] {
  if (!canUseBrowserStorage()) return [];
  const targets: Storage[] = [];
  try { if (window.localStorage) targets.push(window.localStorage); } catch {}
  try { if (window.sessionStorage) targets.push(window.sessionStorage); } catch {}
  return targets;
}

function safeSet(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch {}
}

function safeGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeRemove(storage: Storage, key: string): void {
  try { storage.removeItem(key); } catch {}
}

function emailOf(profile: any): string {
  return typeof profile?.basics?.email === "string"
    ? profile.basics.email
    : typeof profile?.email === "string"
      ? profile.email
      : "";
}

function normalizedBasics(profile: any, name: string, headline: string): ResumeProfile["basics"] {
  const basics = profile?.basics && typeof profile.basics === "object" ? profile.basics : {};
  return {
    name,
    headline,
    email: typeof basics.email === "string" ? basics.email : typeof profile?.email === "string" ? profile.email : "",
    phone: typeof basics.phone === "string" ? basics.phone : typeof profile?.phone === "string" ? profile.phone : "",
    location: typeof basics.location === "string" ? basics.location : typeof profile?.location === "string" ? profile.location : "",
    linkedin: typeof basics.linkedin === "string" ? basics.linkedin : typeof profile?.linkedin === "string" ? profile.linkedin : "",
  };
}

export function buildCanonicalProfile(input: {
  profile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  confirmedIdentity?: { name?: string; role?: string; headline?: string } | null;
}): WorkZoCanonicalProfile | null {
  const profile: any = input.profile || {};
  const rawText = healSpacedHeaders(input.rawText || profile.rawText || "");
  const aiName = profile?.basics?.name || profile?.name || "";
  const aiHeadline = profile?.basics?.headline || profile?.headline || profile?.title || profile?.targetRole || "";

  const confirmedName = input.confirmedIdentity?.name?.trim();
  const decision = confirmedName
    ? {
        selectedName: confirmedName,
        selectedNameSource: "user_confirmed",
        confidence: 1,
        needsConfirmation: false,
        rejectedCandidates: [] as string[],
      }
    : determineCanonicalIdentity({
        aiName,
        rawText,
        fileName: input.fileName,
        email: emailOf(profile),
      });

  if (!decision.selectedName || decision.needsConfirmation) {
    console.warn("[WorkZo] cv.profile.cache_rejected", {
      name: aiName || decision.selectedName || "",
      reason: "identity_needs_confirmation",
    });
    return null;
  }

  const headline =
    input.confirmedIdentity?.headline?.trim() ||
    input.confirmedIdentity?.role?.trim() ||
    resolveTargetHeadline({
      aiHeadline,
      rawText,
      selectedName: decision.selectedName,
    });

  const canonical: WorkZoCanonicalProfile = {
    ...(profile as ResumeProfile),
    rawText: rawText || profile.rawText || "",
    basics: normalizedBasics(profile, decision.selectedName, headline),
    canonicalVersion: WORKZO_CV_ENGINE_VERSION,
    identityConfidence: decision.confidence,
    identityNeedsConfirmation: false,
    selectedNameSource: decision.selectedNameSource,
    fileName: input.fileName || profile.fileName || "",
    updatedAt: new Date().toISOString(),
  };

  return canonical;
}

export function isUsableCanonicalProfile(profile: any): profile is WorkZoCanonicalProfile {
  const name = profile?.basics?.name || profile?.name || "";
  const hasEvidence =
    (Array.isArray(profile?.experience) && profile.experience.length > 0) ||
    (Array.isArray(profile?.education) && profile.education.length > 0) ||
    (Array.isArray(profile?.skills) && profile.skills.length > 0) ||
    (typeof profile?.summary === "string" && profile.summary.trim().length > 20);
  return Boolean(
    profile &&
      typeof name === "string" &&
      name.trim().length > 1 &&
      !profile.identityNeedsConfirmation &&
      hasEvidence,
  );
}

export function normalizeCanonicalProfile(profile: any): WorkZoCanonicalProfile | null {
  if (!profile) return null;

  // Stale cache: parsed by an older engine. Rebuild it with the current parser
  // rather than replaying an old, known-buggy parse.
  const stale = profile.canonicalVersion !== WORKZO_CV_ENGINE_VERSION;
  if (stale) {
    try {
      console.warn("[WorkZo] cv.profile.cache_stale, rebuilding with current parser", {
        cached: profile.canonicalVersion || "(none)",
        current: WORKZO_CV_ENGINE_VERSION,
      });
    } catch { /* non-fatal */ }
    const rawText: string = profile.rawText || profile.rawTextHealed || "";

    // Re-derive the STRUCTURED fields from the original CV text with the current
    // parser. Rebuilding from the cached structure alone would keep replaying the
    // old parse, so a language the old parser dropped (or a duplicate degree it
    // created) would survive forever. Re-parsing is what actually applies the fix.
    let refreshed: Partial<ResumeProfile> = profile;
    if (rawText.trim().length > 80) {
      try {
        const reparsed = extractResumeProfileComplex(rawText);
        const educationScore = (items: any[] = []) =>
          items.reduce((score, item) => {
            const degree = String(item?.degree || "");
            const institution = String(item?.institution || "");
            const suspicious = degree.length > 180 || /\b(completed|experience|customer|technical skills|summary)\b/i.test(degree);
            return score + (degree ? 12 : 0) + (institution ? 14 : 0) + (item?.dates ? 8 : 0) - (suspicious ? 40 : 0);
          }, 0);
        const projectScore = (items: any[] = []) =>
          items.length * 20 + items.reduce((score, item) => score + (Array.isArray(item?.bullets) ? item.bullets.length * 6 : 0), 0);
        const cachedEducation = Array.isArray(profile.education) ? profile.education : [];
        const parsedEducation = Array.isArray(reparsed.education) ? reparsed.education : [];
        const cachedProjects = Array.isArray(profile.projects) ? profile.projects : [];
        const parsedProjects = Array.isArray(reparsed.projects) ? reparsed.projects : [];

        refreshed = {
          ...profile,
          // Use the richer current parse, but never replace a good cached
          // section with a structurally worse parse from a multi-column PDF.
          languages: reparsed.languages?.length ? reparsed.languages : profile.languages,
          education: educationScore(parsedEducation) > educationScore(cachedEducation)
            ? parsedEducation
            : cachedEducation.length ? cachedEducation : parsedEducation,
          experience: (() => {
            const cachedExperience = Array.isArray(profile.experience) ? profile.experience : [];
            const parsedExperience = Array.isArray(reparsed.experience) ? reparsed.experience : [];
            if (!cachedExperience.length) return parsedExperience;
            if (!parsedExperience.length) return cachedExperience;

            const rawNorm = String(rawText || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            const normText = (value: unknown) => String(value || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();
            const exactInRaw = (value: unknown) => {
              const n = normText(value);
              return !!n && rawNorm.replace(/[^a-z0-9]+/g, " ").includes(n);
            };
            const companyKey = (value: unknown) => normText(value)
              .replace(/\b(gmbh|ag|se|ug|kg|ohg|ltd|llc|inc|corp|co|plc|bv|nv|group)\b/g, "")
              .trim();
            const parsedByCompany = new Map<string, any>();
            parsedExperience.forEach((entry: any) => {
              const key = companyKey(entry?.company);
              if (key && !parsedByCompany.has(key)) parsedByCompany.set(key, entry);
            });

            const merged = cachedExperience.map((saved: any, index: number) => {
              const parsed = parsedByCompany.get(companyKey(saved?.company)) || parsedExperience[index];
              if (!parsed) return saved;
              const savedExact = exactInRaw(saved?.title);
              const parsedExact = exactInRaw(parsed?.title);
              const title = savedExact && parsedExact
                ? (String(saved?.title || "").length >= String(parsed?.title || "").length ? saved.title : parsed.title)
                : savedExact ? saved.title : parsedExact ? parsed.title : (saved?.title || parsed?.title || "");
              const savedBullets = Array.isArray(saved?.bullets) ? saved.bullets : [];
              const parsedBullets = Array.isArray(parsed?.bullets) ? parsed.bullets : [];
              return {
                ...saved,
                title,
                company: saved?.company || parsed?.company || "",
                location: saved?.location || parsed?.location || "",
                dates: saved?.dates || parsed?.dates || "",
                bullets: parsedBullets.length > savedBullets.length ? parsedBullets : savedBullets,
              };
            });
            const seen = new Set(merged.map((entry: any) => companyKey(entry?.company)).filter(Boolean));
            parsedExperience.forEach((entry: any) => {
              const key = companyKey(entry?.company);
              if (key && !seen.has(key)) merged.push(entry);
            });
            return merged;
          })(),
          projects: (() => {
            const keyOf = (value: unknown) => String(value || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, " ")
              .trim();
            const byName = new Map<string, any>();
            for (const project of [...cachedProjects, ...parsedProjects]) {
              const key = keyOf(project?.name);
              if (!key) continue;
              const existing = byName.get(key);
              const existingBullets = Array.isArray(existing?.bullets) ? existing.bullets.length : 0;
              const nextBullets = Array.isArray(project?.bullets) ? project.bullets.length : 0;
              if (!existing || nextBullets > existingBullets) byName.set(key, project);
            }
            return Array.from(byName.values());
          })(),
          skills: reparsed.skills?.length ? reparsed.skills : profile.skills,
        };
      } catch {
        /* fall back to the cached structure rather than losing the profile */
      }
    }

    const rebuilt = buildCanonicalProfile({
      profile: refreshed,
      rawText,
      fileName: profile.fileName || "",
    });
    if (rebuilt) {
      // normalizeCanonicalProfile is also called for profiles coming from the
      // shared CV source and interview setup, not only through
      // getSavedCanonicalProfile(). Persist the migration here so every entry
      // point receives the same versioned profile and the next render does not
      // rebuild again with canonicalVersion "(none)".
      persistNormalizedCanonicalProfile(rebuilt);
      return rebuilt;
    }

    // buildCanonicalProfile returns null whenever it cannot CONFIRM the identity.
    // That must never destroy the profile: it left the Improve CV page with
    // `profile: null` and it skipped with "No verified CV profile available".
    //
    // Recover what we can and keep going. A CV with real experience/education is
    // still useful even if the name needs confirming, and the identity gate can
    // correct the name separately.
    const cachedName: string =
      (profile.basics && profile.basics.name) || profile.name || "";
    const recoveredName =
      cachedName ||
      recoverNameFromRawText(rawText, {
        location: profile.basics?.location,
        headline: profile.basics?.headline,
        skills: refreshed.skills,
        languages: refreshed.languages,
      });

    const hasEvidence =
      (Array.isArray(refreshed.experience) && refreshed.experience.length > 0) ||
      (Array.isArray(refreshed.education) && refreshed.education.length > 0) ||
      (Array.isArray(refreshed.skills) && refreshed.skills.length > 0) ||
      (typeof refreshed.summary === "string" && refreshed.summary.trim().length > 20) ||
      rawText.trim().length > 200;

    if (!recoveredName && !hasEvidence) return null;

    const recovered = {
      ...(refreshed as ResumeProfile),
      basics: {
        ...(profile.basics || {}),
        name: recoveredName,
        headline: profile.basics?.headline || "",
      },
      rawText,
      canonicalVersion: WORKZO_CV_ENGINE_VERSION,
      identityNeedsConfirmation: false,
      identityConfidence: recoveredName ? 0.5 : 0,
      fileName: profile.fileName || "",
      updatedAt: new Date().toISOString(),
    } as WorkZoCanonicalProfile;
    persistNormalizedCanonicalProfile(recovered);
    return recovered;
  }

  if (isUsableCanonicalProfile(profile) && profile.basics?.name) return profile as WorkZoCanonicalProfile;
  return buildCanonicalProfile({
    profile,
    rawText: profile.rawText || profile.rawTextHealed || "",
    fileName: profile.fileName || "",
  });
}

export type SaveCanonicalProfileOptions = {
  rawText?: string | null;
  fileName?: string | null;
  confirmedIdentity?: { name?: string; role?: string; headline?: string } | null;
  jobDescription?: string | null;
  targetRole?: string | null;
  targetMarket?: string | null;
};

/**
 * Stores one structured CV source for every WorkZo feature.
 * Supports both:
 *   saveCanonicalProfile(profile, { rawText, fileName })
 *   saveCanonicalProfile(profile, rawText, fileName)
 */
export function saveCanonicalProfile(
  profile: Partial<ResumeProfile> | null | undefined,
  optsOrRawText?: SaveCanonicalProfileOptions | string | null,
  legacyFileName?: string | null,
): WorkZoCanonicalProfile | null {
  if (!profile) return null;

  const opts: SaveCanonicalProfileOptions =
    typeof optsOrRawText === "string" || optsOrRawText === null
      ? { rawText: optsOrRawText || "", fileName: legacyFileName || "" }
      : optsOrRawText || {};

  const canonical = buildCanonicalProfile({
    profile,
    rawText: opts.rawText || (profile as any)?.rawText || "",
    fileName: opts.fileName || (profile as any)?.fileName || "",
    confirmedIdentity: opts.confirmedIdentity || null,
  });
  if (!canonical) return null;

  const sharedSource = {
    profile: canonical,
    rawCvText: canonical.rawText || opts.rawText || "",
    fileName: opts.fileName || canonical.fileName || "",
    jobDescription: opts.jobDescription || "",
    targetRole: opts.targetRole || canonical.basics.headline || "",
    targetMarket: opts.targetMarket || "Global",
    source: "canonical",
    origin: "canonical",
    needsReupload: false,
    hasCv: true,
    hasProfile: true,
    hasJobDescription: Boolean(opts.jobDescription?.trim()),
    hasTargetRole: Boolean((opts.targetRole || canonical.basics.headline || "").trim()),
    updatedAt: new Date().toISOString(),
  };

  const canonicalJson = JSON.stringify(canonical);
  const sharedJson = JSON.stringify(sharedSource);
  for (const storage of storageTargets()) {
    safeSet(storage, CANONICAL_PROFILE_STORAGE_KEY, canonicalJson);
    safeSet(storage, SHARED_SOURCE_STORAGE_KEY, sharedJson);
    safeSet(storage, "workzo_resume_profile", canonicalJson);
    safeSet(storage, "workzo_ai_resume_profile", canonicalJson);
    safeSet(storage, "workzo_raw_cv_text", sharedSource.rawCvText);
    if (sharedSource.fileName) safeSet(storage, "workzo_cv_file_name", sharedSource.fileName);
    if (sharedSource.targetRole) safeSet(storage, "workzo_target_role", sharedSource.targetRole);
    safeSet(storage, "workzo_target_market", sharedSource.targetMarket);
  }

  return canonical;
}

export function clearCanonicalProfile(): void {
  const keys = [
    CANONICAL_PROFILE_STORAGE_KEY,
    SHARED_SOURCE_STORAGE_KEY,
    "workzo_resume_profile",
    "workzo_ai_resume_profile",
    "workzo_raw_cv_text",
    "workzo_uploaded_cv_text",
    "workzo_cv_file_name",
  ];
  for (const storage of storageTargets()) {
    for (const key of keys) safeRemove(storage, key);
  }
}

function persistNormalizedCanonicalProfile(profile: WorkZoCanonicalProfile): void {
  if (!canUseBrowserStorage()) return;

  const canonicalJson = JSON.stringify(profile);
  for (const storage of storageTargets()) {
    safeSet(storage, CANONICAL_PROFILE_STORAGE_KEY, canonicalJson);
    safeSet(storage, "workzo_resume_profile", canonicalJson);
    safeSet(storage, "workzo_ai_resume_profile", canonicalJson);

    const existingSharedRaw = safeGet(storage, SHARED_SOURCE_STORAGE_KEY);
    let existingShared: Record<string, unknown> = {};
    if (existingSharedRaw) {
      try {
        const parsed = JSON.parse(existingSharedRaw);
        if (parsed && typeof parsed === "object") existingShared = parsed;
      } catch {}
    }

    const rawCvText = profile.rawText || String(existingShared.rawCvText || "");
    const nextShared = {
      ...existingShared,
      profile,
      rawCvText,
      fileName: profile.fileName || String(existingShared.fileName || ""),
      source: "canonical",
      origin: "canonical",
      needsReupload: false,
      hasCv: true,
      hasProfile: true,
      updatedAt: new Date().toISOString(),
    };
    safeSet(storage, SHARED_SOURCE_STORAGE_KEY, JSON.stringify(nextShared));
    if (rawCvText) safeSet(storage, "workzo_raw_cv_text", rawCvText);
  }
}

export function getSavedCanonicalProfile(): WorkZoCanonicalProfile | null {
  for (const storage of storageTargets()) {
    for (const key of [CANONICAL_PROFILE_STORAGE_KEY, "workzo_resume_profile", "workzo_ai_resume_profile"]) {
      const raw = safeGet(storage, key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalizeCanonicalProfile(parsed);
        if (normalized) {
          // A stale profile must be written back immediately. Previously the
          // rebuilt object was returned only in memory, so every page load saw
          // canonicalVersion as missing and rebuilt again. Persisting here also
          // keeps workzo_cv_source and the legacy profile keys in sync.
          if (
            parsed?.canonicalVersion !== WORKZO_CV_ENGINE_VERSION ||
            parsed?.updatedAt !== normalized.updatedAt
          ) {
            persistNormalizedCanonicalProfile(normalized);
          }
          return normalized;
        }
      } catch {}
    }
  }
  return null;
}

export function lockInterviewLanguage(language?: string | null): void {
  const value = typeof language === "string" ? language.trim() : "";
  if (!value) return;
  for (const storage of storageTargets()) safeSet(storage, INTERVIEW_LANGUAGE_STORAGE_KEY, value);
}

export function getLockedInterviewLanguage(): string {
  for (const storage of storageTargets()) {
    const value = safeGet(storage, INTERVIEW_LANGUAGE_STORAGE_KEY);
    if (value) return value;
  }
  return "";
}
