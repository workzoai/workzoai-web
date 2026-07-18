/*
 * content.js
 *
 * Runs on the job application page. Does NOTHING until the popup tells it to fill:
 * the extension is present everywhere but inert until the user clicks, which is the
 * least-privilege posture for something that can touch arbitrary pages.
 *
 * When asked, it:
 *   1. detects fields (fieldMap.js),
 *   2. fills each with the matching value,
 *   3. HIGHLIGHTS every filled field so the user sees exactly what changed,
 *   4. SCRUBS any forbidden (unevidenced) claim from free-text answers, and
 *   5. never, ever clicks submit.
 *
 * The highlight is the product. This is fill-and-review, not fill-and-hide: the whole
 * value of WorkZo is honesty, and an autofill the user cannot see defeats it.
 */

(function () {
  const HL_CLASS = "__workzo_filled__";
  const HL_STYLE_ID = "__workzo_style__";

  function injectStyle() {
    if (document.getElementById(HL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HL_STYLE_ID;
    style.textContent = `
      .${HL_CLASS} {
        outline: 2px solid #2563eb !important;
        outline-offset: 1px !important;
        background-color: rgba(37, 99, 235, 0.06) !important;
        transition: outline-color 0.4s ease;
      }
      .${HL_CLASS}[data-workzo-review="true"] {
        outline-color: #d97706 !important;
        background-color: rgba(217, 119, 6, 0.08) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  /*
   * Setting .value on a React-controlled input does not trigger React's onChange,
   * because React tracks the value on its own. We set the value through the native
   * setter and then dispatch input+change, which is the known way to make controlled
   * components (every modern ATS) register the fill.
   */
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(el, value) {
    const target = value.toLowerCase().trim();
    const option = Array.from(el.options).find(
      (o) => o.value.toLowerCase() === target || (o.textContent || "").toLowerCase().trim() === target,
    );
    if (option) {
      el.value = option.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  /*
   * Scrub forbidden claims from a free-text value. Sentence-level: if a sentence names
   * a blocked skill, drop the whole sentence rather than surgically edit it (a
   * half-edited sentence is how "no experience with X" becomes "experience with X").
   * This is the same blunt, safe strategy the server-side letter scrubber uses.
   */
  function scrubForbidden(text, forbidden) {
    if (!forbidden || !forbidden.length) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((s) => {
      const lower = s.toLowerCase();
      return !forbidden.some((claim) => {
        const c = claim.toLowerCase();
        // Word-boundary-ish check so "java" does not match "javascript".
        return new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(lower);
      });
    });
    return kept.join(" ").replace(/\s+/g, " ").trim();
  }

  function applyFill(fillData) {
    injectStyle();
    const detected = window.WorkZoFieldMap.detectFields();
    const byKey = new Map();
    for (const field of fillData.fields) {
      if (!byKey.has(field.key)) byKey.set(field.key, field);
    }

    let filled = 0;
    let flagged = 0;
    const used = new WeakSet();

    for (const { el, key } of detected) {
      if (used.has(el)) continue;
      const field = byKey.get(key);
      if (!field) continue;

      let value = field.value;
      // Free-text answers get scrubbed of anything the CV cannot back up.
      if (key === "why_fit" || key === "key_skills") {
        value = scrubForbidden(value, fillData.forbiddenClaims);
      }
      if (!value) continue;

      let ok = true;
      if (el.tagName === "SELECT") ok = fillSelect(el, value);
      else setNativeValue(el, value);
      if (!ok) continue;

      used.add(el);
      el.classList.add(HL_CLASS);
      if (field.confidence !== "verbatim") {
        el.setAttribute("data-workzo-review", "true");
        if (field.note) el.setAttribute("title", `WorkZo: ${field.note}`);
        flagged += 1;
      } else {
        el.setAttribute("title", "Filled by WorkZo from your profile.");
      }
      filled += 1;
    }

    return { filled, flagged };
  }

  function clearHighlights() {
    document.querySelectorAll(`.${HL_CLASS}`).forEach((el) => {
      el.classList.remove(HL_CLASS);
      el.removeAttribute("data-workzo-review");
    });
  }

  // Message bridge from the popup. We never auto-run.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "WORKZO_SCRAPE") {
      try {
        const scraped = window.WorkZoJdScraper ? window.WorkZoJdScraper.scrapeJobPosting() : null;
        // Attach the page URL as the applyUrl, since the user is on the application page.
        if (scraped) scraped.applyUrl = location.href;
        sendResponse({ ok: true, scraped });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return true;
    }
    if (msg?.type === "WORKZO_DETECT") {
      const detected = window.WorkZoFieldMap.detectFields();
      sendResponse({ ok: true, count: detected.length, keys: [...new Set(detected.map((d) => d.key))] });
      return true;
    }
    if (msg?.type === "WORKZO_FILL" && msg.fillData) {
      try {
        const result = applyFill(msg.fillData);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return true;
    }
    if (msg?.type === "WORKZO_CLEAR") {
      clearHighlights();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
})();
