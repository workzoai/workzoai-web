/*
 * WorkZo AI — Global Free Tools Registry
 * ---------------------------------------
 * SINGLE SOURCE OF TRUTH for every free career tool.
 *
 * Everything that lists, links to, or describes a free tool imports from here:
 * landing page, dashboard, navigation, footer, pricing, mobile menu, the
 * /tools SEO pages, and the /api/free-tools backend. Nothing duplicates this
 * list.
 *
 * To add a new tool, append one object to FREE_TOOLS. It then appears
 * automatically in pricing, footer, navigation, dashboard, landing page,
 * mobile menu, the /tools index, its own SEO page, and the API allow-list.
 *
 * IMPORTANT: this module is intentionally free of JSX and icon imports so it
 * can be imported from server API routes (node runtime) without pulling in
 * lucide-react. UI code maps `icon` (a string name) to a component via
 * components/marketing/freeToolIcons.tsx.
 */

/** Icon names resolved to lucide components in freeToolIcons.tsx. */
export type FreeToolIconName =
  | "FileSearch"
  | "Sparkles"
  | "FileText"
  | "MessageCircle";

/** Engine action understood by lib/workzoFreeToolsEngine.ts. */
export type FreeToolAction =
  | "cv_review"
  | "resume_tailor"
  | "cover_letter"
  | "interview_questions";

export type FreeToolStep = { title: string; description: string };
export type FreeToolBenefit = { title: string; description: string };
export type FreeToolFaq = { q: string; a: string };

/** One input in a free tool's inline runner form. `name` must match a key of
 *  FreeToolInput in lib/workzoFreeToolsEngine.ts (e.g. cvText, jobDescription). */
export type FreeToolField = {
  name: "cvText" | "jobDescription" | "targetRole" | "companyName";
  label: string;
  type: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
};

export type FreeTool = {
  /** Stable id and URL slug (kept identical). */
  id: string;
  /** Full marketing title, e.g. "Free CV Review". */
  title: string;
  /** Compact label for tight spots (nav, dashboard, mobile), e.g. "Resume Tailor". */
  shortTitle: string;
  /** One-line description used on cards and menus. */
  description: string;
  /** Icon name resolved in the UI layer. */
  icon: FreeToolIconName;
  /** Small pill shown on cards/menus. */
  badge: string;
  /** Public SEO page, e.g. "/tools/cv-review". */
  href: string;
  /** Backend endpoint, e.g. "/api/free-tools/cv-review". */
  apiPath: string;
  /** Engine action for the shared /api/free-tools route. */
  action: FreeToolAction;

  /* ---- SEO landing page content (Hero, How it works, Benefits, FAQ, CTA) ---- */
  seo: { title: string; description: string; keywords: string[] };
  hero: { eyebrow: string; heading: string; subheading: string; primaryCta: string };
  howItWorks: FreeToolStep[];
  benefits: FreeToolBenefit[];
  faqs: FreeToolFaq[];
  cta: { heading: string; subheading: string; primaryLabel: string; primaryHref: string };
};

export const FREE_TOOLS: FreeTool[] = [
  {
    id: "cv-review",
    title: "Free CV Review",
    shortTitle: "Free CV Review",
    description:
      "Get instant AI feedback on your CV with actionable improvements.",
    icon: "FileSearch",
    badge: "FREE",
    href: "/cv",
    apiPath: "/api/free-tools/cv-review",
    action: "cv_review",
    seo: {
      title: "Free CV Review — Instant AI Feedback on Your CV | WorkZo AI",
      description:
        "Paste your CV and get instant, structured feedback: readability, keyword coverage, missing sections, and concrete improvements. Free, no signup required.",
      keywords: [
        "free cv review",
        "cv checker",
        "resume review",
        "ats cv checker",
        "cv feedback",
      ],
    },
    hero: {
      eyebrow: "Free CV Review",
      heading: "See exactly what a recruiter fixes on your CV first.",
      subheading:
        "Paste your CV and get instant AI feedback on structure, keywords, and impact — with specific, ranked improvements you can make in minutes. No signup, no cost.",
      primaryCta: "Review my CV free",
    },
    howItWorks: [
      {
        title: "Paste your CV",
        description:
          "Drop in your CV text or upload it. Any language, any layout — the review reads structure, not just words.",
      },
      {
        title: "Get a scored breakdown",
        description:
          "See how your CV scores on clarity, keyword coverage, quantified impact, and section completeness.",
      },
      {
        title: "Apply ranked fixes",
        description:
          "Work through prioritised suggestions — the highest-impact changes first — then re-run to confirm.",
      },
    ],
    benefits: [
      {
        title: "Recruiter-grade feedback",
        description:
          "The same signals recruiters skim for in six seconds: headline, impact metrics, and relevant keywords.",
      },
      {
        title: "ATS-aware checks",
        description:
          "Flags missing sections, weak verbs, and formatting that can trip applicant tracking systems.",
      },
      {
        title: "Actionable, not vague",
        description:
          "Every note tells you what to change and why — no generic 'add more detail' advice.",
      },
    ],
    faqs: [
      {
        q: "Is the CV review really free?",
        a: "Yes. The CV review runs without a signup or payment. Premium plans add unlimited deep optimisation, ATS scoring, and role-specific rewriting.",
      },
      {
        q: "Do you store my CV?",
        a: "The free review is processed to generate your feedback and is not sold or shared. See our privacy policy for full details on data handling.",
      },
      {
        q: "Does it work for any industry or language?",
        a: "Yes. The review is structural and keyword-based, so it works across roles, industries, templates, and languages.",
      },
    ],
    cta: {
      heading: "Fix your CV before a recruiter ever sees it.",
      subheading:
        "Run a free review now, then practise a full AI interview built from your real CV.",
      primaryLabel: "Review my CV free",
      primaryHref: "/cv",
    },
  },
  {
    id: "resume-tailor",
    title: "AI Resume Tailor",
    shortTitle: "Resume Tailor",
    description: "Tailor your resume for any job description in seconds.",
    icon: "Sparkles",
    badge: "FREE",
    href: "/cv",
    apiPath: "/api/free-tools/resume-tailor",
    action: "resume_tailor",
    seo: {
      title: "AI Resume Tailor — Match Your Resume to Any Job | WorkZo AI",
      description:
        "Paste your resume and a job description to see your match score, missing keywords, and the exact edits that align your resume to the role. Free.",
      keywords: [
        "ai resume tailor",
        "tailor resume to job description",
        "resume keyword match",
        "resume optimizer",
        "job match score",
      ],
    },
    hero: {
      eyebrow: "AI Resume Tailor",
      heading: "Tailor your resume to the job in seconds, not hours.",
      subheading:
        "Paste your resume and the job description. WorkZo shows your match score, the keywords you're missing, and the precise lines to change so your resume speaks the role's language.",
      primaryCta: "Tailor my resume free",
    },
    howItWorks: [
      {
        title: "Add resume and job description",
        description:
          "Paste your current resume and the posting you're targeting. Both drive the analysis.",
      },
      {
        title: "See your match and gaps",
        description:
          "Get a match score plus the exact keywords and skills the posting expects that your resume is missing.",
      },
      {
        title: "Apply targeted edits",
        description:
          "Follow line-level suggestions to align your experience with the role — honestly, never fabricated.",
      },
    ],
    benefits: [
      {
        title: "Beat keyword filters",
        description:
          "Surface the role-specific terms recruiters and ATS tools search for, so your resume ranks.",
      },
      {
        title: "One resume per role",
        description:
          "Stop sending the same generic resume everywhere — tailor a version for each application fast.",
      },
      {
        title: "Grounded in your real experience",
        description:
          "Suggestions reframe what you've actually done; they never invent skills or history.",
      },
    ],
    faqs: [
      {
        q: "Will it invent experience I don't have?",
        a: "No. The tailor only reframes and highlights your real experience against the job description. Honesty matters — fabricated resumes fail in interviews.",
      },
      {
        q: "How is the match score calculated?",
        a: "It compares the skills and keywords in the job description against your resume and weights coverage of the most important requirements.",
      },
      {
        q: "Is there a limit?",
        a: "The free tailor is available to try instantly. Premium unlocks unlimited tailoring and deeper ATS analysis across every application.",
      },
    ],
    cta: {
      heading: "Send a resume that fits the role, every time.",
      subheading:
        "Tailor your resume free, then practise the interview that posting will actually ask for.",
      primaryLabel: "Tailor my resume free",
      primaryHref: "/cv",
    },
  },
  {
    id: "cover-letter",
    title: "Cover Letter Generator",
    shortTitle: "Cover Letter",
    description: "Generate personalized cover letters for any role.",
    icon: "FileText",
    badge: "FREE",
    href: "/cover-letter",
    apiPath: "/api/free-tools/cover-letter",
    action: "cover_letter",
    seo: {
      title: "Free Cover Letter Generator — Personalized in Seconds | WorkZo AI",
      description:
        "Generate a personalized, role-specific cover letter from your CV and the job you want. Clear structure, your real experience, ready to send. Free.",
      keywords: [
        "free cover letter generator",
        "ai cover letter",
        "cover letter writer",
        "personalized cover letter",
        "job application letter",
      ],
    },
    hero: {
      eyebrow: "Cover Letter Generator",
      heading: "A personalized cover letter, drafted from your real story.",
      subheading:
        "Give WorkZo your CV and the role. Get a structured, specific cover letter that connects your actual experience to what the job needs — ready to review and send.",
      primaryCta: "Write my cover letter free",
    },
    howItWorks: [
      {
        title: "Share your CV and target role",
        description:
          "Add your CV text and the role or company you're applying to. Optionally paste the job description for sharper results.",
      },
      {
        title: "Generate a tailored draft",
        description:
          "WorkZo writes a clear opening, evidence-backed middle, and confident close — grounded in your background.",
      },
      {
        title: "Edit and send",
        description:
          "Tweak the tone and details, then copy your finished letter straight into your application.",
      },
    ],
    benefits: [
      {
        title: "Specific, never generic",
        description:
          "Pulls concrete achievements from your CV instead of filling the page with clichés.",
      },
      {
        title: "Role-aware structure",
        description:
          "Follows a proven three-part structure hiring managers expect, matched to the job.",
      },
      {
        title: "Minutes, not evenings",
        description:
          "Skip the blank-page problem and start from a strong, personalised draft every time.",
      },
    ],
    faqs: [
      {
        q: "Can I control the tone?",
        a: "Yes. You can adjust tone and emphasis, then edit the draft freely before sending.",
      },
      {
        q: "Does it use my real experience?",
        a: "Every letter is built from the CV and role you provide, so it reflects your genuine background rather than invented claims.",
      },
      {
        q: "Is it free to use?",
        a: "You can generate a cover letter for free. Premium adds unlimited letters and tighter tailoring to each job description.",
      },
    ],
    cta: {
      heading: "Start every application with a strong letter.",
      subheading:
        "Draft a free cover letter, then rehearse the interview it opens the door to.",
      primaryLabel: "Write my cover letter free",
      primaryHref: "/cover-letter",
    },
  },
  {
    id: "interview-questions",
    title: "Interview Question Generator",
    shortTitle: "Interview Questions",
    description: "Generate realistic interview questions for any role.",
    icon: "MessageCircle",
    badge: "FREE",
    href: "/tools/interview-questions",
    apiPath: "/api/free-tools/interview-questions",
    action: "interview_questions",
    seo: {
      title:
        "Free Interview Question Generator — Realistic Questions by Role | WorkZo AI",
      description:
        "Generate realistic interview questions for any role or job description — behavioural, role-specific, and follow-ups — so you can prepare answers before the real thing.",
      keywords: [
        "interview question generator",
        "practice interview questions",
        "behavioral interview questions",
        "role specific interview questions",
        "mock interview questions",
      ],
    },
    hero: {
      eyebrow: "Interview Question Generator",
      heading: "Know the questions before you walk in.",
      subheading:
        "Enter a role or paste a job description and get realistic interview questions — behavioural, technical, and situational — so you can prepare answers instead of being surprised.",
      primaryCta: "Generate questions free",
    },
    howItWorks: [
      {
        title: "Enter the role",
        description:
          "Type the job title or paste the full job description. More detail means sharper, role-specific questions.",
      },
      {
        title: "Get a realistic set",
        description:
          "Receive a mix of behavioural, role-specific, and follow-up questions a real interviewer would ask.",
      },
      {
        title: "Prepare your answers",
        description:
          "Draft STAR-style answers, then practise them out loud in a full AI interview.",
      },
    ],
    benefits: [
      {
        title: "Grounded in the role",
        description:
          "Questions reflect the actual responsibilities and skills in the posting, not a generic bank.",
      },
      {
        title: "Covers the hard follow-ups",
        description:
          "Includes the probing follow-ups candidates get caught out by, so nothing surprises you.",
      },
      {
        title: "A ready study list",
        description:
          "Walk into the room with a prepared answer for every likely question.",
      },
    ],
    faqs: [
      {
        q: "Are the questions specific to my job?",
        a: "Yes. Provide the role or job description and the generator builds questions around those responsibilities and skills.",
      },
      {
        q: "Can I practise answering them?",
        a: "You can. WorkZo's full AI interview turns these into a live, voice-based session with follow-ups and feedback.",
      },
      {
        q: "Is it free?",
        a: "Generating questions is free. Premium unlocks unlimited full voice interviews, scoring, and detailed feedback.",
      },
    ],
    cta: {
      heading: "Practise the questions, not just read them.",
      subheading:
        "Generate your question set free, then run a full AI interview built from your CV and role.",
      primaryLabel: "Start a free interview",
      primaryHref: "/onboarding",
    },
  },
];

/* ────────────────────────────── Helpers ────────────────────────────── */

/** Slugs for generateStaticParams and the API allow-list. */
export const FREE_TOOL_SLUGS: string[] = FREE_TOOLS.map((t) => t.id);

/** Lightweight link shape for nav, footer, dashboard, and mobile menus. */
export type FreeToolLink = {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: FreeToolIconName;
  badge: string;
};

export const FREE_TOOL_LINKS: FreeToolLink[] = FREE_TOOLS.map((t) => ({
  id: t.id,
  label: t.title,
  shortLabel: t.shortTitle,
  href: t.href,
  description: t.description,
  icon: t.icon,
  badge: t.badge,
}));

/** Feature-list strings for pricing cards, e.g. "Free CV Review". */
export const FREE_TOOL_FEATURE_LABELS: string[] = FREE_TOOLS.map((t) => t.title);

export function getFreeToolBySlug(slug: string): FreeTool | undefined {
  return FREE_TOOLS.find((t) => t.id === slug);
}

export function getFreeToolByAction(action: FreeToolAction): FreeTool | undefined {
  return FREE_TOOLS.find((t) => t.action === action);
}

/** Map from slug -> engine action, used by the backend to validate requests. */
export const FREE_TOOL_ACTION_BY_SLUG: Record<string, FreeToolAction> =
  Object.fromEntries(FREE_TOOLS.map((t) => [t.id, t.action]));
