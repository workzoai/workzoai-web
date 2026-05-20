"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
  stats: {
    totalEvents: number;
    interviewStarts: number;
    interviewCompleted: number;
    completionRate: number;
    mobileUsers: number;
    desktopUsers: number;
    recruiterCounts: Record<string, number>;
  };
  recentEvents: any[];
};

export default function FounderDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        Loading analytics...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-8">
        WorkZo Founder Dashboard
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Card
          title="Total Events"
          value={data.stats.totalEvents}
        />

        <Card
          title="Interview Starts"
          value={data.stats.interviewStarts}
        />

        <Card
          title="Completed"
          value={data.stats.interviewCompleted}
        />

        <Card
          title="Completion Rate"
          value={`${data.stats.completionRate}%`}
        />

        <Card
          title="Mobile Users"
          value={data.stats.mobileUsers}
        />

        <Card
          title="Desktop Users"
          value={data.stats.desktopUsers}
        />
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">
          Recruiter Popularity
        </h2>

        <div className="space-y-3">
          {Object.entries(
            data.stats.recruiterCounts
          ).map(([name, count]) => (
            <div
              key={name}
              className="flex justify-between bg-zinc-900 p-4 rounded-xl"
            >
              <span>{name}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">
          Recent Events
        </h2>

        <div className="space-y-3">
          {data.recentEvents.map((event, index) => (
            <div
              key={index}
              className="bg-zinc-900 p-4 rounded-xl"
            >
              <div className="font-semibold">
                {event.event}
              </div>

              <div className="text-sm text-zinc-400">
                {event.path}
              </div>

              <div className="text-sm text-zinc-500">
                {event.created_at}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
      <div className="text-zinc-400 text-sm mb-2">
        {title}
      </div>

      <div className="text-3xl font-bold">
        {value}
      </div>
    </div>
  );
}