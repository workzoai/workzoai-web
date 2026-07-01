/**
 * WorkZo AI — Universal CV Text Rebuilder
 * lib/workzoCvPdfCleaner.ts
 *
 * Problem: pdf-parse extracts text in PDF content-stream order, not visual order.
 * Multi-column CVs (sidebar on left, main content on right) extract as:
 * [sidebar skills/contact/education] → [main body experience/projects]
 * This looks clumsy and confuses the resume parser.
 *
 * This module rebuilds the text into correct reading order using heuristics
 * and then normalises all artefacts from common CV template engines.
 *
 * It is person-agnostic — works for any CV from any candidate worldwide.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type CvSection = {
  kind: "name" | "headline" | "contact" | "summary" | "experience" | "education" | "skills" | "projects" | "languages" | "certifications" | "unknown";
  lines: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_HEADERS: Record<string, CvSection["kind"]> = {
  // ── Summary ─────────────────────────────────────────────────────────────
  "summary": "summary", "profile": "summary", "professional summary": "summary",
  "profile summary": "summary", "about me": "summary", "objective": "summary",
  "career objective": "summary", "personal statement": "summary",
  // German
  "berufliches profil": "summary", "über mich": "summary", "ziel": "summary",
  "profilübersicht": "summary", "berufsprofil": "summary", "profil": "summary",
  "profiltübersicht": "summary", "kurzprofil": "summary",
  // French
  "résumé": "summary", "présentation": "summary",
  "à propos": "summary", "objectif": "summary", "profil professionnel": "summary",
  // Spanish
  "perfil": "summary", "resumen": "summary", "sobre mí": "summary",
  "objetivo": "summary", "perfil profesional": "summary",
  // Italian
  "profilo": "summary", "obiettivo": "summary", "chi sono": "summary",
  // Dutch
  "profiel": "summary", "samenvatting": "summary", "over mij": "summary",
  // Polish
  "profil zawodowy": "summary", "cel zawodowy": "summary",
  // Compacted spaced-caps variants
  "profilesummary": "summary", "professionalsummary": "summary", "aboutme": "summary",
  "careerobjective": "summary", "personalstatement": "summary",
  "beruflichesprofil": "summary",

  // ── Experience ──────────────────────────────────────────────────────────
  "experience": "experience", "work experience": "experience",
  "professional experience": "experience", "employment history": "experience",
  "employment": "experience", "work history": "experience",
  "career history": "experience", "positions": "experience",
  // German
  "berufserfahrung": "experience", "werdegang": "experience", "praktika": "experience",
  "beruflicher werdegang": "experience", "tätigkeiten": "experience",
  // French
  "expérience professionnelle": "experience", "expérience": "experience",
  "parcours professionnel": "experience", "emplois": "experience",
  // Spanish
  "experiencia laboral": "experience", "experiencia profesional": "experience",
  "experiencia": "experience", "trayectoria profesional": "experience",
  // Italian
  "esperienza lavorativa": "experience", "esperienza professionale": "experience",
  "esperienza": "experience", "carriera": "experience",
  // Dutch
  "werkervaring": "experience", "beroepservaring": "experience",
  "loopbaan": "experience", "carrière": "experience",
  // Polish
  "doświadczenie zawodowe": "experience", "doświadczenie": "experience",
  // Compacted variants
  "workexperience": "experience", "professionalexperience": "experience",
  "employmenthistory": "experience", "workhistory": "experience",
  "careerhistory": "experience",

  // ── Education ──────────────────────────────────────────────────────────
  "education": "education", "academic background": "education",
  "qualifications": "education", "academic qualifications": "education",
  "studies": "education", "training": "education", "degrees": "education",
  // German
  "bildung": "education", "ausbildung": "education", "bildungsweg": "education",
  "studium": "education", "qualifikationen": "education", "schulbildung": "education",
  // French
  "formation": "education", "études": "education", "diplômes": "education",
  "parcours académique": "education",
  // Spanish
  "formación académica": "education", "educación": "education",
  "estudios": "education", "titulación": "education",
  // Italian
  "formazione": "education", "istruzione": "education", "studi": "education",
  "titoli di studio": "education",
  // Dutch
  "opleiding": "education", "onderwijs": "education", "studie": "education",
  // Polish
  "wykształcenie": "education", "edukacja": "education",
  // Compacted variants
  "academicbackground": "education", "academicqualifications": "education",

  // ── Skills ──────────────────────────────────────────────────────────────
  "skills": "skills", "technical skills": "skills", "core skills": "skills",
  "competencies": "skills", "expertise": "skills", "key skills": "skills",
  "tech skills": "skills", "technologies": "skills", "tools": "skills",
  "core competencies": "skills", "capabilities": "skills",
  // German
  "kenntnisse": "skills", "fertigkeiten": "skills", "it-kenntnisse": "skills",
  "fähigkeiten": "skills", "kompetenzen": "skills", "kernkompetenzen": "skills",
  "it-skills": "skills", "technische kenntnisse": "skills",
  // French
  "compétences": "skills", "aptitudes": "skills", "savoir-faire": "skills",
  "compétences techniques": "skills",
  // Spanish
  "habilidades": "skills", "competencias": "skills", "conocimientos": "skills",
  "habilidades técnicas": "skills",
  // Italian
  "competenze": "skills", "abilità": "skills", "capacità": "skills",
  // Dutch
  "vaardigheden": "skills", "competenties": "skills", "kennis": "skills",
  // Polish
  "umiejętności": "skills", "kompetencje": "skills",
  // Compacted variants
  "technicalskills": "skills", "coreskills": "skills", "keyskills": "skills",
  "techskills": "skills", "corecompetencies": "skills",

  // ── Projects ────────────────────────────────────────────────────────────
  "projects": "projects", "selected projects": "projects",
  "personal projects": "projects", "key projects": "projects",
  "portfolio": "projects", "project highlights": "projects",
  "side projects": "projects", "academic projects": "projects",
  "bootcamp projects": "projects", "case studies": "projects",
  "notable projects": "projects", "relevant projects": "projects",
  // German
  "projekte": "projects", "ausgewählte projekte": "projects",
  "persönliche projekte": "projects", "eigenentwicklungen": "projects",
  // French
  "projets": "projects", "projets personnels": "projects",
  "réalisations": "projects", "travaux": "projects",
  // Spanish
  "proyectos": "projects", "proyectos personales": "projects",
  "trabajos": "projects",
  // Italian
  "progetti": "projects", "progetti personali": "projects",
  "lavori": "projects",
  // Dutch
  "projecten": "projects", "eigen projecten": "projects",
  // Polish
  "projekty": "projects",
  // Compacted variants
  "selectedprojects": "projects", "personalprojects": "projects",
  "keyprojects": "projects", "projecthighlights": "projects",
  "sideprojects": "projects", "academicprojects": "projects",
  "bootcampprojects": "projects", "casestudies": "projects",

  // ── Languages ───────────────────────────────────────────────────────────
  "languages": "languages", "language skills": "languages",
  "spoken languages": "languages",
  // German
  "sprachen": "languages", "sprachkenntnisse": "languages",
  // French
  "langues": "languages", "compétences linguistiques": "languages",
  // Spanish
  "idiomas": "languages", "lenguas": "languages",
  // Italian
  "lingue": "languages", "lingue straniere": "languages",
  // Dutch
  "talen": "languages", "talenkennis": "languages",
  // Polish
  "języki": "languages", "znajomość języków": "languages",
  // Compacted variants
  "languageskills": "languages", "spokenlanguages": "languages",

  // ── Certifications ──────────────────────────────────────────────────────
  "certifications": "certifications", "certificates": "certifications",
  "accreditations": "certifications", "licences": "certifications",
  "licenses": "certifications", "awards": "certifications",
  "achievements": "certifications",
  // Multi-word variants — these exact phrases appeared in real CVs and were missed
  "awards and certifications": "certifications",
  "awards and certification": "certifications",
  "awards & certifications": "certifications",
  "awards & certification": "certifications",
  "certifications and awards": "certifications",
  "honours and awards": "certifications",
  "honors and awards": "certifications",
  "short courses": "certifications",
  "short course": "certifications",
  "courses and training": "certifications",
  "professional development": "certifications",
  "professional development and certifications": "certifications",
  "continuing education": "certifications",
  "additional training": "certifications",
  "training and certifications": "certifications",
  "licences and certifications": "certifications",
  "licenses and certifications": "certifications",
  // German
  "zertifikate": "certifications", "auszeichnungen": "certifications",
  "zertifizierungen": "certifications", "weiterbildungen": "certifications",
  // French
  "certificats": "certifications",
  "distinctions": "certifications", "récompenses": "certifications",
  // Spanish
  "certificaciones": "certifications", "logros": "certifications",
  "premios": "certifications",
  // Italian
  "certificazioni": "certifications", "premi": "certifications",
  // Dutch
  "certificaten": "certifications", "onderscheidingen": "certifications",
  // Polish
  "certyfikaty": "certifications", "nagrody": "certifications",
};

// Lines that are almost certainly sidebar artefacts
const SIDEBAR_LINE_RE = /^(english|german|dutch|french|spanish|italian|portuguese|mandarin|hindi|arabic|russian|japanese|korean|deutsch)[\s:–-]+(fluent|native|conversational|b1|b2|c1|c2|a1|a2|professional|elementary|intermediate|advanced|muttersprache|fließend)/i;

// Lines that strongly indicate a name (first line of CV)
const LOOKS_LIKE_NAME_RE = /^(?:[A-ZÀ-Ý][a-zà-ÿ]+|[A-ZÀ-Ý]{2,})(?:[\s-](?:[A-ZÀ-Ý][a-zà-ÿ]+|[A-ZÀ-Ý]{2,})){1,3}$/u;

// Contact line heuristic
const CONTACT_LINE_RE = /@|linkedin\.com|^\+?[\d\s().-]{8,}$|^\d{5}\b|\bstraße\b|\bstrasse\b|\bstreet\b|\bavenue\b|\broad\b|\bdr\b\.|^\d+\s+[A-Z]/i;

// Date range — indicates an experience or education entry header
const DATE_RANGE_RE = /\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}|present|current|heute|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(19|20)\d{2}/i;

// Bullet character normalisation
const BULLET_CHARS = /^[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB•▪◦‣·∙◆◇*>]\s*/;

// ── Text normalisation ────────────────────────────────────────────────────────

export function normalizeExtractedCvText(raw: string): string {
  return raw
    // Null bytes and carriage returns
    .replace(/\x00/g, " ")
    .replace(/\r\n?/g, "\n")
    // Unicode quotes → ASCII
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Common dash encoding artefacts
    .replace(/â€[""]/g, "—")
    .replace(/â€"|â€"/g, "–")
    .replace(/â€¢|â€¢/g, "•")
    // Non-breaking space
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    // Bullet character normalisation
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB▪◦‣·∙◆◇]/g, "•")
    // Spaced capitals in decorative headers/names
    .split("\n").map((line) => {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length < 4 || !tokens.every((t) => /^[A-Z]$/.test(t))) return line;
      const compact = tokens.join("");

      const KNOWN_SECTIONS = new Set([
        // English
        "SKILLS","CONTACT","EDUCATION","EXPERIENCE","LANGUAGES","PROJECTS",
        "REFERENCES","CERTIFICATIONS","SUMMARY","PROFILE","AWARDS","ACHIEVEMENTS",
        "PORTFOLIO","COMPETENCIES","EXPERTISE","TRAINING","QUALIFICATIONS",
        "WORKEXPERIENCE","PROFILESUMMARY","CORECOMPETENCIES","PUBLICATIONS",
        "CAREERHISTORY","EMPLOYMENTHISTORY","KEYSKILLS","TECHNICALSKILLS",
        "SELECTEDPROJECTS","PERSONALPROJECTS","ACADEMICPROJECTS","CASESTUDIES",
        "SIDEPROJECTS","BOOTCAMPPROJECTS","NOTABLEPROJECTS","KEYPROJECTS",
        // German
        "BERUFSERFAHRUNG","BILDUNGSWEG","BILDUNG","SPRACHEN","KENNTNISSE",
        "AUSBILDUNG","FÄHIGKEITEN","KOMPETENZEN","KERNKOMPETENZEN","ZERTIFIKATE",
        "AUSZEICHNUNGEN","WERDEGANG","PROFIL","PROFILÜBERSICHT","BERUFSPROFIL",
        "PROJEKTE","BERUFLICHESPROFIL","ZERTIFIZIERUNGEN","WEITERBILDUNGEN",
        "SPRACHKENNTNISSE","EIGENENTWICKLUNGEN","KURZPROFIL","TÄTIGKEITEN",
        // French
        "FORMATION","EXPÉRIENCE","COMPÉTENCES","LANGUES","PROJETS","CERTIFICATIONS",
        "DIPLÔMES","RÉALISATIONS","TRAVAUX","DISTINCTIONS","RÉSUMÉ","PRÉSENTATION",
        "APTITUDES","PARCOURSPROFESSIONNEL","COMPÉTENCESTECHNIQUES","CERTIFICATS",
        // Spanish
        "EDUCACIÓN","EXPERIENCIA","HABILIDADES","IDIOMAS","PROYECTOS","LOGROS",
        "FORMACIÓN","COMPETENCIAS","CONOCIMIENTOS","CERTIFICACIONES","PERFIL",
        "EXPERIENCIALABORAL","FORMACIÓNCADÉMICA","HABILIDADESTÉCNICAS",
        // Italian
        "FORMAZIONE","ESPERIENZA","COMPETENZE","LINGUE","PROGETTI","CERTIFICAZIONI",
        "ISTRUZIONE","CAPACITÀ","ABILITÀ","PROFILO","ESPERIENZALAVORATIVA",
        "ESPERIENZAPROFESSIONALE","TITOLIDISTUDIO",
        // Dutch
        "OPLEIDING","WERKERVARING","VAARDIGHEDEN","TALEN","PROJECTEN","CERTIFICATEN",
        "ONDERWIJS","COMPETENTIES","KENNIS","PROFIEL","SAMENVATTING","LOOPBAAN",
        "BEROEPSERVARING","CARRIÈRE","TALENKENNIS","EIGENPROJECTEN",
        // Polish
        "WYKSZTAŁCENIE","DOŚWIADCZENIE","UMIEJĘTNOŚCI","JĘZYKI","PROJEKTY",
        "CERTYFIKATY","EDUKACJA","KOMPETENCJE","DOŚWIADCZENIEZAWODOWE",
      ]);
      if (KNOWN_SECTIONS.has(compact)) return compact;

      const DEPT_PREFIXES = new Set(["PR","HR","IT","VP","UI","UX","BD","CX","QA","AI","ML",
        "BI","PM","SM","GM","IR","CR","GR","DC","SEO","CTO","CEO","CFO","COO","CMO","CRO"]);

      const ROLES = ["MANAGER","SPECIALIST","ENGINEER","ANALYST","DIRECTOR","COORDINATOR",
        "CONSULTANT","DEVELOPER","DESIGNER","ASSISTANT","EXECUTIVE","OFFICER","INTERN",
        "ADMINISTRATOR","ARCHITECT","SUPERVISOR","TECHNICIAN","RECRUITER","ACCOUNTANT",
        "STRATEGIST","REPRESENTATIVE","ADVISOR","PLANNER","ASSOCIATE","SCIENTIST",
        "RESEARCHER","PROGRAMMER","WRITER","EDITOR","PRODUCER","CONTROLLER"];

      for (const role of ROLES) {
        if (!compact.endsWith(role)) continue;
        const beforeRole = compact.slice(0, compact.length - role.length);
        for (let pLen = 2; pLen <= 3; pLen++) {
          if (beforeRole.length - pLen < 3) continue;
          const prefix = beforeRole.slice(-pLen);
          if (DEPT_PREFIXES.has(prefix)) {
            const name = beforeRole.slice(0, beforeRole.length - pLen);
            return name + "\n" + prefix + " " + role;
          }
        }
        if (beforeRole.length >= 3) return beforeRole + "\n" + role;
      }

      if (compact.length <= 10) return compact;

      const KNOWN_WORD_SET = new Set([
        "IT","HR","PR","UX","UI","QA","AI","ML","BI","VP","CEO","CTO","CFO","COO","CMO",
        "PROJECT","SENIOR","JUNIOR","LEAD","HEAD","CHIEF","PRINCIPAL","ASSOCIATE",
        "MANAGER","SPECIALIST","ENGINEER","ANALYST","DIRECTOR","COORDINATOR","DESIGNER",
        "DEVELOPER","CONSULTANT","ASSISTANT","EXECUTIVE","OFFICER","ARCHITECT","SUPERVISOR",
        "TECHNICIAN","RECRUITER","ACCOUNTANT","STRATEGIST","RESEARCHER","PROGRAMMER",
        "ADVISOR","PLANNER","TRAINER","INSTRUCTOR","PROFESSOR","TEACHER","SCIENTIST",
        "PRODUCT","DIGITAL","TECHNICAL","MARKETING","SALES","DATA","CLOUD","SOFTWARE",
        "HARDWARE","BUSINESS","BRAND","CREATIVE","GRAPHIC","MOTION","WEB","MOBILE",
        "FRONT","BACK","END","DEVOPS","SECURITY","NETWORK","SYSTEMS","OPERATIONS",
        "HUMAN","RESOURCES","FINANCE","LEGAL","CUSTOMER","SUCCESS","ACCOUNT","GROWTH",
        "CONTENT","SOCIAL","MEDIA","PUBLIC","RELATIONS","INFORMATION","TECHNOLOGY",
        "WORK","EXPERIENCE","EDUCATION","TRAINING","SKILLS","OVERVIEW","SUMMARY",
        "AWARDS","RECEIVED","CONTACTS","LANGUAGES","PROJECTS","CERTIFICATIONS",
        "AND","OF","IN","THE","FOR","WITH","AT","TO",
        "PROFESSIONAL","PERSONAL","TEAM","ACADEMIC","HISTORY","ACHIEVEMENT","INTEREST",
        "VOLUNTEERING","VOLUNTEER","HOBBY","HOBBIES","REFERENCE","PROFILE","ABOUT",
      ]);

      function splitIntoKnownWords(str: string): string | null {
        const n = str.length;
        const dp: (string[] | null)[] = new Array(n + 1).fill(null);
        dp[0] = [];
        for (let i = 0; i < n; i++) {
          if (dp[i] === null) continue;
          for (let len = 2; len <= Math.min(20, n - i); len++) {
            const word = str.slice(i, i + len);
            if (KNOWN_WORD_SET.has(word) && dp[i + len] === null) {
              dp[i + len] = [...(dp[i] as string[]), word];
            }
          }
        }
        return dp[n] ? (dp[n] as string[]).join(" ") : null;
      }

      const reconstructed = splitIntoKnownWords(compact);
      if (reconstructed) return reconstructed;

      return line;
    }).join("\n")
    // Collapse mixed-case spaced text
    .split("\n").map((line) => {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length >= 6
        && tokens.every((t) => t.length >= 1 && t.length <= 3)
        && !tokens.every((t) => /^[A-Z]$/.test(t))
        && tokens.some((t) => /^[A-Z]/.test(t))
        && tokens.some((t) => /[a-z]/.test(t))
      ) {
        const joined = tokens.join("");
        if (/^[A-Za-z]+$/.test(joined)) return joined;
      }
      return line;
    }).join("\n")
    // Standard validation spelling and typo mapping normalization
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bEngince\b/gi, "Engine")
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\bScrapping\b/gi, "Scraping")
    .replace(/\bAnalisys\b/gi, "Analysis")
    .replace(/\bVizualization\b/gi, "Visualization")
    .replace(/\bVIZUALIZATION\b/gi, "Visualization")
    .replace(/\bMy\s+SQL\b/gi, "MySQL")
    .replace(/\bNum\s*Py\b/gi, "NumPy")
    .replace(/\bYou\s*Tube\b/gi, "YouTube")
    .replace(/\bText\s*Blob\b/gi, "TextBlob")
    .replace(/\bLang\s*Cha?in\b/gi, "LangChain")
    .replace(/\bManage\s*Eng?ine?\b/gi, "ManageEngine")
    .replace(/\bService\s*Desk\s*Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bWürzburg|WÃ¼rzburg|WˆRZBURG|Wˆ…rzburg/g, "Würzburg")
    .replace(/\bWuerzburg\b/gi, "Würzburg")
    .replace(/\bWurzburg\b/gi, "Würzburg")
    .replace(/([a-z])([A-Z]{2,})/g, (_, a, b) => {
      if (b.length <= 3) return _ ;
      return `${a} ${b}`;
    })
    .replace(/([a-z]{3,})([A-Z][a-z])/g, "$1 $2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Section detection ─────────────────────────────────────────────────────────

function isSectionHeader(line: string): CvSection["kind"] | null {
  const trimmed = line.trim();
  if (/\.$/.test(trimmed) && trimmed.split(/\s+/).length > 1) return null;
  if (trimmed.split(/\s+/).length > 5) return null;

  const clean = trimmed
    .toLowerCase()
    .replace(/[:\-–—]+$/, "")
    .replace(/^[•\-\*]\s*/, "")
    .replace(/\.$/, "")
    .trim();

  if (SECTION_HEADERS[clean]) return SECTION_HEADERS[clean];

  // BUG FIX: spaced-caps collapser (normalizeExtractedCvText) joins
  // "W O R K E X P E R I E N C E" → "WORKEXPERIENCE" (no space) which
  // doesn't match "work experience" in SECTION_HEADERS. Try matching
  // after removing all spaces from the clean string.
  const nospace = clean.replace(/\s+/g, "");
  if (SECTION_HEADERS[nospace]) return SECTION_HEADERS[nospace];

  for (const [key, kind] of Object.entries(SECTION_HEADERS)) {
    if (clean.startsWith(key)) return kind;
  }
  return null;
}

function isSectionHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (/\.$/.test(trimmed) && trimmed.split(" ").length > 1) return false;
  if (/^([A-Z][a-z]+ ){2,}/.test(trimmed) && !Object.keys(SECTION_HEADERS).some(k => trimmed.toLowerCase().startsWith(k))) return false;

  if (isSectionHeader(trimmed)) return true;
  const upper = trimmed.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  if (upper.length < 4 || upper.length > 40) return false;
  return Boolean(isSectionHeader(upper.toLowerCase()));
}

// ── Multi-column rebuild ──────────────────────────────────────────────────────

function detectsSidebarFirstOrder(lines: string[]): boolean {
  const first40pct = lines.slice(0, Math.ceil(lines.length * 0.4));
  const last60pct = lines.slice(Math.ceil(lines.length * 0.4));

  const skillHeaderInFirst = first40pct.some(l => /^(skills|expertise|competencies|languages|contact|kenntnisse|sprachen)$/i.test(l.trim()));
  const experienceInLast = last60pct.some(l => /^(experience|work experience|workexperience|professional experience|professionalexperience|employment history|employmenthistory|berufserfahrung)$/i.test(l.trim()));

  const dateLinesInFirst = first40pct.filter(l => DATE_RANGE_RE.test(l)).length;
  const dateLinesInLast = last60pct.filter(l => DATE_RANGE_RE.test(l)).length;

  const nameOrTitleInLast = last60pct.some(l => {
    const t = l.trim();
    return /^[A-Z][A-Z\s]{1,24}$/.test(t) && t.split(/\s+/).length <= 3 && t.length >= 3;
  });

  return (skillHeaderInFirst && experienceInLast)
      || (dateLinesInFirst === 0 && dateLinesInLast >= 2)
      || (dateLinesInFirst >= 2 && nameOrTitleInLast);
}

function rebuildReadingOrder(lines: string[]): string[] {
  const result: string[] = [];
  const sidebarContent: string[] = [];
  const mainContent: string[] = [];
  let nameLines: string[] = [];

  let currentKind: CvSection["kind"] = "unknown";
  let buffer: string[] = [];
  let hasSeenMainSection = false;
  // Track consecutive section headers with no content between them.
  // When many PDF two-column layouts are extracted, the column headers from
  // both columns appear together at the top (e.g. SKILLS, CONTACT,
  // BERUFSERFAHRUNG, AUSBILDUNG all in a row) before any actual content.
  // If we naively assign 'experience' kind when we see BERUFSERFAHRUNG,
  // then the education bullets that follow go into the experience buffer
  // causing date/bullet misattribution. Guard: track "pending" headers and
  // only commit currentKind when real content (non-header, non-blank) arrives.
  let pendingKinds: CvSection["kind"][] = [];
  let headerStreakCount = 0;

  function flushBuffer() {
    if (!buffer.length) return;
    const isSidebarSection = ["skills", "languages", "certifications", "contact"].includes(currentKind);
    const isEducation = currentKind === "education";

    if (currentKind === "unknown" && !hasSeenMainSection) {
      sidebarContent.push(...buffer);
    } else if (["summary", "experience", "projects"].includes(currentKind)) {
      hasSeenMainSection = true;
      mainContent.push(...buffer);
    } else if (currentKind === "unknown") {
      mainContent.push(...buffer);
    } else if (isSidebarSection) {
      sidebarContent.push(...buffer);
    } else if (isEducation) {
      mainContent.push(...buffer);
    }
    buffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      buffer.push("");
      continue;
    }

    const kind = isSectionHeader(trimmed);
    if (kind) {
      flushBuffer();
      headerStreakCount++;
      if (headerStreakCount >= 3) {
        // Three or more consecutive section headers = interleaved multi-column
        // header burst. Queue this kind instead of committing immediately —
        // the correct kind for this chunk will be resolved when content arrives.
        pendingKinds.push(kind);
        buffer.push(trimmed);
      } else {
        currentKind = kind;
        buffer.push(trimmed);
      }
      continue;
    }

    // Real content arrived — resolve any pending kind
    if (pendingKinds.length > 0) {
      // The most recently seen structural header (experience/summary/projects)
      // is most likely the correct section for this content. If none, use last pending.
      const mainKind = [...pendingKinds].reverse().find(k =>
        ["experience", "summary", "projects"].includes(k)
      ) || pendingKinds[pendingKinds.length - 1];
      currentKind = mainKind;
      pendingKinds = [];
    }
    headerStreakCount = 0;

    const looksLikeName = nameLines.length === 0
      && LOOKS_LIKE_NAME_RE.test(trimmed)
      && !CONTACT_LINE_RE.test(trimmed)
      && (currentKind === "unknown" || currentKind === "skills" || currentKind === "contact")
      && !/\b(productions|industries|solutions|services|systems|technologies|group|inc|ltd|llc|gmbh|ag|university|universität|college|school|institute|foundation|agency|studio|studios|consulting|ventures|partners|associates|corporation|corp|company|co\.)$/i.test(trimmed);
    
    if (looksLikeName) {
      nameLines = [trimmed];
      continue;
    }

    buffer.push(trimmed);
  }

  flushBuffer();

  if (nameLines.length) result.push(...nameLines, "");
  if (mainContent.length) result.push(...mainContent);
  if (sidebarContent.length) result.push("", ...sidebarContent);

  return result;
}

function normaliseBullets(text: string): string {
  return text
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (BULLET_CHARS.test(trimmed)) {
        return "- " + trimmed.replace(BULLET_CHARS, "").trim();
      }
      return line;
    })
    .join("\n");
}

function deduplicateLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  let blankCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blankCount++;
      if (blankCount <= 2) out.push("");
      continue;
    }

    blankCount = 0;
    const key = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const isShortRepeatableLabel = trimmed.length < 50;
    if (key.length > 3 && seen.has(key) && !isShortRepeatableLabel) continue;
    if (key.length > 3 && !isShortRepeatableLabel) seen.add(key);
    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function mergeConsecutiveNameLines(text: string): string {
  const lines = text.split("\n");
  const TOP_LINES = 15;

  const SECTION_HEADERS_NAME = new Set([
    // English
    "SKILLS","CONTACT","EDUCATION","EXPERIENCE","LANGUAGES","PROJECTS",
    "REFERENCES","CERTIFICATIONS","SUMMARY","PROFILE","ABOUT","ABOUTME",
    "AWARDS","ACHIEVEMENTS","PROFIL","COMPETENCIES","EXPERTISE","ME",
    "PORTFOLIO","TRAINING","QUALIFICATIONS","PUBLICATIONS","CAREERHISTORY",
    // German
    "BERUFSERFAHRUNG","BILDUNGSWEG","BILDUNG","SPRACHEN","KENNTNISSE",
    "AUSBILDUNG","FÄHIGKEITEN","KOMPETENZEN","KERNKOMPETENZEN","ZERTIFIKATE",
    "AUSZEICHNUNGEN","WERDEGANG","PROFILÜBERSICHT","BERUFSPROFIL","PROJEKTE",
    "ZERTIFIZIERUNGEN","WEITERBILDUNGEN","SPRACHKENNTNISSE","KURZPROFIL",
    // French
    "FORMATION","EXPÉRIENCE","COMPÉTENCES","LANGUES","DIPLÔMES","CERTIFICATIONS",
    "RÉSUMÉ","PRÉSENTATION","APTITUDES","RÉALISATIONS","TRAVAUX",
    // Spanish
    "EDUCACIÓN","EXPERIENCIA","HABILIDADES","IDIOMAS","PROYECTOS","LOGROS",
    "FORMACIÓN","COMPETENCIAS","CONOCIMIENTOS","CERTIFICACIONES",
    // Italian
    "FORMAZIONE","ESPERIENZA","COMPETENZE","LINGUE","PROGETTI","CERTIFICAZIONI",
    "ISTRUZIONE","CAPACITÀ","ABILITÀ",
    // Dutch
    "OPLEIDING","WERKERVARING","VAARDIGHEDEN","TALEN","PROJECTEN","CERTIFICATEN",
    "ONDERWIJS","COMPETENTIES","KENNIS","SAMENVATTING","LOOPBAAN",
    // Polish
    "WYKSZTAŁCENIE","DOŚWIADCZENIE","UMIEJĘTNOŚCI","JĘZYKI","PROJEKTY","CERTYFIKATY",
  ]);
  const ROLE_WORD_NAME = /^(MANAGER|SPECIALIST|ENGINEER|ANALYST|DIRECTOR|DESIGNER|DEVELOPER|CONSULTANT|COORDINATOR|ASSISTANT|EXECUTIVE|OFFICER|INTERN|ARCHITECT|SUPERVISOR|TECHNICIAN|RECRUITER|ACCOUNTANT|TEACHER|INSTRUCTOR|PROFESSOR|DOCTOR|NURSE|PROGRAMMER|WRITER|EDITOR|PRODUCER|CONTROLLER|ASSOCIATE|SCIENTIST|RESEARCHER|ADVISOR|PLANNER|TRAINER|TUTOR|LECTURER|PRINCIPAL|COUNSELOR)$/;

  function looksLikeNamePart(line: string): boolean {
    const t = line.trim();
    if (!t || t.length < 2 || t.length > 20) return false;
    if (!/^[A-ZÄÖÜ\-]+$/.test(t)) return false;
    if (SECTION_HEADERS_NAME.has(t)) return false;
    if (ROLE_WORD_NAME.test(t)) return false;
    if (/\d/.test(t)) return false;
    return true;
  }

  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (i >= TOP_LINES) {
      result.push(...lines.slice(i));
      break;
    }

    const nameParts: string[] = [];
    const startI = i;
    while (i < lines.length && i < startI + 3 && nameParts.length < 3 && looksLikeNamePart(lines[i])) {
      nameParts.push(lines[i].trim());
      i++;
    }

    if (nameParts.length >= 2) {
      result.push(nameParts.join(" "));
    } else {
      if (nameParts.length === 1) result.push(nameParts[0]);
      if (i < lines.length) {
        result.push(lines[i]);
        i++;
      }
    }
  }

  return result.join("\n");
}

function rebuildContentBeforeHeader(lines: string[]): string[] {
  let headerStart = -1;
  let headerEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    if (
      /^[A-Z][A-Z\s]{1,30}$/.test(t)
      && t.split(/\s+/).length <= 4
      && t.length >= 2
      && !DATE_RANGE_RE.test(t)
      && !t.includes("|")
      && !t.includes("•")
    ) {
      const surrounding = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4));
      const hasContact = surrounding.some(l => /@|\+\d|www\./.test(l));
      const hasAnotherHeader = surrounding.some((l, j) => {
        if (j === 0 && l === lines[i]) return false;
        const st = l.trim();
        return /^[A-Z][A-Z\s]{1,30}$/.test(st) && st.split(/\s+/).length <= 4 && st.length >= 2 && !DATE_RANGE_RE.test(st);
      });

      if (hasContact || hasAnotherHeader) {
        headerStart = i;
        while (headerStart > 0) {
          const prev = lines[headerStart - 1].trim();
          if (/^[A-Z][A-Z\s]{1,30}$/.test(prev) && prev.split(/\s+/).length <= 4 && !DATE_RANGE_RE.test(prev) && !prev.includes("|")) {
            headerStart--;
          } else {
            break;
          }
        }
        headerEnd = i;
        while (headerEnd < lines.length - 1) {
          const next = lines[headerEnd + 1].trim();
          if (
            /@|\+\d|www\./.test(next)
            || (/^[A-Z][A-Z\s]{1,30}$/.test(next) && !DATE_RANGE_RE.test(next) && !next.includes("|"))
            || /^(professional summary|work experience|academic history|awards|certification|berufliches profil|berufserfahrung)$/i.test(next)
          ) {
            headerEnd++;
          } else {
            break;
          }
        }
        break;
      }
    }
  }

  if (headerStart === -1) return lines;

  const headerBlock = lines.slice(headerStart, headerEnd + 1);
  const beforeHeader = lines.slice(0, headerStart);
  const afterHeader = lines.slice(headerEnd + 1);

  return [...headerBlock, "", ...beforeHeader, ...afterHeader];
}

function mergeTruncatedLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : "";

    const deduped = line.replace(/^(.{8,})\s*[•·|]\s*\1$/i, "$1").trim();
    const truncationEndings = /\b(and|or|the|a|an|for|in|to|with|by|of|at|from|on|using|via|into|through|within|und|oder|für|mit|von|bei|zu|auf)$/i;
    const nextIsContact = /^[@+]|@|www\.|http|linkedin|\d{5,}|^\d.*@/i.test(next || "");
    const lineIsTruncated = !nextIsContact && (
      truncationEndings.test(deduped.replace(/[.,]$/, "").trim())
      || (deduped.length > 10 && !deduped.match(/[.!?:;]$/) && next && /^[a-zäöü]/.test(next))
    );

    if (lineIsTruncated && next && next.length > 0 && !isSectionHeaderLine(next)) {
      const separator = deduped.endsWith(",") || deduped.endsWith("-") ? "" : " ";
      result.push(deduped.trimEnd() + separator + next.trimStart());
      i++;
    } else {
      result.push(deduped);
    }
  }
  return result.join("\n");
}

// ── Main exports ───────────────────────────────────────────────────────────────

export function cleanExtractedCvText(rawText: string): string {
  if (!rawText?.trim()) return "";

  let text = normalizeExtractedCvText(rawText);
  let lines = text.split("\n").map(l => l.trim());

  if (detectsSidebarFirstOrder(lines)) {
    const first40pct = lines.slice(0, Math.ceil(lines.length * 0.4));
    const dateLinesInFirst = first40pct.filter(l => DATE_RANGE_RE.test(l)).length;

    if (dateLinesInFirst >= 2) {
      lines = rebuildContentBeforeHeader(lines);
    } else {
      lines = rebuildReadingOrder(lines);
    }
    text = lines.join("\n");
  }

  text = mergeConsecutiveNameLines(text);
  text = mergeTruncatedLines(text);
  text = normaliseBullets(text);
  text = deduplicateLines(text);

  return text;
}

export function cleanCvHeadline(headline: string, firstJobTitle?: string, summary = ""): string {
  const h = headline.trim();
  if (!h) return firstJobTitle || "Professional";

  const isCompanyString =
    /\b(gmbh|ag|ltd|llc|inc|corp|plc|bv|gbr|ug|kg|sarl|sas|bvba|nv|oy|as|ab)\b/i.test(h) ||
    /^[A-Z][\w\s]+ [-–] [A-Z][\w\s]+, [A-Z]/u.test(h);

  if (isCompanyString) {
    if (firstJobTitle && firstJobTitle.length > 2 && firstJobTitle.length < 60) {
      return firstJobTitle.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const roleWords = [
      "engineer", "designer", "developer", "architect", "scientist", "manager",
      "specialist", "analyst", "consultant", "officer", "lead", "director",
      "technician", "coordinator", "administrator", "support"
    ];
    for (const word of roleWords) {
      const rx = new RegExp(
        `\\b((?:Product |Senior |Junior |Lead |Principal |CAD |Design |IT |Cloud |Data )?${word})\\b`,
        "i"
      );
      const m = summary.match(rx);
      if (m) return m[0].replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Professional";
  }

  return h;
}