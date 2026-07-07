/**
 * lib/interview/companyTemplates.ts
 *
 * Built-in company interview templates for Shadow Recruiter
 * Calibration. Each template bundles a recruiter persona flavor, an
 * interview flow, sample questions, and default rubric weights that
 * seed an organization scoring profile.
 *
 * These describe interview STYLES commonly associated with these
 * companies, based on publicly known interview formats. They are
 * WorkZo practice templates, not official company assessments, and
 * marketing copy must never claim endorsement (underpromise rule).
 *
 * All defaultWeights sum to exactly 100.
 */

import type { RubricWeights } from "@/lib/scoring/customRubric";

export type CompanyInterviewTemplate = {
  id: string;
  companyName: string;
  roleFamilies: string[];
  recruiterPersona: {
    tone: string;
    style: string;
    pressureLevel: "low" | "medium" | "high";
  };
  interviewFlow: {
    stage: string;
    focus: string[];
    sampleQuestions: string[];
  }[];
  defaultWeights: RubricWeights;
  promptInstructions: string;
};

export const COMPANY_INTERVIEW_TEMPLATES: CompanyInterviewTemplate[] = [
  {
    id: "sap-consulting",
    companyName: "SAP",
    roleFamilies: ["Consultant", "Customer Success", "Project Manager", "Data Analyst"],
    recruiterPersona: {
      tone: "structured, professional, business-focused",
      style: "calm but detail-oriented",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["motivation", "role understanding"],
        sampleQuestions: [
          "Tell me about yourself and how your experience connects to this role.",
          "Why are you interested in SAP or enterprise software?",
        ],
      },
      {
        stage: "Role Fit",
        focus: ["customer handling", "business process understanding"],
        sampleQuestions: [
          "Tell me about a time you handled a difficult stakeholder.",
          "How would you explain a technical solution to a non-technical customer?",
        ],
      },
      {
        stage: "Scenario",
        focus: ["problem solving", "communication"],
        sampleQuestions: [
          "A customer says the implementation is delayed and leadership is frustrated. How would you respond?",
        ],
      },
    ],
    defaultWeights: {
      communication: 25,
      businessReasoning: 25,
      jobFit: 20,
      technicalDepth: 15,
      confidence: 10,
      starStructure: 5,
    },
    promptInstructions:
      "Use a structured enterprise-software interview style. Ask scenario-based questions involving customers, stakeholders, implementation risk, and communication.",
  },
  {
    id: "bosch-engineering",
    companyName: "Bosch",
    roleFamilies: ["Engineer", "Quality Manager", "Embedded Developer", "Supply Chain Analyst"],
    recruiterPersona: {
      tone: "precise, methodical, quality-driven",
      style: "systematic questioning with attention to process detail",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["technical background", "motivation for industrial engineering"],
        sampleQuestions: [
          "Walk me through your technical background and what draws you to manufacturing or industrial technology.",
          "Which project are you most proud of and why?",
        ],
      },
      {
        stage: "Process Depth",
        focus: ["quality mindset", "systematic problem solving"],
        sampleQuestions: [
          "Describe a time a process failed. How did you find the root cause?",
          "How do you make sure your work meets quality standards under deadline pressure?",
        ],
      },
      {
        stage: "Scenario",
        focus: ["cross-functional work", "safety and reliability"],
        sampleQuestions: [
          "A supplier component fails validation two weeks before production start. Walk me through your next steps.",
        ],
      },
    ],
    defaultWeights: {
      technicalDepth: 30,
      businessReasoning: 15,
      communication: 15,
      jobFit: 15,
      evidenceQuality: 15,
      starStructure: 10,
    },
    promptInstructions:
      "Interview like a methodical German engineering company. Probe for root-cause thinking, quality processes, and concrete technical evidence. Reward structured, precise answers.",
  },
  {
    id: "bmw-mobility",
    companyName: "BMW",
    roleFamilies: ["Engineer", "Product Manager", "IT Specialist", "Data Scientist"],
    recruiterPersona: {
      tone: "professional, innovation-oriented, brand-conscious",
      style: "balanced mix of technical and cultural questions",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["motivation", "connection to mobility and automotive"],
        sampleQuestions: [
          "Why BMW, and why this role rather than another automotive company?",
          "Tell me about yourself with a focus on what you would bring to a premium mobility brand.",
        ],
      },
      {
        stage: "Innovation and Delivery",
        focus: ["project delivery", "innovation under constraints"],
        sampleQuestions: [
          "Tell me about a time you improved a product or process. What was the measurable result?",
          "How do you balance innovation with strict quality and safety requirements?",
        ],
      },
      {
        stage: "Scenario",
        focus: ["teamwork", "conflicting priorities"],
        sampleQuestions: [
          "Two departments give you conflicting requirements for the same deadline. How do you resolve it?",
        ],
      },
    ],
    defaultWeights: {
      technicalDepth: 25,
      communication: 20,
      jobFit: 20,
      businessReasoning: 15,
      cultureFit: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview for a premium automotive brand. Mix technical depth with brand and culture fit. Ask for measurable delivery results and probe how the candidate handles conflicting priorities.",
  },
  {
    id: "siemens-industrial",
    companyName: "Siemens",
    roleFamilies: ["Engineer", "Project Manager", "Automation Specialist", "Business Analyst"],
    recruiterPersona: {
      tone: "formal, thorough, internationally minded",
      style: "structured competency interview with project focus",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["career trajectory", "motivation"],
        sampleQuestions: [
          "Take me through your CV and highlight the projects most relevant to this role.",
          "What interests you about industrial technology and digitalization?",
        ],
      },
      {
        stage: "Project Competency",
        focus: ["project management", "technical implementation"],
        sampleQuestions: [
          "Describe a project where scope changed midway. How did you handle it?",
          "How do you coordinate work across international teams and time zones?",
        ],
      },
      {
        stage: "Scenario",
        focus: ["risk management", "stakeholder communication"],
        sampleQuestions: [
          "A key project milestone is at risk and the customer wants a status call tomorrow. What do you prepare?",
        ],
      },
    ],
    defaultWeights: {
      technicalDepth: 25,
      businessReasoning: 20,
      communication: 20,
      starStructure: 15,
      jobFit: 15,
      confidence: 5,
    },
    promptInstructions:
      "Run a formal, structured competency interview. Focus on project delivery, international collaboration, and risk management. Expect STAR-structured answers and probe when structure is missing.",
  },
  {
    id: "amazon-leadership",
    companyName: "Amazon",
    roleFamilies: ["Software Engineer", "Program Manager", "Operations Manager", "Product Manager"],
    recruiterPersona: {
      tone: "direct, data-driven, high-bar",
      style: "behavioral deep dives anchored on leadership principles",
      pressureLevel: "high",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["ownership", "customer obsession"],
        sampleQuestions: [
          "Tell me about a time you took ownership of a problem outside your job description.",
          "Describe a decision you made based primarily on customer impact.",
        ],
      },
      {
        stage: "Behavioral Deep Dive",
        focus: ["dive deep", "deliver results", "data"],
        sampleQuestions: [
          "Tell me about your most significant professional achievement. What exactly was your contribution, in numbers?",
          "Describe a time you disagreed with your manager. What did you do?",
        ],
      },
      {
        stage: "Scenario",
        focus: ["bias for action", "trade-offs"],
        sampleQuestions: [
          "You can ship on time with a known minor defect or delay two weeks. Walk me through your decision.",
        ],
      },
    ],
    defaultWeights: {
      starStructure: 25,
      evidenceQuality: 20,
      businessReasoning: 20,
      technicalDepth: 15,
      communication: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview in a direct, data-hungry behavioral style. Every claim needs numbers and specifics. Ask repeated follow-ups that dive deeper into the candidate's exact personal contribution. Push back on vague answers.",
  },
  {
    id: "google-technical",
    companyName: "Google",
    roleFamilies: ["Software Engineer", "Data Scientist", "Product Manager", "UX Researcher"],
    recruiterPersona: {
      tone: "curious, analytical, collaborative",
      style: "open-ended problem exploration with hypothesis testing",
      pressureLevel: "high",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["problem-solving mindset", "learning ability"],
        sampleQuestions: [
          "Tell me about the hardest technical or analytical problem you have solved.",
          "How do you approach a problem you have never seen before?",
        ],
      },
      {
        stage: "Problem Exploration",
        focus: ["structured reasoning", "trade-off analysis"],
        sampleQuestions: [
          "Walk me through how you would design or improve a system you use every day.",
          "Describe a time your first solution was wrong. How did you find out and what did you change?",
        ],
      },
      {
        stage: "Collaboration",
        focus: ["googleyness", "working with ambiguity"],
        sampleQuestions: [
          "Tell me about a time you had to move forward with incomplete information.",
        ],
      },
    ],
    defaultWeights: {
      technicalDepth: 30,
      businessReasoning: 20,
      communication: 20,
      jobFit: 10,
      cultureFit: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview with intellectual curiosity. Present open-ended problems and evaluate how the candidate structures ambiguity, states assumptions, and reasons about trade-offs out loud. Reward clear thinking over polished delivery.",
  },
  {
    id: "microsoft-growth",
    companyName: "Microsoft",
    roleFamilies: ["Software Engineer", "Cloud Solution Architect", "Customer Success", "Program Manager"],
    recruiterPersona: {
      tone: "supportive, growth-minded, structured",
      style: "behavioral interview focused on learning and collaboration",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["growth mindset", "motivation"],
        sampleQuestions: [
          "Tell me about something significant you learned in the last year and how you applied it.",
          "Why Microsoft, and what would success in this role look like to you?",
        ],
      },
      {
        stage: "Collaboration Deep Dive",
        focus: ["inclusive teamwork", "customer focus"],
        sampleQuestions: [
          "Describe a time you helped a teammate succeed at some cost to your own work.",
          "Tell me about a time you turned an unhappy customer or stakeholder around.",
        ],
      },
      {
        stage: "Scenario",
        focus: ["technical judgment", "handling failure"],
        sampleQuestions: [
          "Tell me about a project that failed. What did you learn and what do you do differently now?",
        ],
      },
    ],
    defaultWeights: {
      communication: 25,
      technicalDepth: 20,
      cultureFit: 15,
      businessReasoning: 15,
      starStructure: 15,
      confidence: 10,
    },
    promptInstructions:
      "Interview with a growth-mindset lens. Ask about learning, failure, and collaboration. Follow up on how the candidate helped others succeed and how they respond to setbacks.",
  },
  {
    id: "accenture-consulting",
    companyName: "Accenture",
    roleFamilies: ["Consultant", "Technology Analyst", "Business Analyst", "Project Manager"],
    recruiterPersona: {
      tone: "energetic, client-focused, fast-paced",
      style: "case-flavored behavioral questions with client scenarios",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["client orientation", "adaptability"],
        sampleQuestions: [
          "Tell me about yourself and why consulting rather than an industry role.",
          "Describe a time you had to learn a new domain quickly to deliver.",
        ],
      },
      {
        stage: "Client Scenario",
        focus: ["structured communication", "stakeholder management"],
        sampleQuestions: [
          "A client asks you a question you cannot answer in a workshop. What do you do in the moment?",
          "How would you structure the first two weeks of a new client engagement?",
        ],
      },
      {
        stage: "Delivery",
        focus: ["teamwork under pressure", "results"],
        sampleQuestions: [
          "Tell me about a deliverable that was at risk. How did you get it back on track?",
        ],
      },
    ],
    defaultWeights: {
      communication: 30,
      businessReasoning: 25,
      cultureFit: 10,
      starStructure: 15,
      jobFit: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview like a technology consultancy. Emphasize client-facing communication, fast learning, and structured delivery. Use realistic client scenarios and evaluate composure and clarity.",
  },
  {
    id: "deloitte-advisory",
    companyName: "Deloitte",
    roleFamilies: ["Consultant", "Auditor", "Risk Analyst", "Technology Consultant"],
    recruiterPersona: {
      tone: "polished, analytical, professional-services formal",
      style: "competency questions with a commercial reasoning thread",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["professional motivation", "firm fit"],
        sampleQuestions: [
          "Why professional services, and why Deloitte specifically?",
          "Which of our service lines interests you most and why?",
        ],
      },
      {
        stage: "Competency",
        focus: ["analytical rigor", "integrity"],
        sampleQuestions: [
          "Describe a time you spotted an error or inconsistency others had missed.",
          "Tell me about a situation where you had to deliver an unpopular finding.",
        ],
      },
      {
        stage: "Commercial Scenario",
        focus: ["business judgment", "client value"],
        sampleQuestions: [
          "A client wants to cut a control step to save money. How do you assess and communicate the risk?",
        ],
      },
    ],
    defaultWeights: {
      businessReasoning: 30,
      communication: 25,
      starStructure: 15,
      evidenceQuality: 10,
      jobFit: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview in a polished professional-services style. Probe analytical rigor, integrity under pressure, and commercial awareness. Expect precise, well-structured answers with clear reasoning.",
  },
  {
    id: "ey-professional",
    companyName: "EY",
    roleFamilies: ["Auditor", "Tax Consultant", "Transaction Advisor", "Technology Risk Analyst"],
    recruiterPersona: {
      tone: "warm but rigorous, values-led",
      style: "strengths-based questions mixed with competency checks",
      pressureLevel: "low",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["strengths", "motivation"],
        sampleQuestions: [
          "What kind of work energizes you, and how does that connect to this role?",
          "Tell me about an achievement you are genuinely proud of.",
        ],
      },
      {
        stage: "Strengths in Action",
        focus: ["teamwork", "attention to detail"],
        sampleQuestions: [
          "Describe a time your attention to detail prevented a problem.",
          "Tell me about working in a team where standards slipped. What did you do?",
        ],
      },
      {
        stage: "Values Scenario",
        focus: ["ethics", "client trust"],
        sampleQuestions: [
          "You notice a small discrepancy a senior colleague says to ignore. Walk me through your thinking.",
        ],
      },
    ],
    defaultWeights: {
      communication: 25,
      businessReasoning: 20,
      evidenceQuality: 15,
      cultureFit: 15,
      starStructure: 15,
      confidence: 10,
    },
    promptInstructions:
      "Use a strengths-based interview style that stays rigorous. Ask what energizes the candidate, then verify with concrete competency examples. Include one ethics-flavored scenario and evaluate judgment.",
  },
  {
    id: "pwc-assurance",
    companyName: "PwC",
    roleFamilies: ["Auditor", "Consultant", "Deals Analyst", "Cybersecurity Consultant"],
    recruiterPersona: {
      tone: "measured, evidence-seeking, client-aware",
      style: "structured competency interview with follow-up probing",
      pressureLevel: "medium",
    },
    interviewFlow: [
      {
        stage: "Introduction",
        focus: ["motivation", "commercial awareness"],
        sampleQuestions: [
          "Why PwC, and what do you know about the challenges our clients face right now?",
          "Take me through your CV in two minutes, focusing on relevance to this role.",
        ],
      },
      {
        stage: "Competency",
        focus: ["whole leadership", "technical capability"],
        sampleQuestions: [
          "Tell me about a time you took the lead without formal authority.",
          "Describe the most complex analysis you have done. How did you validate it?",
        ],
      },
      {
        stage: "Client Scenario",
        focus: ["relationships", "acumen"],
        sampleQuestions: [
          "A client contact stops responding one week before a deadline that needs their input. What do you do?",
        ],
      },
    ],
    defaultWeights: {
      businessReasoning: 25,
      communication: 25,
      evidenceQuality: 15,
      starStructure: 15,
      leadership: 10,
      confidence: 10,
    },
    promptInstructions:
      "Interview against a professional-services competency framework. Ask for evidence behind every claim, probe leadership without authority, and test commercial awareness with a client scenario.",
  },
];

export function getCompanyTemplate(id: string): CompanyInterviewTemplate | null {
  const key = String(id || "").trim().toLowerCase();
  return COMPANY_INTERVIEW_TEMPLATES.find((t) => t.id === key || t.companyName.toLowerCase() === key) || null;
}

export function listCompanyTemplateSummaries() {
  return COMPANY_INTERVIEW_TEMPLATES.map((t) => ({
    id: t.id,
    companyName: t.companyName,
    roleFamilies: t.roleFamilies,
    pressureLevel: t.recruiterPersona.pressureLevel,
    defaultWeights: t.defaultWeights,
  }));
}
