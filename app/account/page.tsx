import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/account");

  return (
    <main className="min-h-screen bg-[#050b14] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-blue-500/15 text-blue-200">
            <UserRound className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-3xl font-black">Your account</h1>
          <p className="mt-2 text-slate-300">Manage your WorkZo AI login session.</p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Signed in as</p>
            <p className="mt-2 break-all text-lg font-black text-white">{user.email}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 text-sm font-black text-white hover:bg-blue-400">
              <ShieldCheck className="h-4 w-4" />
              Go to dashboard
            </Link>

            <form action="/logout" method="post">
              <button type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-black text-slate-200 hover:bg-white/10 sm:w-auto">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
