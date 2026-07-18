/*
 * background.js (service worker)
 *
 * Holds the scoped fill token and does all network calls to WorkZo. The token lives
 * here, in extension storage, and is NEVER handed to a content script or a page: the
 * content script only ever receives already-fetched fill data, so a hostile job page
 * cannot read the token even if it compromised its own content-script world.
 *
 * The session and profile come from the WorkZo web app when the user starts an
 * application, saved into extension storage by a small bridge on the workspace page.
 */

const WORKZO_ORIGIN = "https://www.workzoai.com";

async function getStored(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
async function setStored(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

/* Refresh the fill token from the web app. Requires the user to be signed in there. */
async function refreshToken() {
  try {
    const res = await fetch(`${WORKZO_ORIGIN}/api/extension/token`, {
      method: "POST",
      credentials: "include", // uses the user's WorkZo session, on OUR origin only
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    if (!data?.ok || !data.token) return { ok: false, status: res.status };
    await setStored({ workzo_token: data.token, workzo_token_exp: data.expiresAt });
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function validToken() {
  const { workzo_token, workzo_token_exp } = await getStored(["workzo_token", "workzo_token_exp"]);
  // Refresh a minute before expiry to avoid a mid-request death.
  if (workzo_token && workzo_token_exp && Date.now() < workzo_token_exp - 60_000) return workzo_token;
  const refreshed = await refreshToken();
  if (!refreshed.ok) return null;
  const again = await getStored(["workzo_token"]);
  return again.workzo_token || null;
}

async function fetchFillData(sessionId, profile) {
  const token = await validToken();
  if (!token) return { ok: false, error: "not_signed_in" };
  try {
    const res = await fetch(`${WORKZO_ORIGIN}/api/extension/fill-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, profile }),
    });
    if (res.status === 401) {
      // Token stale or revoked: one refresh + retry, then give up.
      await refreshToken();
      const token2 = (await getStored(["workzo_token"])).workzo_token;
      if (!token2) return { ok: false, error: "not_signed_in" };
      const retry = await fetch(`${WORKZO_ORIGIN}/api/extension/fill-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ sessionId, profile }),
      });
      if (!retry.ok) return { ok: false, error: "fetch_failed" };
      const d = await retry.json();
      return d?.ok ? { ok: true, fillData: d.fillData } : { ok: false, error: d?.error || "unknown" };
    }
    if (!res.ok) return { ok: false, error: "fetch_failed" };
    const data = await res.json();
    return data?.ok ? { ok: true, fillData: data.fillData } : { ok: false, error: data?.error || "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
}

/*
 * Build a session from a JD scraped off the current external page. Sends the scrape to
 * WorkZo, which runs the real match engine and evidence gate and returns a sessionId.
 * The extension itself scores nothing; honesty stays server-side.
 */
async function scrapeSession(scraped, profile) {
  const token = await validToken();
  if (!token) return { ok: false, error: "not_signed_in" };
  try {
    const res = await fetch(`${WORKZO_ORIGIN}/api/extension/scrape-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scraped, profile }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      // Store as the active session so the normal fill flow picks it up.
      await setStored({ workzo_active_session: data.sessionId });
      return { ok: true, ...data };
    }
    return { ok: false, error: data?.error || "scrape_failed", message: data?.message };
  } catch {
    return { ok: false, error: "network" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "WORKZO_GET_FILL") {
    (async () => {
      const { workzo_active_session, workzo_profile } = await getStored(["workzo_active_session", "workzo_profile"]);
      if (!workzo_active_session || !workzo_profile) {
        sendResponse({ ok: false, error: "no_session" });
        return;
      }
      const result = await fetchFillData(workzo_active_session, workzo_profile);
      sendResponse(result);
    })();
    return true; // async
  }
  if (msg?.type === "WORKZO_SIGN_IN") {
    (async () => sendResponse(await refreshToken()))();
    return true;
  }
  if (msg?.type === "WORKZO_SCRAPE_SESSION" && msg.scraped) {
    (async () => {
      const { workzo_profile } = await getStored(["workzo_profile"]);
      if (!workzo_profile) {
        sendResponse({ ok: false, error: "no_profile" });
        return;
      }
      sendResponse(await scrapeSession(msg.scraped, workzo_profile));
    })();
    return true;
  }
  if (msg?.type === "WORKZO_STATUS") {
    (async () => {
      const s = await getStored(["workzo_active_session", "workzo_profile", "workzo_token_exp"]);
      sendResponse({
        ok: true,
        hasSession: Boolean(s.workzo_active_session && s.workzo_profile),
        signedIn: Boolean(s.workzo_token_exp && Date.now() < s.workzo_token_exp),
      });
    })();
    return true;
  }
  return false;
});

/*
 * The workspace bridge posts the active session + profile via
 * chrome.runtime.sendMessage from an externally_connectable page. For MV3 simplicity
 * here, the web app writes them through a content script on the WorkZo origin; a
 * production build would use externally_connectable in the manifest.
 */
chrome.runtime.onMessageExternal?.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "WORKZO_SET_SESSION") {
    setStored({
      workzo_active_session: msg.sessionId,
      workzo_profile: msg.profile,
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
  /*
   * Profile-only push. Sent by any WorkZo page when the user is signed in, so the
   * extension has the canonical CV cached for Tier 2 fills on EXTERNAL sites where the
   * user never opened a WorkZo session for that specific job. The profile is the user's
   * own data; caching it in the extension's own storage is no different from the web
   * app holding it in localStorage.
   */
  if (msg?.type === "WORKZO_SET_PROFILE") {
    setStored({ workzo_profile: msg.profile }).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
