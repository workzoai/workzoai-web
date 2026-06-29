import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Map, Newspaper, ShieldCheck, UserRound } from "lucide-react";

const resources = [
  { title: "About WorkZo AI", text: "Read the founder story and why WorkZo exists.", href: "/about", icon: UserRound },
  { title: "FAQ", text: "Common questions about interviews, reports, privacy, and plans.", href: "/faq", icon: HelpCircle },
  { title: "Help Center", text: "Get support for login, CV upload, interviews, and results.", href: "/help", icon: BookOpen },
  { title: "Roadmap", text: "See what is planned next for WorkZo AI.", href: "/roadmap", icon: Map },
  { title: "Changelog", text: "Follow product updates and fixes.", href: "/changelog", icon: Newspaper },
  { title: "Privacy & Legal", text: "Review privacy, terms, cookies, disclaimer, and data deletion.", href: "/legal/privacy", icon: ShieldCheck },
];

export const metadata = {
  title: "Resources | WorkZo AI",
  description: "WorkZo AI resources, help, FAQ, roadmap, legal pages, and product updates.",
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <section className="mt-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-muted">Resources</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-4xl">Everything you need to understand WorkZo AI.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted">
            Product information, support, legal pages, updates, and launch resources in one place.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group rounded-lg border border-line bg-fg/[0.04] p-6 transition hover:-translate-y-1 hover:border-brand/30 hover:bg-fg/[0.07]">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-black">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-muted group-hover:text-muted">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
