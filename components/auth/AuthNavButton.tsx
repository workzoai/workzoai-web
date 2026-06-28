"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type AuthState = {
  loading: boolean;
  email: string;
};

export default function AuthNavButton() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, email: "" });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setAuth({ loading: false, email: data.user?.email || "" });
      } catch {
        if (!mounted) return;
        setAuth({ loading: false, email: "" });
      }
    }

    void loadUser();

    function handleClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    return () => {
      mounted = false;
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  if (auth.loading) {
    return (
      <div className="h-10 w-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
    );
  }

  if (!auth.email) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
      >
        Login
      </Link>
    );
  }

  const shortEmail = auth.email.length > 24 ? `${auth.email.slice(0, 21)}…` : auth.email;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 backdrop-blur transition hover:bg-emerald-400/15"
      >
        <UserRound className="h-4 w-4" />
        Account
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-lg border border-white/10 bg-[#071120]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 py-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Signed in</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{shortEmail}</p>
          </div>

          <Link href="/onboarding" className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-black text-slate-200 hover:bg-white/10 hover:text-white">
            Start interview
          </Link>
          <Link href="/history" className="block rounded-xl px-3 py-2.5 text-sm font-black text-slate-200 hover:bg-white/10 hover:text-white">
            Dashboard
          </Link>
          <Link href="/dashboard/settings" className="block rounded-xl px-3 py-2.5 text-sm font-black text-slate-200 hover:bg-white/10 hover:text-white">
            Account & settings
          </Link>
          <Link href="/history" className="block rounded-xl px-3 py-2.5 text-sm font-black text-slate-200 hover:bg-white/10 hover:text-white">
            Interview history
          </Link>

          <form action="/logout" method="post" className="mt-2 border-t border-white/10 pt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
