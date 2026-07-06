// Pure, dependency-free role-knowledge selector, used by BOTH the server-only
// text engine (unifiedRecruiterIntelligence.ts, which imports the OpenAI SDK
// and is server-only) and the client-side Vapi voice prompt builder
// (workzoVapiVoice.ts, bundled into the browser via the "use client"
// interview page). This file must NEVER import anything server-only -
// doing that once already broke live Vapi voice entirely, because importing
// unifiedRecruiterIntelligence.ts directly from workzoVapiVoice.ts pulled the
// OpenAI SDK and process.env.OPENAI_API_KEY usage into the client bundle.

export function selectRoleKnowledgeBlock(targetRole: string, jobDescription: string): string {
  const probe = `${targetRole} ${jobDescription}`.toLowerCase();
  const blocks: Array<{ match: RegExp; text: string }> = [
    {
      match: /customer success|\bcsm\b|account manager|key account/,
      text: `Customer Success Manager (CSM) / Account Manager:
- Core job: proactive relationship ownership. Unlike support, CSM calls the customer BEFORE they call you.
- Key areas: onboarding new customers, driving product adoption, managing renewal risk, conducting QBRs (quarterly business reviews), preventing churn, account expansion, escalation handling, customer health scores, building executive trust.
- When a support-background candidate says "I handled customers": probe the difference. "In support you react to problems. In CSM you own the relationship before a problem appears. Have you ever proactively reached out to a customer before they complained?"
- If they mention CSAT/satisfaction: go deeper. "How would you turn a one-time satisfied support customer into a renewed, expanded account?"
- Red flag: candidates who describe reactive support and call it customer success.`,
    },
    {
      match: /software engineer|\bdeveloper\b|backend|front[\s-]?end|full[\s-]?stack|web developer|mobile (developer|engineer)/,
      text: `Software Engineer / Developer:
- Not just coding. System design, architectural tradeoffs, production reliability, testing strategy.
- "I built X" always needs: what problem it solved, what tradeoffs were made, how it scales, what broke in production, what they'd do differently.
- Senior roles: architectural decisions, team unblocking, technical leadership without direct management authority.
- Probe: time complexity, edge cases, deployment approach, monitoring, what failed and how they diagnosed it.`,
    },
    {
      match: /data analyst|data scientist|data engineer|machine learning|\bml\b/,
      text: `Data Analyst / Data Scientist:
- Not tools, outcomes. The question is always: what decision did the data actually change? Who acted on it?
- "I used Python/SQL/Tableau": probe the business question, the finding, the person who acted on it, the outcome.
- Key signal: hypothesis-first thinking, communicating ambiguous findings to non-technical stakeholders.
- Red flag: knows tools but can't describe business impact of any single analysis.`,
    },
    {
      match: /it support|helpdesk|help desk|it specialist|system integration|system administrator|sysadmin|network engineer/,
      text: `IT Support / IT Specialist / Helpdesk:
- Probe troubleshooting methodology: how do they diagnose before escalating? Most complex issue personally resolved end-to-end?
- How they communicate a technical fix to a non-technical user frustrated by downtime.
- For System Integration: networking, Active Directory, Windows Server, scripting, infrastructure ownership depth.
- Transferable to other roles: SLA discipline, escalation judgment, customer empathy under pressure.`,
    },
    {
      match: /product manager|\bpm\b(?!.{0,15}(office|administrator))/,
      text: `Product Manager:
- Owns roadmap, not code. Cross-functional leadership without authority.
- Probe: how they said no to a stakeholder, a feature they killed and why, a time they had to prioritize between competing customer needs, a feature they shipped and its measurable outcome.
- Red flag: describes features built instead of customer problems solved.`,
    },
    {
      match: /administrative|office coordinator|admin assistant|executive assistant|office manager/,
      text: `Administrative / Office Coordinator:
- Probe: competing priorities from multiple executives simultaneously, anticipating a problem before it became urgent, managing confidential information at scale, system for staying on top of high-volume coordination.`,
    },
    {
      match: /marketing|\bsales\b|business development|account executive/,
      text: `Marketing / Sales:
- Marketing: campaign ROI, channel attribution, what they optimized and why, A/B testing decisions.
- Sales: pipeline management, how they handle objections, largest deal closed, what they do when a deal goes quiet.`,
    },
    {
      match: /project manager|program manager|implementation/,
      text: `Project / Program / Implementation Manager:
- Owns delivery against a timeline through people who don't report to them. The real test is how they move things when someone else is blocking progress.
- Probe: a project that slipped and why, how they escalated a stuck stakeholder or partner, how they kept multiple workstreams visible, a milestone they had to renegotiate and how they handled that conversation.
- Red flag: describes process and tools but can't name a specific moment they had to push, escalate, or say no.`,
    },
    {
      match: /cybersecurity|security analyst|\binfosec\b|soc analyst|penetration test|\bpentest\b/,
      text: `Cybersecurity / Security Analyst:
- The job is judgment under uncertainty, not tool knowledge. Probe a real incident or alert they personally investigated, how did they tell signal from noise?
- "We use [tool]" needs: what did you actually find with it, what did you do next, who did you have to convince.
- Probe how they balance security controls against business velocity, a time security said no, and what happened.
- Red flag: certifications and tool names with no real incident, finding, or judgment call attached.`,
    },
    {
      match: /cloud architect|solutions? architect|cloud engineer|infrastructure architect|platform architect/,
      text: `Cloud / Solutions Architect:
- Not about knowing AWS/Azure/GCP, about trade-offs: cost vs. reliability vs. speed of delivery, and who they had to convince.
- Probe a specific architecture decision: what alternatives did they reject and why, what broke after it shipped, what they'd design differently now.
- Probe how they explain a technical trade-off to a non-technical stakeholder who just wants it cheaper or faster.
- Red flag: certification/diagram talk with no real decision, real constraint, or real failure attached.`,
    },
    {
      match: /ui\/?ux|ux designer|ui designer|product designer|user experience designer/,
      text: `UI/UX / Product Designer:
- Probe a design decision driven by user research or data, not personal taste, what did they learn, and what did they change because of it.
- Probe a disagreement with a PM or engineer over a design call, how was it actually resolved.
- Probe a time user testing proved their first instinct wrong.
- Red flag: portfolio narration ("I designed this screen") with no decision rationale or evidence behind it.`,
    },
    {
      match: /physician|\bdoctor\b|registered nurse|\brn\b|pharmacist|physical therapist|clinical|patient care|nursing|paramedic|nurse practitioner/,
      text: `Clinical / Healthcare (Physician, Nurse, Pharmacist, Therapist):
- Probe a high-pressure patient situation and the actual clinical judgment made with incomplete information, not the textbook protocol.
- Probe how they communicated a difficult outcome or diagnosis to a patient or family, what did they actually say.
- Probe collaboration/conflict with another clinician or department under time pressure.
- Red flag: protocol-recitation with no real patient-specific decision or moment of uncertainty.`,
    },
    {
      match: /civil engineer|mechanical engineer|biomedical engineer|structural engineer|electrical engineer|chemical engineer/,
      text: `Engineering, Civil / Mechanical / Biomedical / Structural / Electrical:
- Probe a real design or safety trade-off they personally made, not coursework or theory.
- Probe a project that went over budget, behind schedule, or needed rework after real-world/field testing, what did they actually do.
- Probe regulatory or safety-standard awareness tied to a specific project, not in the abstract.
- Red flag: describes tools/software/theory fluently but can't name one real project decision with a consequence.`,
    },
    {
      match: /financial analyst|\baccountant\b|auditor|accounting|bookkeeping|\bcpa\b|controller/,
      text: `Financial Analyst / Accountant / Auditor:
- Probe a specific model, forecast, or analysis that actually changed a real business decision, who acted on it, what changed.
- Probe a discrepancy, error, or irregularity they personally caught, how, and what they did next.
- Probe pressure to present numbers more favorably than the data supports, how they handled it.
- Red flag: fluent on tools (Excel, SAP, ERP) but can't describe one real judgment call or finding with consequence.`,
    },
    {
      match: /human resources|\bhr\b|people operations|talent acquisition|recruiting manager|people partner/,
      text: `HR / People Operations / Talent Acquisition:
- Probe a difficult employee-relations situation handled personally, what they decided, not just company policy.
- Probe a hiring decision that went wrong and what changed because of it.
- Probe how they balanced employee wellbeing against business/legal constraints in a specific case.
- Red flag: policy-recitation with no real, specific judgment call or outcome attached.`,
    },
    {
      match: /\bceo\b|chief executive|\bcoo\b|\bcfo\b|\bcto\b|vice president|\bvp\b|director of|head of (engineering|sales|marketing|product|operations)/,
      text: `Executive / Senior Leadership:
- Probe one significant strategic decision and the real trade-off behind it, what they gave up to get it.
- Probe a major setback or public failure and how they handled it, not just the recovery narrative.
- Probe a hard people decision (restructuring, letting someone go, a leadership change) and how they made it.
- Red flag: vision/mission language with no concrete decision, trade-off, or consequence attached to it.`,
    },
    {
      match: /lawyer|attorney|paralegal|compliance officer|legal counsel|general counsel|legal assistant/,
      text: `Legal / Compliance (Lawyer, Paralegal, Compliance Officer):
- Probe a specific case or matter they personally handled, not legal knowledge in the abstract.
- Probe a judgment call made under regulatory ambiguity, what they decided when the rule wasn't clear.
- Probe how they explained legal/compliance risk to a non-legal stakeholder who wanted to move faster.
- Red flag: textbook legal knowledge with no real matter, decision, or consequence attached.`,
    },
    {
      match: /research scientist|laboratory|\br&d\b|biologist|chemist|physicist|environmental consultant|sustainability/,
      text: `Research Scientist / R&D / Environmental & Sustainability:
- Probe a hypothesis that turned out wrong and what they learned from it, not just successful results.
- Probe how they decided an experiment had genuinely failed versus needed another iteration.
- Probe communicating ambiguous or negative findings to a stakeholder, PI, or client who wanted a clean answer.
- Red flag: technique/equipment fluency with no real research judgment call or finding attached.`,
    },
  ];

  const matched = blocks.filter((block) => block.match.test(probe)).map((block) => block.text);
  if (matched.length) return matched.slice(0, 2).join("\n\n");

  return `This role doesn't map to one of the common archetypes above. Use the
job description and CV excerpts below directly: identify the 2-3 core
responsibilities actually stated in the job description, and hold the
candidate to the same standard a specialized interviewer would, concrete
personal action and outcome against each one, not generic competency talk.`;
}
