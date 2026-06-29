import { ShieldCheck, Sparkles } from "lucide-react";

type PrivacyNoticeProps = {
  compact?: boolean;
  className?: string;
};

export default function PrivacyNotice({
  compact = false,
  className = "",
}: PrivacyNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-brand/20 bg-brand/8 p-4 text-brand ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/12">
          {compact ? <ShieldCheck className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div>
          <p className="font-black">Privacy notice</p>
          <p className="mt-1 text-sm leading-6 text-brand/85">
            WorkZo AI uses AI to generate interview feedback and scoring. Results are for practice only — always validate important feedback independently.
            Please review outputs before using them for real applications.
          </p>
          {!compact && (
            <p className="mt-2 text-sm leading-6 text-brand/85">
              Privacy: your CV/JD stays in this setup unless you choose to submit feedback. Avoid uploading highly sensitive personal data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
