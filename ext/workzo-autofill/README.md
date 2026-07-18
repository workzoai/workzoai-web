# WorkZo Autofill (Chrome/Edge extension)

Fills job application forms from the user's verified WorkZo profile, highlights every field it touches, and **never submits**. Fill-and-review, not fill-and-submit, in line with the Smart Apply spec (section 1: no blind submission).

## Load it (unpacked, for development)

1. Set `WORKZO_EXTENSION_TOKEN_SECRET` in the web app's environment (a long random string). Without it, the token endpoint returns 503 and the extension cannot fetch data. This is intentional: no secret means no forgeable tokens.
2. In Chrome, go to `chrome://extensions`, enable Developer mode, click "Load unpacked", and select this folder.
3. Copy the extension's ID from that page. In the web app, expose it to the workspace as `window.WORKZO_EXTENSION_ID` (an env-driven `<script>` or a small inline snippet on the Smart Apply page). This is how the workspace hands the active session to the extension.
4. For local dev, change `WORKZO_ORIGIN` in `src/background.js` to your dev URL, and add it to the manifest's `host_permissions`.

## How it works

```
WorkZo web app (user signed in)
        │  POST /api/extension/token   (session cookie, OUR origin only)
        ▼
  scoped fill token  ──────────────►  extension background worker (stores token)
        │                                     │
 workspace posts {sessionId, profile}         │ POST /api/extension/fill-data
 to the extension when a session opens         │  Authorization: Bearer <token>
                                               ▼
                                    server rebuilds fill data,
                                    RE-GATED against the session's match
                                               │
                                               ▼
             content script fills the employer's form + highlights every field
```

## The security model, in one paragraph

The content script runs on arbitrary job sites, so it must be assumed hostile-adjacent. It therefore never holds the user's WorkZo session cookie. The **background worker** holds a short-lived (10 min), single-scope token (`extension_fill`) that can do exactly one thing: fetch fill data for its own user. The token is a stateless HMAC, so there is no token table to breach. The content script only ever receives already-fetched fill values, never the token. Least privilege throughout: the manifest requests no blanket host access at install; the content script is inert until the user clicks Fill.

## The honesty model

The fill data is built by the same evidence gate that governs the tailored CV and cover letter (`lib/smart-apply/validateEvidence.ts`). A "why are you a fit?" box is filled only from skills the CV proves; a "key skills" box contains only evidenced skills, never JD keywords the CV cannot back up. The server also returns a `forbiddenClaims` list, and the content script scrubs those from any free-text it fills, sentence by sentence, as a second line of defence. So a skill the tailored CV refused to claim cannot reappear in the form. That is the whole point: an ATS reads the form first, so the form has to be as honest as the CV.

Every generated field is highlighted amber ("review before sending"); verbatim identity fields are highlighted blue. Nothing is filled invisibly.

## Files

- `manifest.json` — MV3, minimal permissions (`storage`, `activeTab`, `scripting`), optional host access.
- `src/fieldMap.js` — pure-DOM field detection. Matches canonical keys (email, first_name, why_fit, ...) to messy real-world form fields by a weighted bundle of signals (autocomplete, label, aria, placeholder, name/id). Confidence floor: a wrong autofill is worse than a blank.
- `src/content.js` — fills, highlights, scrubs forbidden claims, fires input+change so React-controlled ATS forms register the change. Inert until messaged.
- `src/background.js` — holds the token, does all network calls, refreshes the token on expiry.
- `src/popup.html` / `popup.js` — the user's control surface: status, Fill, Clear highlights.

## Before shipping to a store

- **Icons are placeholders** (solid blue rounded squares). Replace with real brand icons.
- **`externally_connectable`**: this build uses `onMessageExternal` for the workspace to hand over the session. A store build should declare `externally_connectable.matches` for `https://*.workzoai.com/*` in the manifest so only WorkZo pages can post to the worker.
- **`WORKZO_ORIGIN`** is hardcoded to `https://www.workzoai.com` in the background worker. Confirm that matches production.
- **Field-map coverage**: tested against the common ATS patterns (Greenhouse, Lever, Ashby, Workday-style). Run it against your actual top-referrer job sites and add rules for any field it misses. The map is data, so extending it is low-risk.
- **No automated tests here.** The field map and scrubber are pure functions and worth a small test harness against saved copies of real form HTML.
