import { notFound } from "next/navigation";
import { isLocalhostOnly } from "@/lib/localOnly";
import FounderAnalyticsClient from "./FounderAnalyticsClient";

export default async function FounderAnalyticsPage() {
  const allowed = await isLocalhostOnly();

  if (!allowed) {
    notFound();
  }

  return <FounderAnalyticsClient />;
}