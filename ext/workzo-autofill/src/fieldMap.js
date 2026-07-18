/*
 * fieldMap.js
 *
 * The hard part of any autofill extension: deciding which real <input> on a page
 * corresponds to a canonical field like "email" or "first_name".
 *
 * Real job forms are a mess. The same field is labelled "Email", "E-mail Address",
 * "Contact email", "Your email", or has no visible label and only an aria-label, a
 * placeholder, or an autocomplete attribute. Greenhouse, Lever, Workday, and Ashby all
 * name things differently, and many hand-rolled career pages name them worse.
 *
 * So we match on a WEIGHTED bundle of signals, not one attribute:
 *   autocomplete attribute (most reliable when present)
 *   name / id / the associated <label> text / aria-label / placeholder
 * and we take the highest-scoring canonical key per field, above a confidence floor.
 * Below the floor, we leave the field alone. A wrong autofill is worse than a blank.
 *
 * Nothing here is WorkZo-specific and nothing talks to the network. It is pure DOM
 * heuristics, exported for the content script.
 */

(function () {
  // Canonical key -> matching rules. `strong` matches score high (a near-certain
  // signal), `weak` matches score low (suggestive but ambiguous).
  const RULES = {
    first_name: {
      autocomplete: ["given-name"],
      strong: [/\bfirst[\s_-]?name\b/i, /\bgiven[\s_-]?name\b/i, /\bfname\b/i, /\bforename\b/i, /\bvorname\b/i, /\bpr[ée]nom\b/i, /\bnombre\b/i],
      weak: [],
    },
    last_name: {
      autocomplete: ["family-name"],
      strong: [/\blast[\s_-]?name\b/i, /\bfamily[\s_-]?name\b/i, /\bsurname\b/i, /\blname\b/i, /\bnachname\b/i, /\bnom\b/i, /\bapellido/i],
      weak: [],
    },
    full_name: {
      autocomplete: ["name"],
      strong: [/\bfull[\s_-]?name\b/i, /\byour[\s_-]?name\b/i, /^name$/i, /\bcandidate[\s_-]?name\b/i],
      weak: [/\bname\b/i],
    },
    email: {
      autocomplete: ["email"],
      strong: [/\be[\s_-]?mail\b/i, /\bemail[\s_-]?address\b/i],
      weak: [/\bcontact\b/i],
      inputType: ["email"],
    },
    phone: {
      autocomplete: ["tel", "tel-national"],
      strong: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i, /\bcell\b/i, /\btel\b/i, /\btelefon\b/i, /\bt[ée]l[ée]phone\b/i],
      weak: [],
      inputType: ["tel"],
    },
    location: {
      autocomplete: ["address-level2", "address-line1"],
      strong: [/\bcity\b/i, /\blocation\b/i, /\bwhere.*based\b/i, /\baddress\b/i, /\bstadt\b/i, /\bville\b/i, /\bciudad\b/i],
      weak: [/\bregion\b/i],
    },
    linkedin: {
      autocomplete: [],
      strong: [/\blinkedin\b/i, /\blinked[\s_-]?in\b/i],
      weak: [/\bprofile[\s_-]?url\b/i, /\bsocial\b/i],
    },
    current_title: {
      autocomplete: ["organization-title"],
      strong: [/\bcurrent[\s_-]?(job[\s_-]?)?title\b/i, /\bcurrent[\s_-]?role\b/i, /\bjob[\s_-]?title\b/i, /\bposition\b/i],
      weak: [/\btitle\b/i],
    },
    current_company: {
      autocomplete: ["organization"],
      strong: [/\bcurrent[\s_-]?(employer|company)\b/i, /\bemployer\b/i, /\bcompany\b/i],
      weak: [],
    },
    years_experience: {
      autocomplete: [],
      strong: [/\byears?[\s_-]?(of[\s_-]?)?experience\b/i, /\byears?[\s_-]?in\b/i, /\bexperience[\s_-]?years?\b/i],
      weak: [],
    },
    key_skills: {
      autocomplete: [],
      strong: [/\bkey[\s_-]?skills\b/i, /\bskills\b/i, /\bcore[\s_-]?competenc/i, /\btech(nical)?[\s_-]?skills\b/i],
      weak: [],
    },
    why_fit: {
      autocomplete: [],
      strong: [
        /\bwhy.*(you|good[\s_-]?fit|interested|apply|this[\s_-]?role|want)/i,
        /\bcover[\s_-]?letter\b/i,
        /\bmotivation\b/i,
        /\btell[\s_-]?us[\s_-]?about\b/i,
        /\bwhat[\s_-]?makes[\s_-]?you\b/i,
        /\badditional[\s_-]?information\b/i,
      ],
      weak: [/\bmessage\b/i, /\bcomments?\b/i],
    },
  };

  function textFor(el) {
    const bits = [];
    // Associated <label for=id>.
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) bits.push(lab.textContent || "");
    }
    // Wrapping <label>.
    const parentLabel = el.closest("label");
    if (parentLabel) bits.push(parentLabel.textContent || "");
    // aria-labelledby.
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node = document.getElementById(id);
        if (node) bits.push(node.textContent || "");
      });
    }
    bits.push(el.getAttribute("aria-label") || "");
    bits.push(el.getAttribute("placeholder") || "");
    bits.push(el.getAttribute("name") || "");
    bits.push(el.id || "");

    /*
     * ATS-specific hooks. The big platforms label fields in predictable ways that a
     * generic label search misses:
     *   Workday    data-automation-id="legalNameSection_firstName"
     *   Greenhouse the <label> is reliable, but custom questions use question ids
     *   Lever      name="name", name="email", data-qa attributes
     *   Ashby      structured field wrappers with _fieldEntry containers
     * We fold these attributes into the haystack so the same rules match them.
     */
    for (const attr of ["data-automation-id", "data-qa", "data-testid", "data-field", "data-source"]) {
      const v = el.getAttribute(attr);
      if (v) bits.push(v.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " "));
    }

    // A nearby preceding label-ish element, for forms with no real <label>. Walk up to
    // the field's wrapper and look for the first text node, which covers Workday and
    // Ashby's div-wrapped fields.
    const prev = el.previousElementSibling;
    if (prev && /label|span|div|p/i.test(prev.tagName) && (prev.textContent || "").length < 80) {
      bits.push(prev.textContent || "");
    }
    const wrapper = el.closest("[class*=field], [class*=Field], [class*=question], [class*=form-group]");
    if (wrapper) {
      const lbl = wrapper.querySelector("label, [class*=label], [class*=Label]");
      if (lbl && (lbl.textContent || "").length < 80) bits.push(lbl.textContent || "");
    }

    return bits.join(" ").replace(/\s+/g, " ").trim();
  }

  function scoreField(el) {
    const type = (el.getAttribute("type") || el.type || "text").toLowerCase();
    // Never touch these: they are not profile fields.
    if (["password", "hidden", "file", "submit", "button", "checkbox", "radio", "range", "color"].includes(type)) return null;

    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
    const haystack = textFor(el).toLowerCase();
    if (!haystack && !autocomplete) return null;

    let best = null;
    for (const [key, rule] of Object.entries(RULES)) {
      let score = 0;
      if (rule.autocomplete && rule.autocomplete.includes(autocomplete)) score += 6;
      if (rule.inputType && rule.inputType.includes(type)) score += 3;
      for (const re of rule.strong || []) if (re.test(haystack)) { score += 4; break; }
      for (const re of rule.weak || []) if (re.test(haystack)) { score += 1; break; }
      if (score > 0 && (!best || score > best.score)) best = { key, score };
    }

    // Confidence floor: require at least one strong or autocomplete signal. A lone weak
    // match ("name" inside "company name") is not enough to fill.
    if (!best || best.score < 4) return null;
    return best;
  }

  /**
   * Scan the document for fillable fields.
   * Returns [{ el, key, score }] with at most one field per canonical key (the
   * highest-scoring), except free-text answers which can legitimately repeat.
   */
  function detectFields() {
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    const scored = [];
    for (const el of inputs) {
      // Skip invisible or disabled fields.
      if (el.disabled || el.readOnly) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const match = scoreField(el);
      if (match) scored.push({ el, key: match.key, score: match.score });
    }

    // One field per key, best score wins, EXCEPT why_fit/key_skills which may appear in
    // several boxes on multi-part forms.
    const multi = new Set(["why_fit"]);
    const bestByKey = new Map();
    const out = [];
    for (const item of scored) {
      if (multi.has(item.key)) {
        out.push(item);
        continue;
      }
      const prev = bestByKey.get(item.key);
      if (!prev || item.score > prev.score) bestByKey.set(item.key, item);
    }
    return [...out, ...bestByKey.values()];
  }

  window.WorkZoFieldMap = { detectFields };
})();
