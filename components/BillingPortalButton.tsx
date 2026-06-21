"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function openPortal() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open Stripe portal.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing portal.");
      setLoading(false);
    }
  }
  return <div><button type="button" onClick={openPortal} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Manage in Stripe</button>{error && <p className="mt-2 text-sm text-red-300">{error}</p>}</div>;
}
