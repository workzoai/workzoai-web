/*
 * lib/extension/fillToken.ts
 *
 * A short-lived, single-purpose token that lets the browser extension fetch fill
 * data for the signed-in user, and NOTHING else.
 *
 * WHY A SCOPED TOKEN AND NOT THE SESSION COOKIE
 *
 * The extension runs on third-party job sites (Greenhouse, Lever, Workday, and any
 * careers page). A content script there must never carry the user's real WorkZo
 * session cookie: that cookie can do everything the user can do, and a hostile page,
 * an XSS on the job site, or a malicious sibling extension could lift it and take over
 * the account.
 *
 * So the extension holds a token that can do exactly ONE thing: call the fill-data
 * endpoint. It:
 *   - names its scope explicitly ("extension_fill"), so it cannot be replayed against
 *     any other route,
 *   - expires quickly (minutes, not weeks), so a leaked token is a small, brief
 *     problem,
 *   - is stateless (HMAC over the claims), so there is no token table to breach and no
 *     lookup on the hot path, and
 *   - binds to the userId, so it can only ever return that one user's data.
 *
 * It is deliberately NOT a general session. You cannot post an application with it,
 * change a plan with it, or read anything but fill data.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SCOPE = "extension_fill";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

type FillTokenClaims = {
  userId: string;
  scope: typeof SCOPE;
  exp: number; // epoch ms
};

function secret(): string {
  const value = process.env.WORKZO_EXTENSION_TOKEN_SECRET || "";
  if (!value) {
    // Fail closed. A missing secret must not silently produce forgeable tokens.
    throw new Error("WORKZO_EXTENSION_TOKEN_SECRET is not set");
  }
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Mint a token for a user. Called from an authenticated route only. */
export function issueFillToken(userId: string, ttlMs = DEFAULT_TTL_MS): { token: string; expiresAt: number } {
  const claims: FillTokenClaims = { userId, scope: SCOPE, exp: Date.now() + ttlMs };
  const payload = b64url(JSON.stringify(claims));
  const sig = sign(payload);
  return { token: `${payload}.${sig}`, expiresAt: claims.exp };
}

/**
 * Verify a token and return its userId, or null.
 *
 * Every failure path returns null the same way: a caller cannot tell "expired" from
 * "forged" from "wrong scope", which is deliberate. The only thing a bad token earns
 * is a 401.
 */
export function verifyFillToken(token: string | null | undefined): { userId: string } | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  // Constant-time signature check.
  let expectedSig: string;
  try {
    expectedSig = sign(payload);
  } catch {
    return null; // secret not configured, treated as unverifiable
  }
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: FillTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (claims.scope !== SCOPE) return null;
  if (typeof claims.exp !== "number" || Date.now() > claims.exp) return null;
  if (!claims.userId || typeof claims.userId !== "string") return null;

  return { userId: claims.userId };
}
