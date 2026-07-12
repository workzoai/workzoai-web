"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type Props = {
  destination: string;
  label: string;
  featureSlug: string;
  className?: string;
};

function safeDestination(destination: string, featureSlug: string) {
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}from=feature&feature=${encodeURIComponent(featureSlug)}`;
}

export default function AuthAwareFeatureCTA({ destination, label, featureSlug, className = "" }: Props) {
  const [status, setStatus] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const toolDestination = useMemo(() => safeDestination(destination, featureSlug), [destination, featureSlug]);
  const loginDestination = `/login?next=${encodeURIComponent(toolDestination)}`;

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "signed-in" : "signed-out");
    }).catch(() => {
      if (active) setStatus("signed-out");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <span className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand opacity-80 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" /> Checking account
      </span>
    );
  }

  return (
    <Link
      href={status === "signed-in" ? toolDestination : loginDestination}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand-strong ${className}`}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
