/*
 * popup.js
 *
 * The control surface. Shows whether the user is signed in and has an active
 * application, and drives the fill. The popup never touches the token or the page
 * directly: it asks the background worker for data and the content script to apply it.
 */

const $ = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function setDot(id, on) {
  $(id).className = "dot " + (on ? "ok" : "no");
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: "WORKZO_STATUS" });
  const signedIn = Boolean(status?.signedIn);
  const hasSession = Boolean(status?.hasSession);

  setDot("dot-signin", signedIn);
  $("txt-signin").textContent = signedIn ? "Signed in to WorkZo" : "Not signed in";
  setDot("dot-session", hasSession);
  $("txt-session").textContent = hasSession ? "Application ready to fill" : "No active application";

  $("fill").disabled = !(signedIn && hasSession);

  if (!signedIn) setStatus("Open WorkZo and sign in, then start Smart Apply for a job.", "warn");
  else if (!hasSession) setStatus("Start an application in WorkZo Smart Apply first.", "warn");
  else setStatus("");
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

$("fill").addEventListener("click", async () => {
  $("fill").disabled = true;
  setStatus("Preparing your details…");

  const result = await chrome.runtime.sendMessage({ type: "WORKZO_GET_FILL" });
  if (!result?.ok) {
    const map = {
      not_signed_in: "Please sign in to WorkZo and try again.",
      no_session: "Start an application in WorkZo Smart Apply first.",
      network: "Could not reach WorkZo. Check your connection.",
    };
    setStatus(map[result?.error] || "Could not load your details.", "err");
    await refreshStatus();
    return;
  }

  const tab = await activeTab();
  if (!tab?.id) {
    setStatus("No active tab to fill.", "err");
    return;
  }

  let applied;
  try {
    applied = await chrome.tabs.sendMessage(tab.id, { type: "WORKZO_FILL", fillData: result.fillData });
  } catch {
    setStatus("This page could not be filled. Try clicking into the form first.", "err");
    return;
  }

  if (applied?.ok) {
    const flaggedText = applied.flagged ? `, ${applied.flagged} to review` : "";
    setStatus(
      applied.filled ? `Filled ${applied.filled} field${applied.filled === 1 ? "" : "s"}${flaggedText}. Check the highlights, then submit yourself.` : "No matching fields found on this page.",
      applied.filled ? "good" : "warn",
    );
  } else {
    setStatus("Could not fill this page.", "err");
  }
  await refreshStatus();
});

$("scan").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) {
    setStatus("No active tab to scan.", "err");
    return;
  }
  setStatus("Reading this job page…");

  // 1. Ask the content script to scrape the JD off the page.
  let scrapeRes;
  try {
    scrapeRes = await chrome.tabs.sendMessage(tab.id, { type: "WORKZO_SCRAPE" });
  } catch {
    setStatus("This page could not be read. Try clicking into it first.", "err");
    return;
  }
  if (!scrapeRes?.ok || !scrapeRes.scraped) {
    setStatus("No job description found on this page.", "warn");
    return;
  }

  // 2. Send the scrape to WorkZo to build an evidence-gated session.
  const sessionRes = await chrome.runtime.sendMessage({ type: "WORKZO_SCRAPE_SESSION", scraped: scrapeRes.scraped });
  if (!sessionRes?.ok) {
    const map = {
      not_signed_in: "Sign in to WorkZo first.",
      no_profile: "Open WorkZo once so your CV is available, then try again.",
      jd_unreadable: "Could not read a full job description here. You can still fill your contact details.",
    };
    setStatus(map[sessionRes?.error] || "Could not analyse this job.", sessionRes?.error === "jd_unreadable" ? "warn" : "err");
    // Even on jd_unreadable, identity fill is still possible via the normal Fill button
    // if a session exists; refresh so the button state is correct.
    await refreshStatus();
    return;
  }

  const conf = sessionRes.scrapeConfidence;
  const confWarn = conf === "low" ? " Heads up: this page was hard to read, so double-check the tailored answers." : "";
  setStatus(`Analysed: ${sessionRes.job?.title || "this role"} (match ${sessionRes.match?.score ?? "?"}).${confWarn} Now click Fill this form.`, conf === "low" ? "warn" : "good");
  await refreshStatus();
});

$("clear").addEventListener("click", async () => {
  const tab = await activeTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "WORKZO_CLEAR" });
    } catch {
      /* content script not present on this page; nothing to clear */
    }
  }
  setStatus("Highlights cleared.");
});

document.addEventListener("DOMContentLoaded", refreshStatus);
