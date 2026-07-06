import type { Metadata } from "next";
import { MarketingShell, SectionHeading } from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";

export const metadata: Metadata = {
  title: "Request a demo, WorkZo AI",
  description:
    "Bring WorkZo AI to your bootcamp, university, or hiring team. Tell us your cohort size and goals and we'll shape a pilot around you, we reply within one business day.",
};

export default function RequestDemoPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Request a demo"
          title="Bring WorkZo AI to your team or cohort"
          intro="Running interview prep for a bootcamp, university, or hiring team? Tell us your cohort size and goals, we reply within one business day and shape a pilot around you."
        />
        <div className="mt-8">
          <B2BLeadForm source="request-demo" />
        </div>
      </section>
    </MarketingShell>
  );
}
