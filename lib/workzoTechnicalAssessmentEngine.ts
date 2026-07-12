/**
 * lib/workzoTechnicalAssessmentEngine.ts
 *
 * Phase 2 of the WorkZo roadmap: Technical Assessments.
 *
 * Generates role-specific technical test questions, evaluates answers,
 * and produces a technicalScore (0-100) that feeds into the Readiness Score.
 *
 * Supported role clusters:
 *   - Data Analyst / BI       → SQL, Excel, Power BI / Tableau, Statistics
 *   - Software Engineer       → Python / Java, System Design, Algorithms
 *   - Customer Success        → Stakeholder scenarios, Escalation, Account Mgmt
 *   - Technical Support / IT  → Troubleshooting, Networking, ITIL
 *   - Product Manager         → Roadmap, Prioritisation, Stakeholder, Metrics
 *   - Marketing / Growth      → Campaign analysis, Funnel, A/B Testing
 *
 * Assessment types:
 *   "multiple_choice", choose 1 from 4 options (auto-scored)
 *   "open_text"      , free-text answer (LLM-scored via evaluateTechnicalAnswer)
 *   "scenario"       , situational prompt (LLM-scored)
 *   "sql"            , write a SQL query (pattern-scored + LLM)
 *   "code"           , write code (pattern-scored + LLM)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TechnicalQuestionType =
  | "multiple_choice"
  | "open_text"
  | "scenario"
  | "sql"
  | "code";

export type TechnicalDifficulty = "foundational" | "intermediate" | "advanced";

export type TechnicalQuestion = {
  id: string;
  skill: string;
  type: TechnicalQuestionType;
  difficulty: TechnicalDifficulty;
  question: string;
  context?: string;                   // schema / table / dataset for SQL/code questions
  options?: string[];                 // only for multiple_choice
  correctOption?: number;             // 0-indexed, only for multiple_choice
  scoringGuide: string;               // what a good answer contains
  timeSeconds: number;                // suggested time limit

  // ── Fields that turn a question into something GRADABLE ─────────────────
  // Without these, "did my student solve it?" is answered by a language model
  // reading the code, which is an opinion. With them it is answered by running
  // the code, which is a fact. All optional: a question that lacks them still
  // works, it just degrades honestly to "unverifiable" instead of faking a
  // verdict it did not earn.

  /** code questions: the function the candidate must define. */
  entryPoint?: string;
  /** code questions: executed against the candidate's function for a real pass/fail. */
  tests?: Array<{ args: unknown[]; expected: unknown; hidden?: boolean }>;
  /** sql questions: run on the same seeded data, then result sets are compared. */
  referenceSolution?: string;
};

export type TechnicalAssessment = {
  roleCluster: string;
  targetRole: string;
  difficulty: TechnicalDifficulty;
  questions: TechnicalQuestion[];
  totalQuestions: number;
  estimatedMinutes: number;
};

export type TechnicalAnswerResult = {
  questionId: string;
  skill: string;
  score: number;                      // 0-100
  passed: boolean;                    // score >= 60
  feedback: string;
  strengths: string[];
  gaps: string[];
};

export type TechnicalAssessmentResult = {
  roleCluster: string;
  targetRole: string;
  technicalScore: number;             // 0-100, weighted average
  passed: boolean;                    // technicalScore >= 65
  grade: "A" | "B" | "C" | "D" | "F";
  bySkill: TechnicalAnswerResult[];
  strongestSkill: string;
  weakestSkill: string;
  recommendation: string;
  readyForRole: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CLUSTER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type RoleCluster =
  | "data_analyst"
  | "software_engineer"
  | "customer_success"
  | "technical_support"
  | "product_manager"
  | "marketing_growth"
  | "general";

const CLUSTER_PATTERNS: Array<{ cluster: RoleCluster; patterns: RegExp }> = [
  {
    cluster: "data_analyst",
    patterns:
      /\b(data analyst|business analyst|bi analyst|analytics engineer|data scientist|reporting analyst|insights analyst|power bi|tableau|sql analyst)\b/i,
  },
  {
    cluster: "software_engineer",
    patterns:
      /\b(software engineer|software developer|backend|frontend|full.?stack|python developer|java developer|web developer|mobile developer|devops|sre|platform engineer)\b/i,
  },
  {
    cluster: "customer_success",
    patterns:
      /\b(customer success|account manager|csm|client success|customer manager|onboarding|renewal|account executive|key account)\b/i,
  },
  {
    cluster: "technical_support",
    patterns:
      /\b(technical support|it support|helpdesk|help desk|service desk|support engineer|systems administrator|network engineer|it engineer)\b/i,
  },
  {
    cluster: "product_manager",
    patterns:
      /\b(product manager|product owner|program manager|scrum master|product lead|head of product|chief product)\b/i,
  },
  {
    cluster: "marketing_growth",
    patterns:
      /\b(marketing|growth|demand generation|performance marketing|seo|sem|paid media|campaign manager|brand manager|content marketer|growth hacker)\b/i,
  },
];

export function detectRoleCluster(targetRole: string): RoleCluster {
  const role = String(targetRole || "");
  for (const { cluster, patterns } of CLUSTER_PATTERNS) {
    if (patterns.test(role)) return cluster;
  }
  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANKS, per cluster
// ─────────────────────────────────────────────────────────────────────────────

const DATA_ANALYST_QUESTIONS: TechnicalQuestion[] = [
  // SQL
  {
    id: "da_sql_01",
    skill: "SQL",
    type: "sql",
    difficulty: "foundational",
    question:
      "You have a table called `orders` with columns: order_id, customer_id, order_date, total_amount, status. Write a SQL query to find the total revenue per customer for orders where status = 'completed', ordered by total revenue descending.",
    context:
      "Table: orders(order_id INT, customer_id INT, order_date DATE, total_amount DECIMAL, status VARCHAR)",
    scoringGuide:
      "Must include: SELECT customer_id, SUM(total_amount), FROM orders, WHERE status = 'completed', GROUP BY customer_id, ORDER BY SUM DESC. Bonus: alias, HAVING.",
    // Run against the SAME seeded data as the candidate's query, then the result
    // SETS are compared. Aliases and formatting are ignored, so this grades the
    // answer, not the prose.
    referenceSolution:
      "SELECT customer_id, SUM(total_amount) AS revenue FROM orders WHERE status = 'completed' GROUP BY customer_id ORDER BY revenue DESC",
    timeSeconds: 180,
  },
  {
    id: "da_sql_02",
    skill: "SQL",
    type: "sql",
    difficulty: "intermediate",
    question:
      "Given two tables, `customers(customer_id, name, country)` and `orders(order_id, customer_id, order_date, total_amount)`, write a query to find all customers who placed more than 3 orders in the last 90 days. Return customer name and order count.",
    context:
      "Tables: customers(customer_id, name, country), orders(order_id, customer_id, order_date, total_amount)",
    scoringGuide:
      "Must JOIN both tables, filter by date (e.g. order_date >= NOW() - INTERVAL 90 DAY), GROUP BY customer_id, HAVING COUNT > 3. Return name and count.",
    referenceSolution:
      "SELECT c.name, COUNT(o.order_id) AS order_count FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_date >= date('now','-90 day') GROUP BY c.customer_id, c.name HAVING COUNT(o.order_id) > 3",
    timeSeconds: 240,
  },
  {
    id: "da_sql_03",
    skill: "SQL",
    type: "open_text",
    difficulty: "advanced",
    question:
      "A query joining 3 tables is taking 45 seconds to run on a 10 million row fact table. Walk me through your optimisation approach, what do you look at first, and what changes would you make?",
    scoringGuide:
      "Good answer covers: EXPLAIN plan, index checks, avoid SELECT *, filter early (push WHERE before joins), check join order, consider partitioning, avoid functions on indexed columns, materialised views.",
    timeSeconds: 180,
  },
  // Excel
  {
    id: "da_excel_01",
    skill: "Excel",
    type: "multiple_choice",
    difficulty: "foundational",
    question:
      "You have customer data in columns A-D (customer_id, name, region, revenue). You want to sum revenue for all customers in 'North' region. Which formula is correct?",
    options: [
      "=SUMIF(C:C, \"North\", D:D)",
      "=VLOOKUP(\"North\", A:D, 4, FALSE)",
      "=SUM(IF(C:C=\"North\", D:D))",
      "=COUNTIF(C:C, \"North\")",
    ],
    correctOption: 0,
    scoringGuide: "Correct: SUMIF. VLOOKUP returns a lookup, not a sum. Array formula version also acceptable.",
    timeSeconds: 60,
  },
  {
    id: "da_excel_02",
    skill: "Excel",
    type: "open_text",
    difficulty: "intermediate",
    question:
      "Describe how you would build a monthly revenue dashboard in Excel from a raw transaction table. Walk through your approach step by step.",
    scoringGuide:
      "Good answer: clean raw data, create Pivot Table by month/region/product, use slicers for filtering, GETPIVOTDATA or INDEX/MATCH for KPI summary, charts linked to pivot, conditional formatting for targets.",
    timeSeconds: 180,
  },
  // Statistics
  {
    id: "da_stats_01",
    skill: "Statistics",
    type: "multiple_choice",
    difficulty: "intermediate",
    question:
      "You run an A/B test. Variant B has a 5% higher conversion rate than Control A. The p-value is 0.08. What do you do?",
    options: [
      "Ship Variant B, a 5% lift is significant enough",
      "Do not ship, the result is not statistically significant at p < 0.05",
      "Ship Variant B, p-value close to 0.05 is good enough",
      "The p-value doesn't matter if the lift is positive",
    ],
    correctOption: 1,
    scoringGuide:
      "Correct: p=0.08 > 0.05 threshold means we cannot reject the null hypothesis. Result is not statistically significant. Should not ship based on this test.",
    timeSeconds: 60,
  },
  // Scenario
  {
    id: "da_scenario_01",
    skill: "Data Investigation",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "A dashboard you own suddenly shows a 40% drop in daily active users yesterday compared to the previous 7-day average. Your manager is asking for an explanation by 10am. What do you do, step by step?",
    scoringGuide:
      "Strong answer: check if data pipeline ran (ETL/refresh), compare to same day last week (seasonality), check raw data vs reporting layer, look for tracking code issues or event drops, narrow by segment (platform/geo/device), then escalate with hypothesis not just 'still investigating'.",
    timeSeconds: 240,
  },
];

const SOFTWARE_ENGINEER_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "se_algo_01",
    skill: "Algorithms",
    type: "code",
    difficulty: "intermediate",
    question:
      "Write a function that takes an array of integers and returns the two numbers that add up to a target sum. Return their indices. Example: [2, 7, 11, 15], target=9 → [0, 1]",
    context: "Language: Python or JavaScript (your choice)",
    scoringGuide:
      "Optimal: hash map O(n). Acceptable: nested loop O(n²). Must handle edge cases: no solution, negative numbers, duplicates.",
    entryPoint: "two_sum",
    // The hidden cases are the ones that matter. The negative-numbers case and
    // the no-solution case are exactly what a nested loop that allows i == j
    // gets wrong, and exactly what a model reading the code waves through.
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[-1, -2, -3, -4], -6], expected: [1, 3], hidden: true },
      { args: [[3, 3], 6], expected: [0, 1], hidden: true },
      { args: [[1, 2], 99], expected: null, hidden: true },
    ],
    timeSeconds: 300,
  },
  {
    id: "se_design_01",
    skill: "System Design",
    type: "open_text",
    difficulty: "advanced",
    question:
      "Design a URL shortener service like bit.ly. Describe the key components, data model, how you'd generate short codes, and how you'd handle 100 million requests per day.",
    scoringGuide:
      "Must cover: API layer, hash/encode algorithm (base62), database (key-value store for speed), cache layer (Redis for hot URLs), redirect HTTP 301/302, potential for analytics, scalability (sharding, CDN).",
    timeSeconds: 600,
  },
  {
    id: "se_concept_01",
    skill: "Computer Science",
    type: "multiple_choice",
    difficulty: "intermediate",
    question: "What is the time complexity of binary search?",
    options: ["O(n)", "O(n log n)", "O(log n)", "O(1)"],
    correctOption: 2,
    scoringGuide: "O(log n), halves the search space each step.",
    timeSeconds: 30,
  },
  {
    id: "se_scenario_01",
    skill: "Debugging",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "A production API endpoint is returning 200 OK but the response body is empty for some users. The error only happens for users with email addresses containing a '+' character. Walk me through your debugging process.",
    scoringGuide:
      "Strong answer: reproduce locally with '+' email, check URL encoding (+ vs %2B), check server-side input parsing/validation, trace request through logs, check if middleware strips special chars, fix + add regression test.",
    timeSeconds: 240,
  },
  {
    id: "se_python_01",
    skill: "Python",
    type: "code",
    difficulty: "foundational",
    question:
      "Write a function `spend_by_category(rows)` that takes a list of transactions, each a dict with keys `date`, `amount`, and `category`, and returns a list of [category, total] pairs sorted by total descending. Ignore rows whose amount is missing or not a number.",
    // Reframed from "reads a CSV file" to "takes a list of rows". The sandbox has
    // no filesystem, so the original question could never be RUN, only described.
    // The skill being tested (aggregate, sort, handle dirty input) is identical,
    // and now it is gradable.
    context: "rows: list of dicts, e.g. {\"date\": \"2024-01-05\", \"amount\": 12.5, \"category\": \"groceries\"}. Some rows have a missing or invalid amount.",
    scoringGuide:
      "Must: aggregate by category, sort descending by total, skip rows with a missing or non-numeric amount. Bonus: uses a dict accumulator rather than repeated scans; does not crash on an empty list.",
    entryPoint: "spend_by_category",
    tests: [
      {
        args: [[
          { date: "2024-01-01", amount: 10, category: "food" },
          { date: "2024-01-02", amount: 5, category: "transport" },
          { date: "2024-01-03", amount: 20, category: "food" },
        ]],
        expected: [["food", 30], ["transport", 5]],
      },
      // The dirty-data case. This is the one that separates a real answer from a
      // textbook one, and it is invisible to anyone eyeballing the code.
      {
        args: [[
          { date: "2024-01-01", amount: 10, category: "food" },
          { date: "2024-01-02", amount: null, category: "food" },
          { date: "2024-01-03", amount: "oops", category: "transport" },
          { date: "2024-01-04", amount: 4, category: "transport" },
        ]],
        expected: [["food", 10], ["transport", 4]],
        hidden: true,
      },
      { args: [[]], expected: [], hidden: true },
    ],
    timeSeconds: 240,
  },
];

const CUSTOMER_SUCCESS_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "cs_scenario_01",
    skill: "Escalation Handling",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "A key enterprise client (£200k ARR) sends you an angry email at 4:30pm on Friday saying they're considering cancellation. They've had 3 unresolved support tickets for 2 weeks and feel ignored. How do you respond, and what do you do next?",
    scoringGuide:
      "Strong: respond within 30 min acknowledging frustration, don't be defensive, take personal ownership ('I will personally oversee this'), schedule a call for Monday AM, loop in support lead immediately, get all 3 tickets reviewed before the call, prepare a recovery plan not just an apology.",
    timeSeconds: 300,
  },
  {
    id: "cs_scenario_02",
    skill: "Renewal & Retention",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "You're 60 days from renewal with an account that hasn't logged into your product in 45 days. Their contract is £80k/year. They haven't responded to your last two emails. What's your plan?",
    scoringGuide:
      "Strong: don't send another generic email, call, get internal champion on side, find out what changed (new budget pressure? competing tool? team change?), prepare ROI data to show value delivered, offer a re-onboarding session, escalate to your manager if needed. Flag as at-risk internally.",
    timeSeconds: 300,
  },
  {
    id: "cs_stakeholder_01",
    skill: "Stakeholder Management",
    type: "open_text",
    difficulty: "intermediate",
    question:
      "You're in a quarterly business review with a client's VP of Operations. They say: 'Honestly, we're not sure your product has moved the needle for us.' How do you respond in the room, and what do you do after?",
    scoringGuide:
      "Strong: don't get defensive, ask clarifying questions ('What metrics are you using to measure that?'), present the usage data and outcomes you've tracked, acknowledge any gaps honestly, propose a specific success plan with measurable goals for next quarter.",
    timeSeconds: 240,
  },
  {
    id: "cs_metric_01",
    skill: "Metrics",
    type: "multiple_choice",
    difficulty: "foundational",
    question: "Which metric is most directly a leading indicator of customer churn risk?",
    options: [
      "Monthly Recurring Revenue (MRR)",
      "Product adoption rate / daily active usage",
      "Number of support tickets filed",
      "Net Promoter Score (NPS) from 6 months ago",
    ],
    correctOption: 1,
    scoringGuide:
      "Product adoption/usage is the strongest leading indicator, customers who stop using the product churn before they say they will. NPS is lagging. MRR measures revenue not risk. Ticket volume is indirect.",
    timeSeconds: 60,
  },
  {
    id: "cs_scenario_03",
    skill: "Account Expansion",
    type: "scenario",
    difficulty: "advanced",
    question:
      "You have a customer who is happy, hits all their success metrics, and their contract is up for renewal in 3 months. Their team of 20 could realistically expand to 50 seats. How do you structure the expansion conversation?",
    scoringGuide:
      "Strong: don't lead with price, lead with value already delivered + ROI data. Build a business case for expansion (what does 50 seats unlock?). Identify internal champion who benefits from expansion. Time the ask 8-12 weeks before renewal. Handle procurement early. Offer a phased expansion plan.",
    timeSeconds: 300,
  },
];

const TECHNICAL_SUPPORT_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "ts_scenario_01",
    skill: "Troubleshooting",
    type: "scenario",
    difficulty: "foundational",
    question:
      "A user calls saying they can browse the internet but cannot send or receive emails. They're using Outlook on Windows 10. Walk me through your troubleshooting process.",
    scoringGuide:
      "Structured approach: verify credentials, check Outlook settings (SMTP/IMAP config), test webmail (is it a client issue?), check firewall/antivirus blocking port 587/993, check email server status, check .pst file corruption. Systematic elimination, don't assume.",
    timeSeconds: 240,
  },
  {
    id: "ts_network_01",
    skill: "Networking",
    type: "multiple_choice",
    difficulty: "foundational",
    question: "A user can ping 8.8.8.8 (Google DNS) successfully but cannot browse any websites. What is the most likely cause?",
    options: [
      "The user's network cable is unplugged",
      "DNS resolution is failing",
      "The router has no internet access",
      "The user's IP address is incorrect",
    ],
    correctOption: 1,
    scoringGuide:
      "DNS failure, they can reach an IP (proving connectivity) but cannot resolve domain names to IPs. Check DNS settings / try alternate DNS (8.8.8.8 as DNS server).",
    timeSeconds: 60,
  },
  {
    id: "ts_itil_01",
    skill: "ITIL",
    type: "multiple_choice",
    difficulty: "intermediate",
    question: "According to ITIL, what is the difference between an Incident and a Problem?",
    options: [
      "An Incident is planned; a Problem is unplanned",
      "An Incident is a single disruption; a Problem is the underlying root cause of one or more Incidents",
      "A Problem is always more urgent than an Incident",
      "There is no difference, the terms are interchangeable",
    ],
    correctOption: 1,
    scoringGuide:
      "ITIL definition: Incident = unplanned disruption to a service. Problem = root cause of one or more incidents. Problem management aims to prevent recurrence.",
    timeSeconds: 60,
  },
  {
    id: "ts_scenario_02",
    skill: "Escalation",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "You're 20 minutes into a call with a frustrated VIP customer. You've tried the standard fixes and nothing has worked. You've never seen this issue before. Your team lead is in a meeting. What do you do?",
    scoringGuide:
      "Strong: empathise and set expectation ('I want to make sure this is fully resolved, I'm going to escalate this to our senior team right now'), document everything tried so far, send a Teams/Slack message to team lead with full context, log as Priority 1, callback the customer within 30 min with an update even if no fix yet.",
    timeSeconds: 240,
  },
];

const PRODUCT_MANAGER_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "pm_prioritise_01",
    skill: "Prioritisation",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "Your backlog has 40 items. Engineering can only build 5 things this quarter. You have competing requests from Sales, Customer Success, and your own data insights. How do you decide what to build?",
    scoringGuide:
      "Strong: apply a framework (RICE, ICE, Value vs Effort). Tie each item to a company/product goal. Distinguish customer requests from signals (the 'what' vs 'why'). Validate top items with user research. Get stakeholder alignment before finalising. Don't let loudest voice win.",
    timeSeconds: 300,
  },
  {
    id: "pm_metrics_01",
    skill: "Metrics",
    type: "open_text",
    difficulty: "intermediate",
    question:
      "You launched a new onboarding flow 2 weeks ago. How do you know if it worked? What metrics do you look at, and what would tell you it failed?",
    scoringGuide:
      "Strong: primary metric (activation rate, time-to-value, completion rate of onboarding steps), secondary metrics (D7 retention, support tickets filed in first week, feature adoption). Failure signals: drop-off at specific step, increased support tickets, lower D7 retention vs control.",
    timeSeconds: 240,
  },
  {
    id: "pm_stakeholder_01",
    skill: "Stakeholder Alignment",
    type: "scenario",
    difficulty: "advanced",
    question:
      "The VP of Sales wants a feature that will help close 2 specific enterprise deals this quarter. Your data shows it would only benefit ~3% of your user base and has no product-market-fit signal. How do you handle this?",
    scoringGuide:
      "Strong: acknowledge commercial importance, but don't just say yes, quantify the tradeoff (what are you not building?), explore alternatives (can it be done in a limited/configurable way?), involve CEO if needed, document the decision with rationale. Protect roadmap integrity while being business-aware.",
    timeSeconds: 300,
  },
  {
    id: "pm_concept_01",
    skill: "Product Concepts",
    type: "multiple_choice",
    difficulty: "foundational",
    question: "What does 'time to value' (TTV) measure?",
    options: [
      "How long it takes to build a feature",
      "The time between a customer signing up and experiencing the core value of your product",
      "How much revenue a customer generates in their first month",
      "The number of support tickets filed in the first 30 days",
    ],
    correctOption: 1,
    scoringGuide:
      "TTV = time from signup to 'aha moment' / first value experience. Lower TTV → better onboarding → better retention.",
    timeSeconds: 45,
  },
];

const MARKETING_GROWTH_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "mkt_funnel_01",
    skill: "Funnel Analysis",
    type: "scenario",
    difficulty: "intermediate",
    question:
      "Your paid search campaign has a 3% CTR but only a 0.4% conversion to trial. Industry average trial conversion from paid search is 2.5%. Walk me through how you'd diagnose the problem.",
    scoringGuide:
      "Strong: CTR is fine (ad is working), conversion drop means landing page or offer problem. Check: landing page load time, message match (ad → page), CTA clarity, form friction (too many fields?), page trust signals, A/B test landing page variants. Also check traffic quality (keyword intent alignment).",
    timeSeconds: 240,
  },
  {
    id: "mkt_abtest_01",
    skill: "A/B Testing",
    type: "open_text",
    difficulty: "intermediate",
    question:
      "Walk me through how you'd set up an A/B test for a new email subject line. What do you control for, how do you determine sample size, and how do you call a winner?",
    scoringGuide:
      "Must cover: hypothesis, single variable test (just subject line), random split, statistical significance threshold (p < 0.05), minimum sample size calculation (use power analysis or calculator), primary metric (open rate or conversion, not just opens), run for full business cycle (at least 1 week), don't peek early.",
    timeSeconds: 240,
  },
  {
    id: "mkt_metric_01",
    skill: "Growth Metrics",
    type: "multiple_choice",
    difficulty: "foundational",
    question: "If CAC is €200 and monthly revenue per customer is €50 with a 24-month average lifetime, what is the LTV:CAC ratio?",
    options: ["2:1", "6:1", "3:1", "12:1"],
    correctOption: 1,
    scoringGuide: "LTV = €50 × 24 = €1,200. LTV:CAC = 1200/200 = 6:1. Healthy ratio is 3:1 or higher.",
    timeSeconds: 60,
  },
];

const GENERAL_QUESTIONS: TechnicalQuestion[] = [
  {
    id: "gen_problem_01",
    skill: "Problem Solving",
    type: "scenario",
    difficulty: "foundational",
    question:
      "You've been asked to improve a process that currently takes your team 3 hours per week of manual work. You have 2 weeks and no budget. Walk me through your approach from start to finish.",
    scoringGuide:
      "Strong: map the current process (what exactly are the 3 hours?), identify the bottleneck, explore low-cost solutions (automation with existing tools, templates, delegation), test with smallest possible experiment, measure time saved before declaring success.",
    timeSeconds: 240,
  },
  {
    id: "gen_data_01",
    skill: "Data Literacy",
    type: "multiple_choice",
    difficulty: "foundational",
    question:
      "Your manager says 'sales are up 20% month on month'. Which of these would make you question that claim before acting on it?",
    options: [
      "Whether the 20% includes refunds and cancellations",
      "Whether the comparison month had any anomalies (holiday, promotion, one-time deal)",
      "Whether revenue or just units are up 20%",
      "All of the above",
    ],
    correctOption: 3,
    scoringGuide:
      "All three are valid data quality checks. Good data literacy means asking about the denominator, comparison context, and metric definition before acting.",
    timeSeconds: 45,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK MAP
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_BANK: Record<RoleCluster, TechnicalQuestion[]> = {
  data_analyst: DATA_ANALYST_QUESTIONS,
  software_engineer: SOFTWARE_ENGINEER_QUESTIONS,
  customer_success: CUSTOMER_SUCCESS_QUESTIONS,
  technical_support: TECHNICAL_SUPPORT_QUESTIONS,
  product_manager: PRODUCT_MANAGER_QUESTIONS,
  marketing_growth: MARKETING_GROWTH_QUESTIONS,
  general: GENERAL_QUESTIONS,
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function buildTechnicalAssessment(input: {
  targetRole: string;
  cvText?: string;
  difficulty?: TechnicalDifficulty;
  maxQuestions?: number;
}): TechnicalAssessment {
  const cluster = detectRoleCluster(input.targetRole);
  const difficulty = input.difficulty || inferDifficulty(input.cvText || "", input.targetRole);
  const allQuestions = QUESTION_BANK[cluster] || QUESTION_BANK.general;
  const maxQ = Math.min(input.maxQuestions || 5, 8);

  // Filter by difficulty: foundational always included, harder ones only if level allows
  const eligible = allQuestions.filter((q) => {
    if (difficulty === "foundational") return q.difficulty === "foundational";
    if (difficulty === "intermediate") return q.difficulty !== "advanced";
    return true; // advanced: all questions
  });

  // Pick a spread of skills, not all the same
  const selected = pickDiverseQuestions(eligible, maxQ);
  const estimatedMinutes = Math.ceil(selected.reduce((sum, q) => sum + q.timeSeconds, 0) / 60);

  return {
    roleCluster: cluster,
    targetRole: input.targetRole,
    difficulty,
    questions: selected,
    totalQuestions: selected.length,
    estimatedMinutes,
  };
}

function inferDifficulty(cvText: string, targetRole: string): TechnicalDifficulty {
  const text = (cvText + " " + targetRole).toLowerCase();
  if (/\b(senior|lead|principal|head|director|manager|7\+|8\+|9\+|10\+)\b/.test(text)) return "advanced";
  if (/\b(junior|graduate|entry|fresher|intern|1 year|2 years|bootcamp)\b/.test(text)) return "foundational";
  return "intermediate";
}

function pickDiverseQuestions(questions: TechnicalQuestion[], max: number): TechnicalQuestion[] {
  const bySkill = new Map<string, TechnicalQuestion[]>();
  for (const q of questions) {
    if (!bySkill.has(q.skill)) bySkill.set(q.skill, []);
    bySkill.get(q.skill)!.push(q);
  }
  const selected: TechnicalQuestion[] = [];
  // Round-robin across skills
  const skills = Array.from(bySkill.keys());
  let i = 0;
  while (selected.length < max) {
    const skill = skills[i % skills.length];
    const pool = bySkill.get(skill)!;
    const pick = pool.find((q) => !selected.includes(q));
    if (pick) selected.push(pick);
    i++;
    if (i > skills.length * 3) break; // safety
  }
  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING, multiple choice (deterministic)
// ─────────────────────────────────────────────────────────────────────────────

export function scoreMultipleChoice(
  question: TechnicalQuestion,
  selectedOption: number,
): TechnicalAnswerResult {
  const correct = question.correctOption ?? 0;
  const passed = selectedOption === correct;
  return {
    questionId: question.id,
    skill: question.skill,
    score: passed ? 100 : 0,
    passed,
    feedback: passed
      ? "Correct answer selected."
      : `Incorrect. The correct answer was: "${question.options?.[correct]}"`,
    strengths: passed ? [`Solid knowledge of ${question.skill}`] : [],
    gaps: passed ? [] : [`Review ${question.skill} fundamentals, ${question.scoringGuide}`],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING, open text / SQL / code / scenario (pattern-based pre-score)
// These are augmented by the LLM in evaluateTechnicalAnswer below.
// ─────────────────────────────────────────────────────────────────────────────

export function preScoreOpenAnswer(
  question: TechnicalQuestion,
  answer: string,
): number {
  if (!answer || answer.trim().length < 10) return 0;

  const a = answer.toLowerCase();
  const wordCount = a.split(/\s+/).filter(Boolean).length;
  let score = 30; // base for any substantive answer

  if (wordCount >= 30) score += 10;
  if (wordCount >= 80) score += 10;

  // SQL-specific signals
  if (question.type === "sql") {
    if (/\bselect\b/.test(a)) score += 8;
    if (/\bfrom\b/.test(a)) score += 8;
    if (/\bwhere\b/.test(a)) score += 8;
    if (/\bgroup by\b/.test(a)) score += 8;
    if (/\bjoin\b/.test(a)) score += 6;
    if (/\border by\b/.test(a)) score += 6;
    if (/\bhaving\b/.test(a)) score += 6;
  }

  // Code signals
  if (question.type === "code") {
    if (/def |function |const |class /.test(a)) score += 10;
    if (/return /.test(a)) score += 8;
    if (/for |while |if /.test(a)) score += 5;
  }

  // General quality signals
  const scoringKeywords = question.scoringGuide.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  const matches = scoringKeywords.filter(kw => a.includes(kw)).length;
  score += Math.min(matches * 4, 20);

  return Math.min(score, 90); // cap pre-score, LLM adds final calibration
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM EVALUATION PROMPT, pass this to your /api/interview or /api/technical endpoint
// ─────────────────────────────────────────────────────────────────────────────

export function buildTechnicalEvalPrompt(
  question: TechnicalQuestion,
  candidateAnswer: string,
  targetRole: string,
): string {
  return `You are a senior technical evaluator assessing a ${targetRole} candidate's answer.

QUESTION (${question.skill}, ${question.difficulty}):
${question.question}
${question.context ? `\nCONTEXT:\n${question.context}` : ""}

CANDIDATE'S ANSWER:
${candidateAnswer}

SCORING GUIDE (what a strong answer includes):
${question.scoringGuide}

Evaluate the answer. Respond ONLY as valid JSON with this exact structure:
{
  "score": <integer 0-100>,
  "passed": <true if score >= 60>,
  "feedback": "<2-3 sentences of specific, honest feedback>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "gaps": ["<specific gap 1>", "<specific gap 2>"]
}

Scoring guide:
- 90-100: Exceptional, covers all required elements plus nuance
- 75-89: Strong, covers most required elements clearly
- 60-74: Adequate, covers core elements but misses depth
- 40-59: Weak, partial understanding, significant gaps
- 0-39: Insufficient, wrong, missing, or too vague to evaluate

Be specific. Do not give generic feedback. Reference the actual answer content.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL ASSESSMENT AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────────

export function aggregateTechnicalResults(
  assessment: TechnicalAssessment,
  answerResults: TechnicalAnswerResult[],
): TechnicalAssessmentResult {
  if (!answerResults.length) {
    return {
      roleCluster: assessment.roleCluster,
      targetRole: assessment.targetRole,
      technicalScore: 0,
      passed: false,
      grade: "F",
      bySkill: [],
      strongestSkill: "-",
      weakestSkill: "-",
      recommendation: "No answers submitted.",
      readyForRole: false,
    };
  }

  const avg = answerResults.reduce((sum, r) => sum + r.score, 0) / answerResults.length;
  const technicalScore = Math.round(avg);
  const passed = technicalScore >= 65;

  const sorted = [...answerResults].sort((a, b) => b.score - a.score);
  const strongestSkill = sorted[0]?.skill || "-";
  const weakestSkill = sorted[sorted.length - 1]?.skill || "-";

  const grade: TechnicalAssessmentResult["grade"] =
    technicalScore >= 90 ? "A" :
    technicalScore >= 75 ? "B" :
    technicalScore >= 60 ? "C" :
    technicalScore >= 45 ? "D" : "F";

  const recommendation =
    technicalScore >= 85
      ? `Strong technical foundation for ${assessment.targetRole}. Ready for technical rounds.`
      : technicalScore >= 70
        ? `Solid technical base with some gaps. Focus on: ${weakestSkill}.`
        : technicalScore >= 55
          ? `Technical gaps present. Prioritise: ${answerResults.filter(r => !r.passed).map(r => r.skill).join(", ")}.`
          : `Significant technical gaps for ${assessment.targetRole}. Structured practice needed before applying.`;

  return {
    roleCluster: assessment.roleCluster,
    targetRole: assessment.targetRole,
    technicalScore,
    passed,
    grade,
    bySkill: answerResults,
    strongestSkill,
    weakestSkill,
    recommendation,
    readyForRole: technicalScore >= 70,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZER, injects technical context into interview prompt
// ─────────────────────────────────────────────────────────────────────────────

export function serializeTechnicalResultForInterview(
  result: TechnicalAssessmentResult,
): string {
  if (!result.bySkill.length) return "";
  const lines = [
    `TECHNICAL ASSESSMENT RESULTS (${result.targetRole}):`,
    `  Technical Score: ${result.technicalScore}/100 (${result.grade}), ${result.passed ? "PASSED" : "FAILED"}`,
    `  Strongest: ${result.strongestSkill} | Weakest: ${result.weakestSkill}`,
    `  Skill breakdown:`,
    ...result.bySkill.map(
      (r) => `    [${r.skill}] ${r.score}/100, ${r.gaps[0] || "No major gaps"}`,
    ),
    `  Recruiter note: Do NOT re-test skills already verified in technical assessment.`,
    `  Gap focus: Probe ${result.bySkill.filter(r => !r.passed).map(r => r.skill).join(", ") || "nothing, all passed"} in the interview.`,
  ];
  return lines.join("\n");
}
