export type RecruiterAssetKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

export const recruiterAssets: Record<
  RecruiterAssetKey,
  {
    image: string;
    fallbackImage: string;
    moodLighting: "emerald" | "blue" | "amber" | "cyan";
    displayName: string;
  }
> = {
  friendly_hr: {
    image: "/recruiters/sarah.png",
    fallbackImage: "/workzo_recruiter_hero.png",
    moodLighting: "emerald",
    displayName: "Sarah",
  },
  analytical_hiring_manager: {
    image: "/recruiters/daniel.png",
    fallbackImage: "/workzo_recruiter_hero.png",
    moodLighting: "blue",
    displayName: "Daniel",
  },
  startup_recruiter: {
    image: "/recruiters/priya.png",
    fallbackImage: "/workzo_recruiter_hero.png",
    moodLighting: "amber",
    displayName: "Priya",
  },
  corporate_recruiter: {
    image: "/recruiters/markus.png",
    fallbackImage: "/workzo_recruiter_hero.png",
    moodLighting: "cyan",
    displayName: "Markus",
  },
};

export function getRecruiterAsset(key?: string) {
  if (
    key === "friendly_hr" ||
    key === "analytical_hiring_manager" ||
    key === "startup_recruiter" ||
    key === "corporate_recruiter"
  ) {
    return recruiterAssets[key];
  }

  return recruiterAssets.analytical_hiring_manager;
}
