import { redirect, notFound } from "next/navigation";
import { isLocalhostOnly } from "@/lib/localOnly";

export default async function FounderPage() {
  const allowed = await isLocalhostOnly();

  if (!allowed) {
    notFound();
  }

  redirect("/founder/analytics");
}