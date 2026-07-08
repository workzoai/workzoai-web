import type { Metadata } from "next";
import { Suspense } from "react";
import RedeemClient from "./RedeemClient";

export const metadata: Metadata = {
  title: "Redeem your WorkZo AI trial",
  description: "Activate your partner trial: 7 AI interviews, 14 days, full Premium Pro access.",
  robots: { index: false, follow: false },
};

export default function RedeemPage() {
  return (
    <Suspense fallback={null}>
      <RedeemClient />
    </Suspense>
  );
}
