import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  GraduationCap,
  Handshake,
  type LucideIcon,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  SectionHeading,
  StatBand,
  FeatureCard,
  FaqAccordion,
  CTASection,
  BackLink,
  PrimaryButton,
  GhostButton,
} from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";

type Stat = { value: string; label: string };
type Pair = { title: string; text: string };
type Faq = { q: string; a: string };

type Segment = {
  slug: string;
  eyebrow: string;
  navLabel: string;
  icon: LucideIcon;
  title: string;
  intro: string;
  audience: string;
  snippet: { recruiter: string; candidate: string; signal: string; tone: "good" | "watch" };
  outcomeStats: Stat[];
  problem: { heading: string; points: string[] };
  solution: { heading: string; points: string[] };
  capabilities: Pair[];
  steps: Pair[];
  metrics: Stat[];
  faqs: Faq[];
};

const SEGMENTS: Record<string, Segment> = {
  "coding-bootcamps": {
    slug: "coding-bootcamps",
    eyebrow: "Coding Bootcamps",
    navLabel: "Coding Bootcamps",
    icon: BriefcaseBusiness,
    title: "Get every cohort placement-ready before demo day.",
    intro:
      "WorkZo AI runs realistic, CV-aware interviews for each student across technical screens, HR calls, and hiring-partner conversations, so weak answers surface in practice, not in front of the employers you've worked hard to line up.",
    audience: "For bootcamp career teams, instructors, and placement leads",
    snippet: {
      recruiter: "Your CV lists a capstone using React and a Node API. Walk me through one technical decision you owned and why.",
      candidate: "I chose optimistic UI updates for the cart because the API round-trip was slow, then reconciled on failure…",
      signal: "Strong ownership, needs a concrete metric",
      tone: "watch",
    },
    outcomeStats: [
      { value: "1 CV", label: "drives the whole interview, with no generic question banks" },
      { value: "5-cat", label: "scoring: communication, relevance, experience, evidence, job fit" },
      { value: "Report", label: "career teams can coach from in minutes" },
    ],
    problem: {
      heading: "What slows placement down",
      points: [
        "Mock interviews don't scale: one instructor can't sit with forty students before every hiring day.",
        "Students freeze on the same things every cohort: unclear STAR structure, no metrics, and shaky answers on projects they actually built.",
        "By the time an employer partner spots the gap, the placement (and the relationship) is already at risk.",
      ],
    },
    solution: {
      heading: "How WorkZo changes it",
      points: [
        "Every student gets unlimited realistic practice built from their own CV and a target job description.",
        "Recruiter personas cover the full loop: friendly HR screen, analytical technical lead, and business-focused hiring manager.",
        "Career teams get a shared report per student, so coaching time goes to the people who need it most.",
      ],
    },
    capabilities: [
      { title: "Technical screens that reference real code", text: "Questions come from the student's own projects and stack, so they practice defending decisions they actually made, rather than trivia." },
      { title: "Live code workspace", text: "For engineering roles, students can work through a problem in an in-browser editor while the recruiter persona probes their reasoning." },
      { title: "STAR coaching with evidence", text: "The report quotes the student's own answers back to them and shows exactly where structure, ownership, or metrics were missing." },
      { title: "Placement-ready signal", text: "A clear readiness score tells you who's ready for a hiring partner and who needs one more session before you make the intro." },
    ],
    steps: [
      { title: "Add the target role", text: "Upload the student CV and paste the job description for the placement they're aiming at. WorkZo builds the interview around the JD, not the resume." },
      { title: "Run the interview", text: "The student completes a realistic voice or text interview with a recruiter persona matched to the role and company style." },
      { title: "Coach from the report", text: "You and the student review the scored breakdown, weakest moments, and a focused improvement plan before the real interview." },
    ],
    metrics: [
      { value: "11", label: "recruiter personas across HR, technical, and hiring-manager styles" },
      { value: "JD-led", label: "70% job description, 30% resume: interviews for the next role, not the last one" },
      { value: "Any stack", label: "web, data, cloud, and support tracks all supported" },
    ],
    faqs: [
      { q: "Does it only work for software roles?", a: "No. The interview engine is built from the job description, so the same tool prepares students for data, cloud, IT support, and customer-facing roles as well as software engineering." },
      { q: "Can instructors see how students are doing?", a: "Each session produces a shareable report with scores, strengths, weak moments, and a targeted improvement plan that career teams can coach from directly." },
      { q: "How realistic are the technical questions?", a: "Questions are generated from the student's own projects and the target stack, and analytical personas will push on trade-offs, ownership, and results the way a real technical interviewer does." },
      { q: "What does a pilot look like?", a: "We start with a managed cohort pilot: a shared minute pool and the recruiter personas that fit your placement partners, before any deeper rollout." },
    ],
  },

  "universities-career-services": {
    slug: "universities-career-services",
    eyebrow: "Universities & Career Services",
    navLabel: "Universities & Career Services",
    icon: GraduationCap,
    title: "Give every student interview practice, not just the ones who book a slot.",
    intro:
      "Career services can't run a mock interview with every student before internship and graduate deadlines. WorkZo AI does the first pass with realistic, CV-aware practice and clear feedback, so your advisors spend their time where it matters.",
    audience: "For university career services, faculty, and student success teams",
    snippet: {
      recruiter: "This is a graduate scheme with rotations across teams. Why this programme, and why now for you?",
      candidate: "I want breadth early in my career, and my dissertation on supply-chain data showed me I learn fastest by rotating…",
      signal: "Clear motivation, well structured",
      tone: "good",
    },
    outcomeStats: [
      { value: "24/7", label: "practice students can access before every deadline" },
      { value: "Every", label: "student gets feedback, not just the ones who book a room" },
      { value: "Advisor", label: "time freed for the students who need real coaching" },
    ],
    problem: {
      heading: "The bottleneck career teams know well",
      points: [
        "Demand spikes before internship and graduate deadlines, and there are never enough advisors to run one-to-one mocks.",
        "Students arrive at real interviews having never said their answers out loud, so nerves and structure, not ability, cost them the offer.",
        "Advisors have no easy way to see who is genuinely ready and who needs an urgent session.",
      ],
    },
    solution: {
      heading: "A first pass that scales",
      points: [
        "Students practice on demand against their own CV and a real job description, as many times as they need.",
        "Every session ends with a clear, honest report they can act on before they meet an employer.",
        "Advisors use readiness signals to triage, reaching the students most at risk of a weak interview first.",
      ],
    },
    capabilities: [
      { title: "Internship and graduate-scheme ready", text: "Interviews reflect the competency-based, motivation-heavy questions graduate employers actually ask, in the student's target sector." },
      { title: "Confidence before the real thing", text: "Students rehearse saying answers out loud with a realistic recruiter, so the first time isn't in front of the employer." },
      { title: "Advisor-ready reports", text: "Structured feedback highlights weak STAR structure, unclear examples, and confidence gaps faster than a debrief from memory." },
      { title: "Works across every faculty", text: "Because the interview is built from the job description, it fits engineering, business, humanities, and science students alike." },
    ],
    steps: [
      { title: "Students set their target", text: "Each student uploads their CV and the internship or graduate role they're applying for." },
      { title: "They practice on demand", text: "Realistic interviews run in the browser, repeatable before every deadline, no advisor slot required." },
      { title: "Advisors coach the gaps", text: "Career teams review readiness across the group and focus one-to-one time where it changes the outcome." },
    ],
    metrics: [
      { value: "Any role", label: "one engine covers every sector your students apply to" },
      { value: "Multi-lingual", label: "practice in the language of the target market" },
      { value: "Repeatable", label: "students improve across sessions, and the report tracks it" },
    ],
    faqs: [
      { q: "Does this replace our advisors?", a: "No, it makes them more effective. WorkZo handles the repeatable first pass so advisors spend their limited time on the students who most need human coaching." },
      { q: "How do we run it across a large cohort?", a: "We set up a managed pilot with a shared minute pool so a whole cohort can practice, and career teams can review readiness at the group level." },
      { q: "Can students practice in another language?", a: "Yes. Interviews can run in the language of the target market, which is useful for international students and roles abroad." },
      { q: "Is student data handled responsibly?", a: "Yes. See our Security & Privacy page for how candidate data is used during practice and reporting, with GDPR-friendly handling for European institutions." },
    ],
  },

  "training-academies": {
    slug: "training-academies",
    eyebrow: "Training Academies",
    navLabel: "Training Academies",
    icon: UsersRound,
    title: "Add real interview practice to every certification and reskilling program.",
    intro:
      "Learners finish your program with new skills but often can't explain them under pressure. WorkZo AI helps them tell a clear, confident story about their projects, their gaps, and their career change, before they meet an employer.",
    audience: "For training providers, reskilling programs, and career-change academies",
    snippet: {
      recruiter: "You're moving into data from a hospitality background. What made you confident that was the right change?",
      candidate: "Running a venue was all forecasting and margins. I realised I loved the numbers more than the floor, so I…",
      signal: "Great narrative, quantify the impact next",
      tone: "watch",
    },
    outcomeStats: [
      { value: "Story", label: "learners can defend their career change with confidence" },
      { value: "Skills", label: "explained clearly, not just listed on a certificate" },
      { value: "Ready", label: "before employer introductions, not after" },
    ],
    problem: {
      heading: "Where career-changers stumble",
      points: [
        "A certificate proves the skill exists; it doesn't teach the learner to explain it convincingly in an interview.",
        "Career-changers struggle most with the transition story: why they moved, and how their old experience is an asset.",
        "Without practice, learners undersell real, relevant experience because they don't know how to frame it.",
      ],
    },
    solution: {
      heading: "Practice that builds the narrative",
      points: [
        "Learners rehearse explaining projects, tools, and outcomes from your program against a real target role.",
        "Personas ask the transition questions employers ask, and coach the learner to answer them well.",
        "Readiness reports tell your team who's prepared for an employer intro and who needs another session.",
      ],
    },
    capabilities: [
      { title: "Career-change framing", text: "Interviews probe motivation and transferable skills, then the report shows the learner how to turn their background into an advantage." },
      { title: "Project-based questions", text: "Learners defend the work they did in your program, the practical projects that certifications alone don't surface." },
      { title: "Cross-domain coverage", text: "Tech, data, support, business, and customer-facing tracks all use the same engine, built from each role's job description." },
      { title: "Readiness for intros", text: "A clear score helps you decide who is ready to be introduced to a hiring partner, protecting your employer relationships." },
    ],
    steps: [
      { title: "Map role to program", text: "Learners pair their CV and program projects with the job description they're targeting after graduation." },
      { title: "Rehearse the story", text: "Realistic interviews focus on motivation, transferable skills, and the projects they completed with you." },
      { title: "Track readiness", text: "Your team reviews reports across the cohort and coaches the learners who aren't quite there yet." },
    ],
    metrics: [
      { value: "Any track", label: "one platform for every program you run" },
      { value: "Projects", label: "the practical work certifications miss gets interviewed" },
      { value: "Transitions", label: "purpose-built for reskilling and career change" },
    ],
    faqs: [
      { q: "Our learners come from very different backgrounds. Does that matter?", a: "No. Because the interview is built from the target job description, it adapts to each learner's chosen role regardless of where they started." },
      { q: "Can it handle non-technical programs?", a: "Yes. The same engine prepares learners for support, business, sales, and customer-facing roles, not only technical ones." },
      { q: "How does it help with the career-change story?", a: "Personas ask the motivation and transferable-skill questions employers use, and the report coaches learners on framing their background as an asset." },
      { q: "Can we brand it as part of our program?", a: "Managed rollouts and co-branded pilots are part of how we work with training providers. Talk to us about the setup that fits your program." },
    ],
  },

  "enterprise-hiring": {
    slug: "enterprise-hiring",
    eyebrow: "Enterprise Hiring",
    navLabel: "Enterprise Hiring",
    icon: Building2,
    title: "Standardize interview preparation across every team and location.",
    intro:
      "Internal mobility, graduate intakes, and promotion cases all depend on people interviewing well. WorkZo AI gives your organization one consistent, structured way to prepare candidates, wherever they sit and whatever the role.",
    audience: "For talent development, internal mobility, and early-careers teams",
    snippet: {
      recruiter: "You're moving from an IC role into team lead. Tell me about a time you influenced peers without authority.",
      candidate: "When we were deciding on the migration approach, I built the case, ran a spike, and brought the two skeptics along by…",
      signal: "Leadership signal, strong evidence",
      tone: "good",
    },
    outcomeStats: [
      { value: "One", label: "consistent preparation standard across the whole org" },
      { value: "Fair", label: "the same structured practice for every candidate" },
      { value: "Ready", label: "people for mobility, promotion, and graduate loops" },
    ],
    problem: {
      heading: "Inconsistency costs you talent",
      points: [
        "Interview prep is uneven: some managers coach well, some not at all, and strong internal candidates lose out to nerves.",
        "Graduate and early-careers intakes need repeatable preparation at scale, not ad-hoc sessions.",
        "There's no consistent way to see whether people are ready before they enter a formal hiring stage.",
      ],
    },
    solution: {
      heading: "A single, fair standard",
      points: [
        "Everyone prepares with the same structured, role-specific interview, regardless of team, manager, or location.",
        "Leadership and promotion loops get the influence, ownership, and strategy questions those conversations actually turn on.",
        "Talent teams see readiness patterns before candidates reach a formal panel.",
      ],
    },
    capabilities: [
      { title: "Internal mobility ready", text: "Interviews reflect the target internal role and level, so candidates practice for the job they're moving into, not the one they have." },
      { title: "Leadership and promotion loops", text: "Personas cover influence-without-authority, ownership, and strategic thinking: the substance of leadership interviews." },
      { title: "Consistent across locations", text: "One engine means the same fair preparation whether a candidate sits in HQ or a regional office." },
      { title: "Program-level visibility", text: "Managed pilots offer group-level readiness insight so talent teams can guide workshops and coaching." },
    ],
    steps: [
      { title: "Define the internal role", text: "Candidates pair their profile with the target internal role and level they're preparing for." },
      { title: "Practice to the standard", text: "Each candidate completes the same structured interview, tuned to the role's competencies and company style." },
      { title: "Review readiness", text: "Talent teams use readiness signals to run targeted workshops before formal hiring stages." },
    ],
    metrics: [
      { value: "Every team", label: "one standard, no matter who the manager is" },
      { value: "Any level", label: "from graduate intake to leadership loops" },
      { value: "Global", label: "consistent preparation across locations and languages" },
    ],
    faqs: [
      { q: "Is this for external hiring or internal candidates?", a: "It's built for preparing your own people: internal mobility, promotion cases, and graduate intakes, so they walk into formal loops well-practiced." },
      { q: "How does it stay consistent across managers?", a: "Every candidate gets the same structured, role-specific interview, which removes the variation that comes from uneven manager coaching." },
      { q: "Can it handle leadership interviews?", a: "Yes. Personas cover influence, ownership, and strategic-thinking questions, so candidates rehearse the substance of leadership loops." },
      { q: "What about data and access controls?", a: "Enterprise rollouts include managed setup and privacy controls. See the Security & Privacy page and talk to us about your requirements." },
    ],
  },

  "recruitment-agencies": {
    slug: "recruitment-agencies",
    eyebrow: "Recruitment Agencies",
    navLabel: "Recruitment Agencies",
    icon: Handshake,
    title: "Send candidates into client interviews genuinely ready.",
    intro:
      "A weak submission costs you the placement and strains the client relationship. WorkZo AI lets your consultants prepare candidates against the exact role before a client screen or final interview, so the person who shows up is the person on paper.",
    audience: "For recruitment consultants, delivery teams, and agency owners",
    snippet: {
      recruiter: "The client cares most about stakeholder management. Give me a specific example where you handled a difficult one.",
      candidate: "A director wanted a feature that broke our roadmap. I reframed it around his actual metric, and we agreed a phased plan…",
      signal: "On-brief, quantify the outcome",
      tone: "watch",
    },
    outcomeStats: [
      { value: "Fewer", label: "weak submissions reaching your clients" },
      { value: "Sharper", label: "candidates on the exact competencies the role needs" },
      { value: "Stronger", label: "client relationships and fill rates" },
    ],
    problem: {
      heading: "What puts placements at risk",
      points: [
        "Candidates who look great on paper interview poorly, and it's your client relationship that takes the hit.",
        "Consultants don't have time to run a real practice interview for every candidate before every client screen.",
        "You can't easily see which candidates are ready to submit and which need prep first.",
      ],
    },
    solution: {
      heading: "Prep that protects the placement",
      points: [
        "Candidates practice against the specific client role and requirement before the screen or final interview.",
        "The report shows exactly where a candidate is weak, so consultants know what to coach before submitting.",
        "You reduce weak submissions and walk into client conversations with genuinely prepared people.",
      ],
    },
    capabilities: [
      { title: "Role-specific client prep", text: "Interviews are built from the client's job spec, so candidates rehearse the exact competencies that role turns on." },
      { title: "Clear submission signal", text: "A readiness score helps consultants decide who to submit now and who to coach first, protecting fill quality." },
      { title: "Communication and clarity", text: "Practice sharpens how candidates explain projects and results, the things that most often sink a client screen." },
      { title: "Faster candidate coaching", text: "Instead of a generic pep talk, consultants coach from a report that names the exact gap." },
    ],
    steps: [
      { title: "Load the client role", text: "Consultants pair the candidate CV with the client's job spec for the role in play." },
      { title: "Run a client-style screen", text: "The candidate practices against a persona matched to the client's interview style and seniority." },
      { title: "Coach, then submit", text: "The consultant reviews the report, closes the gaps, and submits a genuinely ready candidate." },
    ],
    metrics: [
      { value: "Per role", label: "prep built from the actual client spec" },
      { value: "Any sector", label: "tech, business, support, and specialist desks" },
      { value: "Repeatable", label: "candidates can practice until they're ready" },
    ],
    faqs: [
      { q: "How is this different from a quick prep call?", a: "A prep call is advice; WorkZo is realistic practice. The candidate actually rehearses the client-style interview and gets a report that names the exact gap to fix." },
      { q: "Can it match different client interview styles?", a: "Yes. Personas range from warm HR screens to analytical and executive styles, so candidates practice for the specific client and seniority." },
      { q: "Does it work across our desks?", a: "The engine is built from each role's job spec, so it prepares candidates for tech, business, support, and specialist roles alike." },
      { q: "How do we get started?", a: "We run a managed pilot with a shared minute pool so your consultants can prepare live candidates and measure the impact on submissions." },
    ],
  },

  "admin-dashboard": {
    slug: "admin-dashboard",
    eyebrow: "Admin Dashboard",
    navLabel: "Admin Dashboard",
    icon: BarChart3,
    title: "See interview readiness across your whole cohort at a glance.",
    intro:
      "Running a program means knowing who's on track and who's about to walk into an interview underprepared. WorkZo AI's group view surfaces engagement, progress, and readiness so you can act before a deadline, not after.",
    audience: "For program managers, career-service leads, and cohort administrators",
    snippet: {
      recruiter: "Cohort overview · 38 learners · 214 sessions this month",
      candidate: "Readiness: 21 ready · 12 improving · 5 need coaching",
      signal: "5 learners flagged before next hiring day",
      tone: "watch",
    },
    outcomeStats: [
      { value: "Group", label: "view of engagement, progress, and readiness" },
      { value: "Early", label: "warning on learners who need coaching now" },
      { value: "Evidence", label: "to shape workshops and follow-up sessions" },
    ],
    problem: {
      heading: "Flying blind before a deadline",
      points: [
        "You can feel a cohort isn't ready, but you can't point to who, or why, in time to help.",
        "Engagement is invisible: some learners practice constantly, others not at all, and you find out too late.",
        "Without data, workshops are generic instead of targeted at the gaps that actually exist.",
      ],
    },
    solution: {
      heading: "Visibility that drives action",
      points: [
        "A group-level view shows usage, progress, and readiness trends across the whole cohort.",
        "Learners who need extra coaching are surfaced early, before the hiring day or deadline.",
        "Summary insights tell you what to run a workshop on, instead of guessing.",
      ],
    },
    capabilities: [
      { title: "Engagement at a glance", text: "See who's practicing and who's disengaged, so no learner slips through until it's too late to help." },
      { title: "Readiness trends", text: "Track how the cohort is improving over time and spot the learners whose scores aren't moving." },
      { title: "Early-warning flags", text: "Learners at risk of a weak interview are surfaced before the deadline, when there's still time to coach." },
      { title: "Insight for workshops", text: "Summary patterns show the common gaps, so group sessions target what the cohort actually needs." },
    ],
    steps: [
      { title: "Learners practice", text: "Each learner runs interviews against their target role; every session feeds the group view." },
      { title: "You watch the trends", text: "The dashboard aggregates engagement, progress, and readiness across the cohort." },
      { title: "You intervene early", text: "Flagged learners get targeted coaching, and workshops address the real gaps before deadlines." },
    ],
    metrics: [
      { value: "Cohort", label: "level engagement and readiness in one place" },
      { value: "Trends", label: "progress tracked across sessions, not one-off scores" },
      { value: "Timely", label: "flags arrive before the hiring day, not after" },
    ],
    faqs: [
      { q: "What can I actually see?", a: "Managed pilots include a group-level view of engagement, progress, and readiness trends, plus flags for learners who need extra coaching." },
      { q: "Is individual student data exposed to everyone?", a: "Access is scoped to your program administrators, and candidate data is handled per our Security & Privacy page. You control who sees what." },
      { q: "How does this help before a hiring day?", a: "Early-warning flags surface at-risk learners while there's still time to coach them, rather than discovering the gap after the interview." },
      { q: "Does the dashboard come with every plan?", a: "Group-level visibility is part of managed cohort and enterprise pilots. Talk to us about setting it up for your program." },
    ],
  },

  "security-privacy": {
    slug: "security-privacy",
    eyebrow: "Security & Privacy",
    navLabel: "Security & Privacy",
    icon: ShieldCheck,
    title: "Privacy-aware interview practice your institution can stand behind.",
    intro:
      "Schools, universities, and enterprise partners need to know exactly how candidate data is handled before they roll a tool out. WorkZo AI is built with clear privacy messaging, GDPR-friendly handling, and managed rollout options for European partners.",
    audience: "For DPOs, IT, procurement, and compliance stakeholders",
    snippet: {
      recruiter: "Data used: this candidate's CV and target role, for this practice session and its report.",
      candidate: "Purpose: generate interview questions and feedback. Retention: managed per your rollout agreement.",
      signal: "GDPR-friendly, transparent by design",
      tone: "good",
    },
    outcomeStats: [
      { value: "Clear", label: "messaging on what candidate data is used for" },
      { value: "GDPR", label: "friendly handling for European partners" },
      { value: "Managed", label: "rollout before any deeper integration" },
    ],
    problem: {
      heading: "The questions procurement always asks",
      points: [
        "What candidate data does the tool use, and what is it used for?",
        "Does data handling meet our GDPR and institutional obligations?",
        "How do we roll this out to a cohort without a heavy integration project up front?",
      ],
    },
    solution: {
      heading: "Answers, up front",
      points: [
        "Transparent messaging explains exactly what candidate data drives practice and reporting.",
        "GDPR-friendly onboarding and privacy expectations are built for European institutions and partners.",
        "Managed pilots let you start safely before any LMS, portal, or API integration.",
      ],
    },
    capabilities: [
      { title: "Transparent data use", text: "Candidates and administrators can see what data is used during a practice session and its report, with no hidden processing." },
      { title: "GDPR-friendly by design", text: "Onboarding and data handling are shaped around European privacy expectations for schools and partners." },
      { title: "Managed rollout", text: "Start with a controlled pilot and clear data terms before committing to deeper integrations." },
      { title: "Scoped access", text: "Program-level visibility is limited to your administrators, so candidate data stays within your program." },
    ],
    steps: [
      { title: "Review the terms", text: "Your DPO and IT teams review how candidate data is used, retained, and scoped for a practice session." },
      { title: "Run a managed pilot", text: "Start with a controlled cohort and agreed data terms, with no upfront integration required." },
      { title: "Scale with confidence", text: "Once the pilot meets your requirements, expand with integration options that fit your systems." },
    ],
    metrics: [
      { value: "Transparent", label: "candidate data use, explained plainly" },
      { value: "European", label: "privacy expectations built in from the start" },
      { value: "Controlled", label: "pilots before any deeper rollout" },
    ],
    faqs: [
      { q: "What candidate data does WorkZo use?", a: "Practice and reporting are driven by the candidate's CV and target role for that session. We keep the purpose explicit rather than processing data in the background." },
      { q: "Is it suitable for European institutions?", a: "Yes. Onboarding and data handling are designed around GDPR-friendly expectations, and managed rollouts let your DPO review terms before launch." },
      { q: "Do we need a big integration to start?", a: "No. Managed pilots run without an upfront LMS or API integration, so you can evaluate safely before committing to anything deeper." },
      { q: "Who can see candidate results?", a: "Group-level visibility is scoped to your program administrators. You control access, and candidate data stays within your program." },
    ],
  },
  "students": {
    slug: "students",
    eyebrow: "Students & Graduates",
    navLabel: "For Students",
    icon: GraduationCap,
    title: "Walk into your first interview like you have done it before.",
    intro:
      "WorkZo AI runs realistic, CV-aware interviews built from your own resume and a target job, so the nerves, the follow-ups, and the tricky questions happen in practice first. You get a clear score and the exact answers to fix before the real thing.",
    audience: "For students, recent graduates, and first-time job seekers",
    snippet: {
      recruiter: "Your CV mentions a group project. Tell me about a time the team disagreed and what you personally did.",
      candidate: "We disagreed on scope, so I set up a quick vote and split the work by strength, which kept us on track…",
      signal: "Good instinct, needs a concrete result",
      tone: "watch",
    },
    outcomeStats: [
      { value: "Free", label: "to start practising, with no interview experience needed" },
      { value: "5-cat", label: "scoring: communication, relevance, experience, evidence, job fit" },
      { value: "Report", label: "that tells you exactly what to say better next time" },
    ],
    problem: {
      heading: "Why first interviews go wrong",
      points: [
        "You have little to practise on, so the first real interview becomes the practice run.",
        "Classic questions like 'tell me about yourself' and 'your weakness' freeze people who have never rehearsed them out loud.",
        "Advice online is generic. It never reacts to your actual CV or the specific job you applied for.",
      ],
    },
    solution: {
      heading: "How WorkZo helps",
      points: [
        "Practise unlimited realistic interviews built from your CV and the exact role you want.",
        "Get pushed with real follow-ups and pressure, then see a calm, scored breakdown afterwards.",
        "Turn projects, internships, and coursework into strong STAR answers with evidence.",
      ],
    },
    capabilities: [
      { title: "Questions from your real CV", text: "The interview references your own projects, internships, and coursework, so you rehearse defending what you actually did." },
      { title: "The classics, handled", text: "Practise the questions everyone dreads, from 'tell me about yourself' to gaps and weaknesses, until they feel routine." },
      { title: "STAR without the jargon", text: "The report shows you how to structure answers as Situation, Task, Action, Result, using your own words as the example." },
      { title: "Confidence you can measure", text: "A readiness score shows progress across sessions, so you know when you are actually ready to apply." },
    ],
    steps: [
      { title: "Add the job", text: "Upload your CV and paste a job description you are aiming for. The interview is built around that role." },
      { title: "Do the interview", text: "Complete a realistic voice or text interview with a recruiter persona matched to the role." },
      { title: "Fix and repeat", text: "Review your scored report, apply the fixes, and run it again until it feels easy." },
    ],
    metrics: [
      { value: "JD-led", label: "interviews for the role you want, not a generic template" },
      { value: "Any field", label: "from software and data to marketing, finance, and support" },
      { value: "Voice + text", label: "practise the format your real interview will use" },
    ],
    faqs: [
      { q: "I have no work experience. Can I still use it?", a: "Yes. The interview is built from your CV, including projects, internships, volunteering, and coursework, and the report shows you how to turn those into strong answers." },
      { q: "Is it free?", a: "You can start practising for free. Premium adds unlimited sessions, deeper reports, and cross-session coaching that remembers your weak spots." },
      { q: "Will it help with graduate scheme interviews?", a: "Yes. You can practise HR screens, competency questions, and hiring-manager conversations, all built around the specific scheme or role you are applying to." },
      { q: "What if I freeze on the day?", a: "Rehearsing the real questions out loud is the fastest way to stop freezing. The more sessions you run, the more the pressure feels familiar instead of new." },
    ],
  },
  "career-changers": {
    slug: "career-changers",
    eyebrow: "Career Changers",
    navLabel: "For Career Changers",
    icon: Target,
    title: "Make the switch make sense, in the interview.",
    intro:
      "Changing field means one hard job: convincing an interviewer your past experience transfers. WorkZo AI runs realistic interviews for your target role and shows you how to reframe what you have already done into the language of where you are going.",
    audience: "For professionals moving into a new role, function, or industry",
    snippet: {
      recruiter: "Your background is in teaching, but this is a product role. Why should I believe you can do it?",
      candidate: "Teaching is stakeholder management and prioritisation under constraints, which is most of product…",
      signal: "Strong reframe, tie it to a metric",
      tone: "watch",
    },
    outcomeStats: [
      { value: "Reframe", label: "past experience into the target role's language" },
      { value: "5-cat", label: "scoring: communication, relevance, experience, evidence, job fit" },
      { value: "Report", label: "showing exactly where the switch story lands or wobbles" },
    ],
    problem: {
      heading: "Why career changes stall at interview",
      points: [
        "Your CV reads like your old field, so interviewers cannot see the fit for the new one.",
        "The hardest question is always 'why the change', and most people answer it defensively.",
        "Transferable skills are real, but they only count if you can name them and back them with evidence.",
      ],
    },
    solution: {
      heading: "How WorkZo helps",
      points: [
        "Practise interviews built from the target job description, so you rehearse for the role you want next.",
        "Get a clear, confident way to answer 'why the change' that reframes it as a strength.",
        "See which of your past achievements map onto the new role, and how to phrase them.",
      ],
    },
    capabilities: [
      { title: "Skills mapping", text: "The report highlights where your existing experience answers the new role's requirements, so you stop underselling yourself." },
      { title: "The 'why the change' answer", text: "Rehearse the question every changer gets, until you can answer it as a deliberate move rather than an escape." },
      { title: "Evidence over adjectives", text: "Learn to back a transferable skill with a concrete result, which is what turns a claim into a credible one." },
      { title: "Target-role interviews", text: "Personas and questions are built from the job description for your new direction, not your old title." },
    ],
    steps: [
      { title: "Point at the new role", text: "Upload your CV and paste a job description for the field you are moving into." },
      { title: "Run the interview", text: "Answer real questions for that role, including the ones that probe your switch." },
      { title: "Sharpen the story", text: "Use the report to tighten your reframe and your evidence, then run it again." },
    ],
    metrics: [
      { value: "JD-led", label: "70% job description, 30% resume: built for the next role" },
      { value: "Any pivot", label: "function, industry, or seniority changes all supported" },
      { value: "Cross-session", label: "Premium remembers your weak answers and coaches on them" },
    ],
    faqs: [
      { q: "How do I answer 'why are you changing careers'?", a: "WorkZo helps you rehearse a version that frames the change as a deliberate move toward the new role's strengths, backed by a concrete example, rather than a reason you are leaving the old one." },
      { q: "Will it understand my old experience?", a: "Yes. The interview is built from your CV, and the report shows which past achievements map onto the target role and how to phrase them for a new audience." },
      { q: "I do not have direct experience yet. Does that matter?", a: "Most changers do not. The goal is to prove transferable skills with evidence, and the tool coaches exactly that, question by question." },
      { q: "Can I practise for a specific job?", a: "Yes. Paste the job description and the interview, questions, and report are all tailored to that role." },
    ],
  },
  "career-coaches": {
    slug: "career-coaches",
    eyebrow: "Career Coaches",
    navLabel: "For Career Coaches",
    icon: Handshake,
    title: "Give every client realistic reps between sessions.",
    intro:
      "You cannot sit in a mock interview with every client every week. WorkZo AI gives your clients unlimited realistic, CV-aware practice on their own time, then hands you a scored report so your sessions go straight to the coaching that matters.",
    audience: "For independent career coaches, CV writers, and outplacement teams",
    snippet: {
      recruiter: "You mentioned leading a turnaround. What was the single decision you are most proud of, and why?",
      candidate: "Cutting the two lowest-margin products, which lifted focus and margin within a quarter…",
      signal: "Clear and quantified, strong answer",
      tone: "good",
    },
    outcomeStats: [
      { value: "24/7", label: "practice for clients, without more of your hours" },
      { value: "Report", label: "you can coach from, with quotes and weak moments" },
      { value: "5-cat", label: "scoring you can track across a client's sessions" },
    ],
    problem: {
      heading: "What limits coaching outcomes",
      points: [
        "Live mock interviews do not scale, so clients get a handful of reps when they need dozens.",
        "You spend session time surfacing weak answers instead of fixing them.",
        "It is hard to show a client measurable progress between the start and the offer.",
      ],
    },
    solution: {
      heading: "How WorkZo helps",
      points: [
        "Clients practise unlimited realistic interviews built from their CV and target role, whenever they want.",
        "Each session produces a scored report, so you walk in already knowing what to coach.",
        "Readiness scores across sessions give you and your client clear proof of progress.",
      ],
    },
    capabilities: [
      { title: "Practice that scales", text: "Clients run as many realistic interviews as they need between your sessions, so your time goes to judgement, not repetition." },
      { title: "Coach from the report", text: "Every session quotes the client's own answers and flags the weakest moments, so you start each session on the real problem." },
      { title: "Measurable progress", text: "Track a readiness score across sessions to show clients, and referrers, the value of the work." },
      { title: "Your method, amplified", text: "WorkZo handles the reps and the scoring. You stay the expert who turns the report into a breakthrough." },
    ],
    steps: [
      { title: "Set the target", text: "Your client uploads their CV and pastes the job description for the role they are chasing." },
      { title: "They practise", text: "The client runs realistic interviews with recruiter personas matched to the role and company style." },
      { title: "You coach the gaps", text: "Review the scored report together and focus your session on the highest-impact fixes." },
    ],
    metrics: [
      { value: "11", label: "recruiter personas across HR, technical, and hiring-manager styles" },
      { value: "Any role", label: "from graduate to executive, across industries" },
      { value: "Partner", label: "options available for coaches running client cohorts" },
    ],
    faqs: [
      { q: "Can I use this with my own clients?", a: "Yes. Clients practise on their own time and share their reports with you, and we offer partner options for coaches who want to run structured cohorts." },
      { q: "Does it replace what I do?", a: "No. WorkZo handles the reps and the scoring so your expertise goes to interpretation and coaching, which is where clients get the real breakthrough." },
      { q: "How do I show clients progress?", a: "Readiness scores across sessions give you a simple, honest way to show movement from the first practice to interview-ready." },
      { q: "What does a partner setup look like?", a: "We can set up a shared pool for your clients with the recruiter personas that match the roles you coach for. Reach out through the form below to scope it." },
    ],
  },
};

const SEGMENT_ORDER = Object.keys(SEGMENTS);

export function generateStaticParams() {
  return SEGMENT_ORDER.map((segment) => ({ segment }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string }>;
}): Promise<Metadata> {
  const { segment } = await params;
  const page = SEGMENTS[segment];
  if (!page) return { title: "WorkZo AI for Education" };
  return {
    title: `${page.eyebrow}, WorkZo AI for Education`,
    description: page.intro,
    openGraph: { title: `${page.eyebrow}, WorkZo AI`, description: page.intro },
  };
}

export default async function EducationDetailPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  const page = SEGMENTS[segment];
  if (!page) notFound();

  const Icon = page.icon;
  const related = SEGMENT_ORDER.filter((s) => s !== segment).slice(0, 3).map((s) => SEGMENTS[s]);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/for-education">All education solutions</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_460px]">
          <Reveal>
            <Eyebrow icon={Icon}>{page.eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              {page.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{page.intro}</p>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-brand">{page.audience}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="#contact">Request a demo</PrimaryButton>
              {page.slug === "admin-dashboard" ? (
                <GhostButton href="/admin">See a live demo</GhostButton>
              ) : (
                <GhostButton href="/pricing">See plans</GhostButton>
              )}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[1.75rem] border border-line bg-surface/80 p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted">
                <MessagesSquare className="h-4 w-4 text-brand" /> Inside a WorkZo session
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl rounded-tl-sm border border-line bg-fg/[0.04] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand">Recruiter</p>
                  <p className="mt-1.5 text-sm leading-6 text-fg">{page.snippet.recruiter}</p>
                </div>
                <div className="ml-6 rounded-2xl rounded-tr-sm border border-line bg-brand/[0.06] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">Candidate</p>
                  <p className="mt-1.5 text-sm leading-6 text-fg">{page.snippet.candidate}</p>
                </div>
              </div>
              <div
                className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
                  page.snippet.tone === "good"
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-warning/25 bg-warning/10 text-warning"
                }`}
              >
                <Target className="h-4 w-4 shrink-0" /> {page.snippet.signal}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={80} className="mt-14">
          <StatBand stats={page.outcomeStats} />
        </Reveal>
      </section>

      {/* Problem / solution */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-line bg-fg/[0.03] p-6 sm:p-8">
              <h2 className="text-xl font-black tracking-tight">{page.problem.heading}</h2>
              <ul className="mt-5 space-y-4">
                {page.problem.points.map((p) => (
                  <li key={p} className="flex gap-3 text-sm leading-6 text-muted">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger/70" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-brand/20 bg-brand/[0.05] p-6 sm:p-8">
              <h2 className="text-xl font-black tracking-tight">{page.solution.heading}</h2>
              <ul className="mt-5 space-y-4">
                {page.solution.points.map((p) => (
                  <li key={p} className="flex gap-3 text-sm leading-6 text-fg">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="What you get"
            title="Built on the same interview engine every WorkZo user runs"
            intro={`Tuned for ${page.eyebrow.toLowerCase()}, driven by the job description, not a generic question bank.`}
          />
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {page.capabilities.map((c, i) => (
            <Reveal key={c.title} delay={i * 60}>
              <FeatureCard icon={Sparkles} title={c.title}>{c.text}</FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-canvas-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading eyebrow="How it works" title="Three steps, inside your program" />
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {page.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="relative h-full rounded-2xl border border-line bg-surface p-6">
                  <span className="text-sm font-black tabular-nums text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-black tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid gap-6 rounded-[2rem] border border-line bg-gradient-to-br from-brand/[0.10] via-surface/60 to-transparent p-8 sm:grid-cols-3 sm:p-10">
            {page.metrics.map((m) => (
              <div key={m.label}>
                <span className="text-3xl font-black tracking-tight text-fg">{m.value}</span>
                <span className="mt-3 block text-sm leading-6 text-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Questions we hear" />
        </Reveal>
        <Reveal delay={80} className="mt-8">
          <FaqAccordion items={page.faqs.map((f) => ({ q: f.q, a: f.a }))} />
        </Reveal>
      </section>

      {/* Related */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>Explore other solutions</Eyebrow>
        </Reveal>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {related.map((r, i) => {
            const RIcon = r.icon;
            return (
              <Reveal key={r.slug} delay={i * 60}>
                <Link
                  href={`/for-education/${r.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-brand/30 hover:bg-surface"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-on-brand">
                    <RIcon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-black text-fg">{r.navLabel}</span>
                  <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Request a demo"
          title={`Bring WorkZo AI to your ${page.eyebrow.toLowerCase()}`}
          intro="We reply within one business day and shape the pilot around your cohort."
        />
        <div className="mt-8">
          <B2BLeadForm source={`education-${segment}`} />
        </div>
      </section>

      <CTASection
        title={`Ready to prepare your ${page.eyebrow.toLowerCase()} cohort?`}
        intro="Tell us your group size, target roles, and timeline. We'll help you shape a practical pilot before a full rollout."
        primary={{ href: "#contact", label: "Request a demo" }}
        secondary={{ href: "/for-education", label: "Back to overview" }}
      />
    </MarketingShell>
  );
}
