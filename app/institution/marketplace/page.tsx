import type { Metadata } from "next";
import MarketplaceClient from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Institution Talent Marketplace | WorkZo AI",
  description: "Search and review employer-ready, opt-in candidates from institution cohorts.",
  robots: { index: false, follow: false },
};

export default function InstitutionMarketplacePage() {
  return <MarketplaceClient />;
}
