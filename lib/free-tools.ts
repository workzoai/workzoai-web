/*
 * WorkZo AI - Global Free Tools Registry
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
  | "MessageCircle"
  | "PenLine"
  | "Target"
  | "Type"
  | "ShieldCheck";

/** Engine action understood by lib/workzoFreeToolsEngine.ts. */
export type FreeToolAction =
  | "cv_review"
  | "resume_tailor"
  | "cover_letter"
  | "interview_questions"
  | "professional_summary"
  | "star_story"
  | "resume_headline"
  | "ats_check";

export type FreeToolStep = { title: string; description: string };
export type FreeToolBenefit = { title: string; description: string };
export type FreeToolFaq = { q: string; a: string };

/** One input in a free tool's inline runner form. `name` must match a key of
 *  FreeToolInput in lib/workzoFreeToolsEngine.ts (e.g. cvText, jobDescription). */
export type FreeToolField = {
  name: "cvText" | "jobDescription" | "targetRole" | "companyName" | "experienceText";
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
    title: "CV Review",
    shortTitle: "CV Review",
    description:
      "Get instant AI feedback on your CV with actionable improvements.",
    icon: "FileSearch",
    badge: "TOOL",
    href: "/cv",
    apiPath: "/api/free-tools/cv-review",
    action: "cv_review",
    seo: {
      title: "Free CV Review - Instant AI Feedback on Your CV | WorkZo AI",
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
      eyebrow: "CV Review",
      heading: "See exactly what a recruiter fixes on your CV first.",
      subheading:
        "Paste your CV and get instant AI feedback on structure, keywords, and impact - with specific, ranked improvements you can make in minutes. Sign in to keep this result connected to your WorkZo profile.",
      primaryCta: "Review my CV",
    },
    howItWorks: [
      {
        title: "Paste your CV",
        description:
          "Drop in your CV text or upload it. Any language, any layout - the review reads structure, not just words.",
      },
      {
        title: "Get a scored breakdown",
        description:
          "See how your CV scores on clarity, keyword coverage, quantified impact, and section completeness.",
      },
      {
        title: "Apply ranked fixes",
        description:
          "Work through prioritised suggestions - the highest-impact changes first - then re-run to confirm.",
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
          "Every note tells you what to change and why - no generic 'add more detail' advice.",
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
      primaryLabel: "Review my CV",
      primaryHref: "/cv",
    },
  },
  {
    id: "resume-tailor",
    title: "AI Resume Tailor",
    shortTitle: "Resume Tailor",
    description: "Tailor your resume for any job description in seconds.",
    icon: "Sparkles",
    badge: "TOOL",
    href: "/cv",
    apiPath: "/api/free-tools/resume-tailor",
    action: "resume_tailor",
    seo: {
      title: "AI Resume Tailor - Match Your Resume to Any Job | WorkZo AI",
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
      primaryCta: "Tailor my resume",
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
          "Follow line-level suggestions to align your experience with the role - honestly, never fabricated.",
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
          "Stop sending the same generic resume everywhere - tailor a version for each application fast.",
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
        a: "No. The tailor only reframes and highlights your real experience against the job description. Honesty matters - fabricated resumes fail in interviews.",
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
      primaryLabel: "Tailor my resume",
      primaryHref: "/cv",
    },
  },
  {
    id: "cover-letter",
    title: "Cover Letter Generator",
    shortTitle: "Cover Letter",
    description: "Generate personalized cover letters for any role.",
    icon: "FileText",
    badge: "TOOL",
    href: "/cover-letter",
    apiPath: "/api/free-tools/cover-letter",
    action: "cover_letter",
    seo: {
      title: "Free Cover Letter Generator - Personalized in Seconds | WorkZo AI",
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
        "Give WorkZo your CV and the role. Get a structured, specific cover letter that connects your actual experience to what the job needs - ready to review and send.",
      primaryCta: "Write my cover letter",
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
          "WorkZo writes a clear opening, evidence-backed middle, and confident close - grounded in your background.",
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
      primaryLabel: "Write my cover letter",
      primaryHref: "/cover-letter",
    },
  },
  {
    id: "interview-questions",
    title: "Interview Question Generator",
    shortTitle: "Interview Questions",
    description: "Generate realistic interview questions for any role.",
    icon: "MessageCircle",
    badge: "TOOL",
    href: "/tools/interview-questions",
    apiPath: "/api/free-tools/interview-questions",
    action: "interview_questions",
    seo: {
      title:
        "Free Interview Question Generator - Realistic Questions by Role | WorkZo AI",
      description:
        "Generate realistic interview questions for any role or job description - behavioural, role-specific, and follow-ups - so you can prepare answers before the real thing.",
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
        "Enter a role or paste a job description and get realistic interview questions - behavioural, technical, and situational - so you can prepare answers instead of being surprised.",
      primaryCta: "Generate questions",
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
  {
    id: "professional-summary",
    title: "Professional Summary Generator",
    shortTitle: "Summary Generator",
    description:
      "Turn your CV into a sharp professional summary recruiters read first.",
    icon: "PenLine",
    badge: "TOOL",
    href: "/tools/professional-summary",
    apiPath: "/api/free-tools/professional-summary",
    action: "professional_summary",
    seo: {
      title: "Free Professional Summary Generator | WorkZo AI",
      description:
        "Paste your CV and get a recruiter-ready professional summary in seconds. Front-loads the right keywords, shows real impact, and fits in 2 to 3 sentences. Free, no signup.",
      keywords: [
        "professional summary generator",
        "resume summary generator",
        "cv personal statement",
        "linkedin summary",
        "about me generator",
      ],
    },
    hero: {
      eyebrow: "Professional Summary Generator",
      heading: "The two sentences a recruiter reads before anything else.",
      subheading:
        "Paste your CV and get a clear, role-focused summary that front-loads your strongest keywords and shows real impact. Sign in to keep this result connected to your WorkZo profile.",
      primaryCta: "Write my summary",
    },
    howItWorks: [
      {
        title: "Paste your CV",
        description:
          "Drop in your CV text. Add a target role or job description to sharpen the wording.",
      },
      {
        title: "Get a ready summary",
        description:
          "Receive a recruiter-ready summary plus a short LinkedIn-style headline, built from your real experience.",
      },
      {
        title: "Use it anywhere",
        description:
          "Drop it into your CV, LinkedIn About section, or an application, then tailor it per role.",
      },
    ],
    benefits: [
      {
        title: "Built from your CV",
        description:
          "Uses your actual skills and experience instead of a generic template you have to rewrite.",
      },
      {
        title: "Written to be scanned",
        description:
          "Leads with your role and front-loads keywords, so it survives a six-second recruiter skim and ATS parsing.",
      },
      {
        title: "Honest by design",
        description:
          "Reflects what is on your CV, so every line is something you can back up in an interview.",
      },
    ],
    faqs: [
      {
        q: "Is it really free?",
        a: "Yes. Generating a summary is free with no signup. Premium unlocks 10 tuned variations, tone control, and summaries saved to your WorkZo profile.",
      },
      {
        q: "Can I use it for LinkedIn?",
        a: "Yes. You get a full CV-style summary and a shorter headline-style line that works well for a LinkedIn About section or profile headline.",
      },
      {
        q: "Will it invent things about me?",
        a: "No. It works from the CV you paste and does not add skills or claims you did not include, so it stays interview-ready.",
      },
    ],
    cta: {
      heading: "Get 10 tuned variations, saved to your profile.",
      subheading:
        "The free summary gets you started. Premium tailors it to each role, adjusts the tone, and keeps every version in your WorkZo career profile.",
      primaryLabel: "Unlock the full version",
      primaryHref: "/pricing",
    },
  },
  {
    id: "star-story",
    title: "STAR Story Generator",
    shortTitle: "STAR Stories",
    description:
      "Turn any achievement into a structured Situation, Task, Action, Result answer.",
    icon: "Target",
    badge: "TOOL",
    href: "/tools/star-story",
    apiPath: "/api/free-tools/star-story",
    action: "star_story",
    seo: {
      title: "Free STAR Story Generator - Structured Interview Answers | WorkZo AI",
      description:
        "Describe an achievement and get a clear STAR-format answer (Situation, Task, Action, Result) ready for behavioural interviews. Free, no signup.",
      keywords: [
        "star method generator",
        "star story generator",
        "behavioral interview answer",
        "situation task action result",
        "interview story builder",
      ],
    },
    hero: {
      eyebrow: "STAR Story Generator",
      heading: "Turn 'I did some stuff' into a story that lands.",
      subheading:
        "Describe a real achievement in plain words. WorkZo structures it into a tight Situation, Task, Action, Result answer you can deliver with confidence. Sign in to keep this result connected to your WorkZo profile.",
      primaryCta: "Build my STAR story",
    },
    howItWorks: [
      { title: "Describe the experience", description: "Write what happened in a few plain sentences. Add the numbers if you have them." },
      { title: "Get a structured answer", description: "Receive a clean STAR breakdown plus a single flowing version you can say out loud." },
      { title: "Practise it", description: "Rehearse the Result first, then deliver it in a full AI interview with follow-ups." },
    ],
    benefits: [
      { title: "Structure interviewers expect", description: "Answers each STAR beat in one clear step, so nothing rambles and nothing is missing." },
      { title: "Impact-first", description: "Pushes your measurable result to the front, which is what turns effort into evidence." },
      { title: "Honest by design", description: "Built from what you actually did, so every line is defensible under follow-up questions." },
    ],
    faqs: [
      { q: "What is the STAR method?", a: "STAR stands for Situation, Task, Action, Result. It is the structure interviewers use to assess behavioural answers, so shaping your stories this way makes them easier to follow and score." },
      { q: "Is it free?", a: "Yes. Building a STAR story is free with no signup. Premium adds saved stories, tone control, and live coaching in a full interview." },
      { q: "Will it make things up?", a: "No. It structures the experience you describe and never invents facts, so your answer stays truthful and interview-ready." },
    ],
    cta: {
      heading: "Practise the story, don't just read it.",
      subheading: "Build your STAR answer free, then deliver it in a full AI interview with real follow-ups.",
      primaryLabel: "Start a free interview",
      primaryHref: "/onboarding",
    },
  },
  {
    id: "resume-headline",
    title: "Resume Headline Generator",
    shortTitle: "Headline Generator",
    description:
      "Generate a sharp resume or LinkedIn headline recruiters read in the first second.",
    icon: "Type",
    badge: "TOOL",
    href: "/tools/resume-headline",
    apiPath: "/api/free-tools/resume-headline",
    action: "resume_headline",
    seo: {
      title: "Free Resume Headline Generator - LinkedIn & CV Headlines | WorkZo AI",
      description:
        "Enter your target role and get five recruiter-ready resume and LinkedIn headlines that front-load the right keywords. Free, no signup.",
      keywords: [
        "resume headline generator",
        "linkedin headline generator",
        "cv headline",
        "professional headline",
        "resume title generator",
      ],
    },
    hero: {
      eyebrow: "Resume Headline Generator",
      heading: "The first line a recruiter reads. Make it count.",
      subheading:
        "Enter your target role, add your CV to sharpen it, and get five headlines that front-load the keywords recruiters and ATS scan for. Sign in to keep this result connected to your WorkZo profile.",
      primaryCta: "Generate headlines",
    },
    howItWorks: [
      { title: "Enter your role", description: "Type the role you are targeting. Paste your CV or a job description to pull in the right skills." },
      { title: "Get five options", description: "Receive pipe-format and sentence-style headlines built from your real strengths." },
      { title: "Use it everywhere", description: "Drop it into your CV, LinkedIn headline, or profile summary, then tailor per role." },
    ],
    benefits: [
      { title: "Keyword-first", description: "Leads with your role and top skills, so it survives a six-second skim and ATS parsing." },
      { title: "Multiple angles", description: "Gives you scannable pipe headlines and warmer sentence versions to pick from." },
      { title: "Built from you", description: "Uses the skills in your CV, not a generic template you have to rewrite." },
    ],
    faqs: [
      { q: "Where do I use these headlines?", a: "The pipe versions work for a CV headline or LinkedIn headline field; the sentence versions work well as a summary opener or LinkedIn About first line." },
      { q: "Is it free?", a: "Yes, no signup. Premium adds role-tailored headlines saved to your WorkZo profile and A/B variants." },
      { q: "Do I need to paste my CV?", a: "No, a target role is enough. Adding your CV or a job description makes the headline more specific to your real skills." },
    ],
    cta: {
      heading: "A great headline gets the click. A great CV gets the interview.",
      subheading: "Generate your headline free, then run a full CV review and AI interview built from your background.",
      primaryLabel: "Review my CV",
      primaryHref: "/cv",
    },
  },
  {
    id: "ats-checker",
    title: "ATS Resume Checker",
    shortTitle: "ATS Checker",
    description:
      "Score your resume against ATS parsing and a job's keywords, with specific fixes.",
    icon: "ShieldCheck",
    badge: "TOOL",
    href: "/tools/ats-checker",
    apiPath: "/api/free-tools/ats-checker",
    action: "ats_check",
    seo: {
      title: "Free ATS Resume Checker - Score & Keyword Match | WorkZo AI",
      description:
        "Paste your resume and a job description to get an ATS score, structure checks, keyword match, and specific fixes. Free, instant, no signup.",
      keywords: [
        "ats resume checker",
        "ats score checker",
        "resume ats scan",
        "applicant tracking system checker",
        "resume keyword checker",
      ],
    },
    hero: {
      eyebrow: "ATS Resume Checker",
      heading: "See your resume the way an ATS does, before it filters you out.",
      subheading:
        "Paste your resume, add the job description, and get an ATS score with structure checks, keyword match, and the exact fixes to make. Sign in to keep this result connected to your WorkZo profile.",
      primaryCta: "Check my ATS score",
    },
    howItWorks: [
      { title: "Paste your resume", description: "Drop in your resume text. Add the target job description for a keyword-match score too." },
      { title: "Get your ATS score", description: "See a score out of 100 with a pass/fail breakdown across the checks ATS systems and recruiters run." },
      { title: "Apply the fixes", description: "Work through the ranked, specific fixes, then re-run to confirm the score moved." },
    ],
    benefits: [
      { title: "Structure and keywords", description: "Blends parseability checks with keyword match against the actual posting, not a generic list." },
      { title: "Specific, not vague", description: "Every failed check tells you exactly what to change, with no 'add more detail' filler." },
      { title: "Instant and private", description: "Runs in your browser session with no signup, and we do not sell your data." },
    ],
    faqs: [
      { q: "What is an ATS?", a: "An applicant tracking system parses and ranks resumes before a human reads them. If it cannot read your resume or misses key terms, strong applications get filtered out." },
      { q: "How is the score calculated?", a: "It combines structure checks (sections, dates, contact info, clean formatting) with keyword match against the job description you paste. More detail means a sharper score." },
      { q: "Is it free?", a: "Yes, instant and no signup. Premium adds a deep line-by-line ATS rewrite and role-specific optimisation saved to your profile." },
    ],
    cta: {
      heading: "Pass the filter, then win the interview.",
      subheading: "Fix your ATS score free, then practise a full AI interview built from your real CV and role.",
      primaryLabel: "Compare plans",
      primaryHref: "/pricing",
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
