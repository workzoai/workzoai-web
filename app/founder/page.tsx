"use client";

import { useEffect, useState } from "react";

type Stats = {
  totalEvents: number;
  interviewStarts: number;
  interviewCompleted: number;
  completionRate: number;
  mobileUsers: number;
  desktopUsers: number;
  recruiterCounts: Record<string, number>;
};

type ApiResponse = {
  success?: boolean;
  stats?: Partial<Stats>;
  recentEvents?: any[];
};

const EMPTY_STATS: Stats = {
  totalEvents: 0,
  interviewStarts: 0,
  interviewCompleted: 0,
  completionRate: 0,
  mobileUsers: 0,
  desktopUsers: 0,
  recruiterCounts: {},
};

export default function FounderDashboard() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        setStats({
          ...EMPTY_STATS,
          ...(data.stats || {}),
          recruiterCounts: data.stats?.recruiterCounts || {},
        });
        setRecentEvents(Array.isArray(data.recentEvents) ? data.recentEvents : []);
      })
      .catch(() => {
        setStats(EMPTY_STATS);
        setRecentEvents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="min-h-screen bg-black p-8 text-white">Loading analytics...</main>;
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <h1 className="mb-8 text-4xl font-bold">WorkZo Founder Dashboard</h1>

      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card title="Total Events" value={stats.totalEvents} />
        <Card title="Interview Starts" value={stats.interviewStarts} />
        <Card title="Completed" value={stats.interviewCompleted} />
        <Card title="Completion Rate" value={`${stats.completionRate}%`} />
        <Card title="Mobile Users" value={stats.mobileUsers} />
        <Card title="Desktop Users" value={stats.desktopUsers} />
      </div>

      <h2 className="mb-4 text-2xl font-semibold">Recruiter Popularity</h2>
      <div className="mb-10 space-y-3">
        {Object.keys(stats.recruiterCounts).length === 0 ? (
          <p className="text-zinc-400">No recruiter data yet.</p>
        ) : (
          Object.entries(stats.recruiterCounts).map(([name, count]) => (
            <div key={name} className="flex justify-between rounded-xl bg-zinc-900 p-4">
              <span>{name}</span>
              <span>{count}</span>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-4 text-2xl font-semibold">Recent Events</h2>
      <div className="space-y-3">
        {recentEvents.map((event, index) => (
          <div key={index} className="rounded-xl bg-zinc-900 p-4">
            <div className="font-semibold">{event.event || "unknown_event"}</div>
            <div className="text-sm text-zinc-400">{event.path || "/"}</div>
            <div className="text-sm text-zinc-500">{event.created_at || event.timestamp || ""}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-2 text-sm text-zinc-400">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}