"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

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
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="h-10 w-24 animate-pulse rounded-xl border border-line bg-fg/5" />
      </div>
    );
  }

  if (!auth.email) {
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/10 px-4 py-2 text-sm font-black text-fg backdrop-blur transition hover:bg-fg/20"
        >
          Login
        </Link>
      </div>
    );
  }

  const shortEmail = auth.email.length > 24 ? `${auth.email.slice(0, 21)}…` : auth.email;

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 py-2 text-sm font-black text-success backdrop-blur transition hover:bg-success/15"
      >
        <UserRound className="h-4 w-4" />
        Account
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-lg border border-line bg-canvas/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-line px-3 py-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Signed in</p>
            <p className="mt-1 truncate text-sm font-bold text-fg">{shortEmail}</p>
          </div>

          <Link href="/onboarding" className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-black text-fg hover:bg-fg/10 hover:text-fg">
            Start interview
          </Link>
          <Link href="/dashboard" className="block rounded-xl px-3 py-2.5 text-sm font-black text-fg hover:bg-fg/10 hover:text-fg">
            Dashboard
          </Link>
          <Link href="/dashboard/settings" className="block rounded-xl px-3 py-2.5 text-sm font-black text-fg hover:bg-fg/10 hover:text-fg">
            Account & settings
          </Link>
          <Link href="/history" className="block rounded-xl px-3 py-2.5 text-sm font-black text-fg hover:bg-fg/10 hover:text-fg">
            Interview history
          </Link>

          <form action="/logout" method="post" className="mt-2 border-t border-line pt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black text-danger hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      ) : null}
      </div>
    </div>
  );
}
