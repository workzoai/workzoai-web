"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

export default function BillingPortalButton({ disabled = false }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/create-portal-session", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Could not open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={disabled || loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        {loading ? "Opening billing…" : "Manage or cancel in Stripe"}
      </button>
      {error && <p className="mt-3 text-sm font-bold text-red-200">{error}</p>}
    </div>
  );
}
