/*
 * jdScraper.js
 *
 * Extracts a job posting (title, company, description) from an arbitrary page.
 *
 * This is the brittle heart of Tier 2, so it is built in LAYERS, strongest signal
 * first, and it is honest about its own confidence:
 *
 *   1. JSON-LD JobPosting. schema.org/JobPosting is a real standard, and Greenhouse,
 *      Lever, Workday, LinkedIn, Indeed and most serious ATSs emit it in a <script
 *      type="application/ld+json">. When present it is authoritative: title, company,
 *      and a clean description, no guessing.
 *   2. Known-ATS DOM selectors. For the big platforms that do NOT always emit JSON-LD,
 *      target their known containers.
 *   3. Generic heuristic. The <h1> as title, the largest text block as description.
 *      Lowest confidence, and we SAY so, because a bad JD scrape produces a bad match,
 *      which produces answers of unknown honesty. The extension surfaces low confidence
 *      to the user rather than silently proceeding.
 *
 * It returns a confidence level precisely so the rest of the pipeline can refuse to
 * generate tailored (evidence-gated) answers off a scrape it does not trust, and fall
 * back to identity-only fill. Honesty degrades gracefully; it does not fail silently.
 */

(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
  }

  function cleanBlock(text) {
    return (text || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* ── Layer 1: JSON-LD JobPosting ──────────────────────────────────────────── */

  function fromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent || "");
      } catch {
        continue;
      }
      // Can be a single object, an array, or a @graph wrapper.
      const candidates = [];
      const collect = (node) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) return node.forEach(collect);
        if (node["@graph"]) collect(node["@graph"]);
        const type = node["@type"];
        if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) candidates.push(node);
      };
      collect(data);

      for (const job of candidates) {
        const title = clean(job.title);
        // Description is often HTML; strip tags to text.
        const descHtml = job.description || "";
        const tmp = document.createElement("div");
        tmp.innerHTML = descHtml;
        const description = cleanBlock(tmp.textContent || "");
        const company = clean(
          (job.hiringOrganization && (job.hiringOrganization.name || job.hiringOrganization)) || "",
        );
        const location = clean(
          job.jobLocation &&
            (job.jobLocation.address
              ? [job.jobLocation.address.addressLocality, job.jobLocation.address.addressCountry].filter(Boolean).join(", ")
              : ""),
        );
        if (title && description.length > 120) {
          return { title, company, location, description, confidence: "high", source: "json-ld" };
        }
      }
    }
    return null;
  }

  /* ── Layer 2: known-ATS selectors ─────────────────────────────────────────── */

  const ATS_SELECTORS = [
    // Greenhouse
    { host: /greenhouse|boards\.greenhouse/i, title: ".app-title, h1.section-header", company: ".company-name", desc: "#content, .job__description, #job_description" },
    // Lever
    { host: /lever\.co/i, title: ".posting-headline h2, h2", company: ".main-header-logo img", desc: ".posting-page .section-wrapper, .content .section" },
    // Ashby
    { host: /ashbyhq|jobs\.ashby/i, title: "h1", company: "[class*=companyName]", desc: "[class*=descriptionText], [class*=jobDescription]" },
    // Workday
    { host: /myworkdayjobs|workday/i, title: "[data-automation-id=jobPostingHeader]", company: "", desc: "[data-automation-id=jobPostingDescription]" },
    // LinkedIn (best-effort; LinkedIn is hostile and this is nice-to-have)
    { host: /linkedin\.com/i, title: ".top-card-layout__title, .job-details-jobs-unified-top-card__job-title, h1", company: ".topcard__org-name-link, .job-details-jobs-unified-top-card__company-name", desc: ".description__text, .jobs-description__content, #job-details" },
    // Indeed
    { host: /indeed\./i, title: ".jobsearch-JobInfoHeader-title, h1", company: "[data-company-name], .jobsearch-CompanyInfoContainer", desc: "#jobDescriptionText" },
  ];

  function fromAtsSelectors() {
    const host = location.hostname;
    const match = ATS_SELECTORS.find((s) => s.host.test(host));
    if (!match) return null;

    const pick = (sel) => {
      if (!sel) return "";
      for (const one of sel.split(",")) {
        const el = document.querySelector(one.trim());
        if (el) {
          const val = el.tagName === "IMG" ? el.getAttribute("alt") : el.textContent;
          if (val && clean(val)) return el;
        }
      }
      return null;
    };

    const titleEl = pick(match.title);
    const descEl = pick(match.desc);
    const companyEl = pick(match.company);

    const title = clean(titleEl ? (titleEl.tagName === "IMG" ? titleEl.getAttribute("alt") : titleEl.textContent) : "");
    const description = cleanBlock(descEl ? descEl.textContent : "");
    const company = clean(companyEl ? (companyEl.tagName === "IMG" ? companyEl.getAttribute("alt") : companyEl.textContent) : "");

    if (title && description.length > 120) {
      return { title, company, location: "", description, confidence: "medium", source: "ats-dom" };
    }
    return null;
  }

  /* ── Layer 3: generic heuristic ───────────────────────────────────────────── */

  function fromHeuristic() {
    // Title: first h1, or the document title stripped of site chrome.
    const h1 = document.querySelector("h1");
    const title = clean(h1 ? h1.textContent : (document.title || "").split(/[|\-–—]/)[0]);

    // Description: the DOM element with the most text that looks like prose (many
    // words, several sentences), excluding nav/footer/aside.
    let best = null;
    let bestScore = 0;
    const blocks = document.querySelectorAll("article, section, main, div");
    for (const el of blocks) {
      if (el.closest("nav, footer, header, aside")) continue;
      const text = el.textContent || "";
      if (text.length < 300) continue;
      // Prefer blocks with requirement-ish language, penalise link-dense (menus).
      const links = el.querySelectorAll("a").length;
      const words = text.split(/\s+/).length;
      const linkDensity = words ? links / words : 1;
      if (linkDensity > 0.15) continue;
      const score = Math.min(text.length, 6000) * (/requirements?|responsibilities|qualifications|about the role|what you/i.test(text) ? 1.5 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    const description = cleanBlock(best ? best.textContent : "");

    if (title && description.length > 200) {
      return { title, company: "", location: "", description, confidence: "low", source: "heuristic" };
    }
    return null;
  }

  /**
   * Scrape the current page. Returns { title, company, location, description,
   * confidence, source } or null if nothing usable was found.
   */
  function scrapeJobPosting() {
    return fromJsonLd() || fromAtsSelectors() || fromHeuristic() || null;
  }

  window.WorkZoJdScraper = { scrapeJobPosting };
})();
