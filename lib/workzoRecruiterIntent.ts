import type { RecruiterState } from "@/lib/workzoRecruiterPsychologyEngine";

export type RecruiterIntentInsight = {
  headline: string;
  recruiterFocus: string;
  pressureStyle: string;
  hiddenEvaluation: string;
  coachingHint: string;
};

export function getRecruiterIntentInsight({
  recruiterId,
  recruiterState,
  question,
  trust,
}: {
  recruiterId: string;
  recruiterState: RecruiterState;
  question: string;
  trust: number;
}): RecruiterIntentInsight {
  const lower = question.toLowerCase();

  if (recruiterId === "startup_recruiter") {
    return {
      headline: "Priya is testing execution speed.",
      recruiterFocus:
        lower.includes("project") || lower.includes("example")
          ? "She wants ownership, momentum, and practical decision-making."
          : "She wants concise answers with fast business impact.",
      pressureStyle:
        recruiterState === "pressuring"
          ? "Priya is intentionally accelerating pressure to test confidence."
          : "Priya prefers fast-paced conversational flow.",
      hiddenEvaluation:
        "She is checking whether you sound proactive or dependent on team direction.",
      coachingHint:
        "Lead with action + measurable outcome quickly. Avoid long setup explanations.",
    };
  }

  if (recruiterId === "corporate_recruiter") {
    return {
      headline: "Markus is testing structure and precision.",
      recruiterFocus:
        lower.includes("challenge") || lower.includes("problem")
          ? "He wants structured reasoning and measurable accountability."
          : "He expects clarity, order, and evidence.",
      pressureStyle:
        recruiterState === "skeptical"
          ? "Markus is becoming skeptical because details feel imprecise."
          : "Markus prefers formal, structured communication.",
      hiddenEvaluation:
        "He is checking whether your answers feel reliable and professionally grounded.",
      coachingHint:
        "Keep answers precise: situation, responsibility, measurable result.",
    };
  }

  if (recruiterId === "analytical_hiring_manager") {
    return {
      headline: "Daniel is testing analytical depth.",
      recruiterFocus:
        lower.includes("data") || lower.includes("decision")
          ? "He wants evidence-based thinking and tradeoff awareness."
          : "He is checking how deeply you understand your own decisions.",
      pressureStyle:
        recruiterState === "pressuring"
          ? "Daniel is probing for logical weaknesses."
          : "Daniel prefers thoughtful technical clarity.",
      hiddenEvaluation:
        "He is evaluating whether your explanations hold up under deeper questioning.",
      coachingHint:
        "Explain reasoning clearly and support statements with evidence.",
    };
  }

  return {
    headline: "Sarah is testing communication quality.",
    recruiterFocus:
      lower.includes("team") || lower.includes("stakeholder")
        ? "She is evaluating collaboration and emotional communication."
        : "She wants clarity, confidence, and professionalism.",
    pressureStyle:
      recruiterState === "losing_confidence"
        ? "Sarah is losing confidence because the answer feels unclear."
        : "Sarah keeps the conversation warm but observant.",
    hiddenEvaluation:
      "She is evaluating whether you communicate like someone clients and teams would trust.",
    coachingHint:
      "Stay clear, calm, and specific. Avoid sounding defensive.",
  };
}

export function getRecruiterSpecificFollowUp({
  recruiterId,
  question,
  answer,
}: {
  recruiterId: string;
  question: string;
  answer: string;
}) {
  const lowerAnswer = answer.toLowerCase();
  const hasMetric =
    /\d|%|percent|reduced|increased|saved|improved|tickets|users|customers|hours|days/i.test(
      answer,
    );

  const hasOwnership =
    /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bowned\b|\bhandled\b|\bresolved\b|\bimplemented\b/i.test(
      lowerAnswer,
    );

  if (recruiterId === "startup_recruiter") {
    if (!hasOwnership) return "What did you personally drive, not just support?";
    if (!hasMetric) return "What changed quickly because of your work?";
    return "What would you do differently if you had to move twice as fast?";
  }

  if (recruiterId === "corporate_recruiter") {
    if (!hasMetric) return "What exact measurable result can you verify?";
    if (!hasOwnership) return "What was your precise responsibility in that situation?";
    return "Can you explain the situation, action, and result in a more structured way?";
  }

  if (recruiterId === "analytical_hiring_manager") {
    if (!hasMetric) return "What evidence supports that conclusion?";
    if (!hasOwnership) return "Which decision did you personally make?";
    return "What tradeoff did you consider before choosing that approach?";
  }

  if (!hasOwnership) return "What was your personal contribution?";
  if (!hasMetric) return "What result or impact came from that work?";
  return "How did you communicate the outcome to your team or stakeholder?";
}