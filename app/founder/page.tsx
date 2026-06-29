import FounderAnalyticsClient from "./FounderAnalyticsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FounderPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function FounderPage({ searchParams }: FounderPageProps) {
  const params = await Promise.resolve(searchParams || {});
  const secret = firstParam(params.secret);

  if (!secret) {
    return (
      <main className="min-h-screen bg-canvas px-6 py-10 text-fg">
        <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-fg/[0.04] p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-brand">Founder Analytics</p>
          <h1 className="mt-3 text-3xl font-black">Founder access required</h1>
          <p className="mt-3 text-muted">Open this page with your founder secret in the URL.</p>
          <code className="mt-5 block rounded-xl border border-line bg-canvas-soft p-4 text-sm text-brand">
            /founder?secret=YOUR_SECRET
          </code>
        </div>
      </main>
    );
  }

  return <FounderAnalyticsClient />;
}
