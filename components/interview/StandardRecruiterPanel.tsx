"use client";

type StandardRecruiterPanelProps = {
  recruiterName?: string;
};

function getRecruiterImage(recruiterName: string) {
  const name = recruiterName.toLowerCase();
  if (name.includes("markus")) return "/recruiters/markus.png";
  if (name.includes("daniel")) return "/recruiters/daniel.png";
  if (name.includes("priya")) return "/recruiters/priya.png";
  if (name.includes("sarah")) return "/recruiters/sarah.png";
  return "/recruiters/daniel.png";
}

export default function StandardRecruiterPanel({
  recruiterName = "Recruiter",
}: StandardRecruiterPanelProps) {
  return (
    <div className="absolute inset-0 bg-canvas">
      <img
        src={getRecruiterImage(recruiterName)}
        alt={`${recruiterName} recruiter`}
        className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,7,18,.12)_0%,rgba(2,7,18,.20)_42%,rgba(2,7,18,.82)_100%)]" />
    </div>
  );
}
