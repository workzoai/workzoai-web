/**
 * lib/followupEngine.ts
 *
 * WHAT CHANGED vs original:
 * The original was a 29-line stub with 5 hardcoded strings, unconnected to the
 * main intelligence. This version is a real, contextual follow-up decision tree
 * that the unified engine and any direct caller can use.
 *
 * It takes a richer signal object and returns:
 * - A specific follow-up question string
 * - A follow-up style label (for UI/pressure display)
 * - Whether to stay on the current question or advance
 */

export type FollowUpSignals = {
  // Quality signals from the answer
  missingMetrics: boolean;
  missingOwnership: boolean;
  vague: boolean;
  contradiction: string | null;      // description of contradiction, or null
  unsupportedClaim: string | null;   // description of unsupported claim, or null
  rambling: boolean;                 // answer > ~120 words without a result
  hasQualitativeOutcome: boolean;
  hasQuantitativeOutcome: boolean;
  // Context signals
  recruiterType: string;             // "sarah" | "james" | "priya" | "daniel"
  conversationStage: string;         // "background" | "role_fit" | "behavioral" | "skill_gap" | "strengths" | "weakness" | "closing"
  candidateTurnCount: number;
  targetRole: string;
  lastRecruiterLineContains?: string; // to avoid exact repeats
};

export type FollowUpDecision = {
  question: string;
  style: "supportive" | "analytical" | "skeptical" | "pressure" | "deepening";
  stayOnQuestion: boolean;           // true = don't advance yet; false = accept and advance
};

export function generateFollowup(signals: FollowUpSignals): FollowUpDecision {
  const {
    contradiction,
    unsupportedClaim,
    missingMetrics,
    missingOwnership,
    vague,
    rambling,
    hasQualitativeOutcome,
    hasQuantitativeOutcome,
    recruiterType,
    conversationStage,
    candidateTurnCount,
    targetRole,
    lastRecruiterLineContains = "",
  } = signals;

  const isEarly = candidateTurnCount <= 2;
  const isDaniel = recruiterType === "daniel" || recruiterType === "analytical_hiring_manager";
  const isSarah = recruiterType === "sarah" || recruiterType === "friendly_hr";
  const isPriya = recruiterType === "priya" || recruiterType === "startup_recruiter";

  // ── Credibility issues — always stay and challenge ────────────────────────
  if (contradiction) {
    return {
      question: `Hold on — earlier ${contradiction.toLowerCase().startsWith("the") ? "" : "you mentioned "}${contradiction}. Help me understand that — are both things true at the same time?`,
      style: "skeptical",
      stayOnQuestion: true,
    };
  }

  if (unsupportedClaim) {
    return {
      question: `That sounds significant. ${unsupportedClaim}. What was your actual scope — who else was involved, and what did you personally own?`,
      style: "skeptical",
      stayOnQuestion: true,
    };
  }

  // ── Rambling without a result — interrupt and narrow ─────────────────────
  if (rambling && !hasQualitativeOutcome && !hasQuantitativeOutcome) {
    return {
      question: "Let me pause you there — what was the actual outcome of all that? Give me the result in one or two sentences.",
      style: "pressure",
      stayOnQuestion: true,
    };
  }

  // ── Missing ownership (team-speak without "I") ───────────────────────────
  if (missingOwnership && !isEarly) {
    return {
      question: "I hear the team's work, but what did YOU specifically do? What would not have happened if you had not been there?",
      style: "analytical",
      stayOnQuestion: true,
    };
  }

  // ── Missing measurable impact (after a substantive answer) ───────────────
  if (missingMetrics && !hasQualitativeOutcome && !isEarly && conversationStage === "behavioral") {
    // Only demand metrics once. If the last line already asked for impact,
    // accept qualitative and advance instead of repeating.
    const alreadyAskedForImpact = /result|impact|what changed|outcome|measurable/i.test(lastRecruiterLineContains);
    if (alreadyAskedForImpact) {
      return {
        question: isDaniel
          ? `Okay, I'll accept that as a qualitative result. Now: what was the hardest decision you made during that situation?`
          : `Fair enough — I'll take that as a directional outcome. ${buildDepthQuestion(targetRole, conversationStage, recruiterType)}`,
        style: "deepening",
        stayOnQuestion: false,
      };
    }
    return {
      question: "What was the measurable outcome? Even a rough number — time saved, customer satisfaction, fewer escalations — helps me understand the real impact.",
      style: "analytical",
      stayOnQuestion: true,
    };
  }

  // ── Vague language without specifics ─────────────────────────────────────
  if (vague && !hasQualitativeOutcome) {
    return {
      question: "Give me one specific example — a real situation, not a general description of what you usually do.",
      style: "analytical",
      stayOnQuestion: true,
    };
  }

  // ── Good answer — advance with a deepening follow-up ─────────────────────
  const depthQuestion = buildDepthQuestion(targetRole, conversationStage, recruiterType);
  return {
    question: depthQuestion,
    style: hasQuantitativeOutcome ? "deepening" : "analytical",
    stayOnQuestion: false,
  };
}

function buildDepthQuestion(
  targetRole: string,
  stage: string,
  recruiterType: string,
): string {
  const role = targetRole.toLowerCase();
  const isDaniel = recruiterType === "daniel" || recruiterType === "analytical_hiring_manager";
  const isPriya = recruiterType === "priya" || recruiterType === "startup_recruiter";

  if (stage === "strengths") {
    return "What would you say is your biggest development area right now — and how are you actively working on it?";
  }

  if (stage === "weakness") {
    return isDaniel
      ? "Thanks for being direct. How would you make sure that development area doesn't create a risk in this role specifically?"
      : "How are you actively improving that, and how would it affect your work here?";
  }

  if (stage === "behavioral") {
    if (/customer success|account manager|client success/.test(role)) {
      return "After that situation was resolved, how would you follow up to make sure the customer stays successful long term — not just temporarily satisfied?";
    }
    if (/data analyst|business analyst/.test(role)) {
      return "What decision changed because of that analysis, and how did you know it was the right call?";
    }
    if (/sales|business development/.test(role)) {
      return isPriya
        ? "What would you do differently if you ran that deal again from scratch?"
        : "Walk me through one prospect conversation from initial contact to close — what moved them forward?";
    }
    return isDaniel
      ? "What was the hardest trade-off you had to make in that situation?"
      : "What would you improve if you handled the same situation today?";
  }

  if (stage === "skill_gap") {
    return `I see the gap. How would you close it quickly in the first 90 days if you joined as ${targetRole}?`;
  }

  // Generic fallback — used when stage is unclear
  return "Give me one concrete example where you took ownership and something measurable improved because of it.";
}
