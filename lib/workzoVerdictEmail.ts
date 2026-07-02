// lib/workzoVerdictEmail.ts
//
// Turns the hiring committee decision into the actual email the candidate
// would have received after this performance — the polite rejection, the
// next-round invite, or the offer note.
//
// Deliberately deterministic: built entirely from the committee memo so it
// is always consistent with the rest of the report, renders instantly, and
// costs no extra LLM call. The emotional punch comes from the contrast the
// UI draws between the generic email (what companies actually send) and the
// real deciding factor (what the committee actually wrote down).

import type { WorkZoHiringCommitteeMemo } from "@/lib/workzoHiringCommitteeEngine";

export type WorkZoVerdictEmailKind = "offer" | "next_round" | "rejection";

export type WorkZoVerdictEmail = {
  kind: WorkZoVerdictEmailKind;
  subject: string;
  greeting: string;
  paragraphs: string[];
  signOff: string;
  senderName: string;
  senderTitle: string;
  // The line the committee actually wrote — the reason behind the email
  // that no company would ever put in writing to the candidate.
  decidingFactor: string;
  decidingFactorLabel: string;
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

function firstNameOf(fullName: string) {
  const name = clean(fullName);
  if (!name) return "";
  const first = name.split(" ")[0] || "";
  // Guard against placeholder values that sometimes survive setup ("there",
  // "candidate", single letters).
  if (first.length < 2) return "";
  if (/^(there|candidate|user|guest|anonymous)$/i.test(first)) return "";
  return first;
}

function companyPhrase(companyLabel: string) {
  const label = clean(companyLabel);
  if (!label || /^the company$/i.test(label) || /^your target company$/i.test(label)) {
    return "our team";
  }
  return label;
}

export function buildWorkZoVerdictEmail(input: {
  memo: WorkZoHiringCommitteeMemo;
  candidateName?: string;
  roleLabel: string;
  companyLabel: string;
  recruiterName: string;
}): WorkZoVerdictEmail {
  const memo = input.memo;
  const decision = clean(memo?.decision, "Leaning No Hire");
  const role = clean(input.roleLabel, "the role");
  const company = companyPhrase(input.companyLabel);
  const recruiter = clean(input.recruiterName, "Sarah");
  const firstName = firstNameOf(input.candidateName || "");
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const kind: WorkZoVerdictEmailKind =
    decision === "Strong Hire" || decision === "Hire"
      ? "offer"
      : decision === "Leaning Hire"
        ? "next_round"
        : "rejection";

  const topConcern = clean(memo?.evidenceAgainstHire?.[0], clean(memo?.hiringManagerConcern));
  const topStrength = clean(memo?.evidenceForHire?.[0], "Consistent, specific evidence across your strongest answers.");
  const nextFocus = clean(memo?.nextRoundFocus?.[0]);

  if (kind === "offer") {
    return {
      kind,
      subject: `Next steps — ${role} at ${company}`,
      greeting,
      paragraphs: [
        `Thank you for taking the time to speak with us about the ${role} position. I'm pleased to share that the interview panel was impressed, and we would like to move you forward to the offer stage.`,
        `Someone from our team will reach out shortly with details on compensation and start dates. In the meantime, please let me know if you have any questions.`,
        `Congratulations — we're excited about the possibility of you joining ${company}.`,
      ],
      signOff: "Best regards,",
      senderName: recruiter,
      senderTitle: "Talent Acquisition",
      decidingFactor: topStrength,
      decidingFactorLabel: "What actually earned this email",
    };
  }

  if (kind === "next_round") {
    return {
      kind,
      subject: `Interview update — ${role} at ${company}`,
      greeting,
      paragraphs: [
        `Thank you for speaking with us about the ${role} position. We enjoyed the conversation and would like to invite you to the next round of interviews.`,
        `You'll meet with additional members of the team, and we'll go deeper into your experience and how you approach the work.`,
        `We'll follow up with scheduling options shortly. Looking forward to continuing the conversation.`,
      ],
      signOff: "Best regards,",
      senderName: recruiter,
      senderTitle: "Talent Acquisition",
      decidingFactor: nextFocus || topConcern || "The panel saw potential but wants stronger, more specific proof before committing.",
      decidingFactorLabel: "What the next round will really be testing",
    };
  }

  return {
    kind,
    subject: `Your application — ${role} at ${company}`,
    greeting,
    paragraphs: [
      `Thank you for taking the time to interview for the ${role} position. We appreciate the effort you put into the process.`,
      `After careful consideration, we have decided to move forward with other candidates whose experience more closely matches what we're looking for at this time.`,
      `We'll keep your details on file and encourage you to apply for future openings. We wish you the best in your search.`,
    ],
    signOff: "Kind regards,",
    senderName: recruiter,
    senderTitle: "Talent Acquisition",
    decidingFactor: topConcern || "The panel couldn't find enough verifiable, specific evidence to commit to a hire.",
    decidingFactorLabel: "What actually decided it — the line they'd never send you",
  };
}
