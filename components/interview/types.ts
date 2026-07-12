"use client";

import type { CodeWorkspaceState } from "./CodePanel";

export type TranscriptRole = "recruiter" | "candidate" | "system";
export type InterviewStatus = "idle" | "recruiter-speaking" | "listening" | "thinking" | "ended";
export type PremiumVoiceStatus = "idle" | "not_configured" | "checking_microphone" | "connecting" | "connected" | "fallback" | "failed";
export type TranscriptItem = { id: string; time: string; role: TranscriptRole; speaker: string; text: string; };
export type InterviewSetupViewModel = { candidateName: string; targetRole: string; targetCompany?: string; recruiterId: string; recruiterName: string; recruiterTitle: string; recruiterImage: string; language: string; };
export type RecruiterSignalViewModel = { overall: number; confidence: number; clarity: number; relevance: number; communication: number; trust: number; interest: number; mood: "Impressed" | "Engaged" | "Neutral" | "Concerned" | "Doubtful"; concern: string; };

export type InterviewUiState = {
  status: InterviewStatus;
  premiumVoiceStatus: PremiumVoiceStatus;
  elapsedLabel: string;
  scoreReady: boolean;
  questionIndex: number;
  progress: number;
  transcriptCollapsed: boolean;
  copilotEnabled: boolean;
  isPremiumUnlocked?: boolean;
  // Technical mode, shows the code editor panel for premium users
  technicalMode?: boolean;
};

export type InterviewUiActions = {
  onBack: () => void;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSettings: () => void;
  onToggleMore: () => void;
  onToggleTranscript: () => void;
  onToggleCopilot: () => void;
  onClearTranscript: () => void;
  // Called by CodePanel whenever the candidate edits code.
  // noop when technical mode is off.
  onCodeChange: (state: CodeWorkspaceState) => void;
};

export type InterviewLayoutProps = {
  setup: InterviewSetupViewModel;
  signal: RecruiterSignalViewModel;
  transcript: TranscriptItem[];
  ui: InterviewUiState;
  actions: InterviewUiActions;
};
