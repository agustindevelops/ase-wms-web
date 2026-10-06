"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type DashboardSummary = {
  totalInventory: number;
  upcomingEventsThisMonth: number;
  issuesThisMonth: number;
  changesLast24Hours: number;
};

type ActivityItem = {
  id: string;
  summary: string;
  createdAt: string;
  actor: { email: string; initial: string };
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MetricCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const card = (
    <div
      className={`rounded-2xl border border-brown-200 bg-white/70 p-5 ${
        href ? "transition hover:border-green-500" : ""
      }`}
    >
      <p className="text-xs tracking-wide text-brown-500 uppercase">{label}</p>
      <p className="font-nickainley mt-2 text-3xl text-brown-900">{value}</p>
    </div>
  );
  if (!href) {
    return card;
  }
  return <Link href={href}>{card}</Link>;
}

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof Error ? error.message : "Failed to load dashboard";
}

export default function AdminPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () =>
      wisJson<{ summary: DashboardSummary }>("/api/dashboard/summary"),
    enabled: Boolean(userId),
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity", 3],
    queryFn: () =>
      wisJson<{ day: string; activities: ActivityItem[] }>(
        "/api/dashboard/activity?limit=3",
      ),
    enabled: Boolean(userId),
  });

  const summary = summaryQuery.data?.summary ?? null;
  const activities = activityQuery.data?.activities ?? [];
  const busy = summaryQuery.isLoading || activityQuery.isLoading;
  const error =
    errorMessage(summaryQuery.error) ?? errorMessage(activityQuery.error);

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <p className="font-nickainley text-3xl text-coral">{greeting()}!</p>
      <p className="mt-1 text-sm text-brown-500">
        Signed in as {user.email}
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-peach-300 bg-white/60 p-4">
          <p className="text-sm text-peach-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void activityQuery.refetch();
            }}
            className="mt-3 rounded-full bg-brown-100 px-4 py-2 text-sm font-medium text-brown-800"
          >
            Retry
          </button>
        </div>
      ) : null}

      {busy && !summary ? (
        <p className="mt-8 text-sm text-brown-500">Loading dashboard…</p>
      ) : null}

      {summary ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total inventory" value={summary.totalInventory} />
          <MetricCard
            label="Upcoming events"
            value={summary.upcomingEventsThisMonth}
          />
          <MetricCard
            label="Issues this month"
            value={summary.issuesThisMonth}
            href="/admin/reports"
          />
          <MetricCard label="Last 24 hours" value={summary.changesLast24Hours} />
        </div>
      ) : null}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-nickainley text-2xl text-brown-800">
            Recent Activity
          </h2>
          <Link
            href="/admin/activity"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            See all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {activities.length === 0 && !busy ? (
            <p className="text-sm text-brown-500">
              No changes in the last 24 hours.
            </p>
          ) : null}
          {activities.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-brown-200 bg-white/60 p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">
                {item.actor.initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brown-900">
                  {item.summary}
                </p>
                <p className="truncate text-xs text-brown-500">
                  {item.actor.email}
                </p>
              </div>
              <p className="shrink-0 text-xs text-brown-500">
                {timeAgo(item.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/orders"
          className="rounded-2xl border border-brown-200 bg-white/60 p-6 transition hover:border-green-500"
        >
          <h2 className="font-nickainley text-2xl text-brown-800">Orders</h2>
          <p className="mt-2 text-sm text-brown-600">
            View orders, create an event order, and add items.
          </p>
        </Link>
        <Link
          href="/admin/packages"
          className="rounded-2xl border border-brown-200 bg-white/60 p-6 transition hover:border-green-500"
        >
          <h2 className="font-nickainley text-2xl text-brown-800">Packages</h2>
          <p className="mt-2 text-sm text-brown-600">
            Build reusable offerings with items, pricing, photos, and videos.
          </p>
        </Link>
        <Link
          href="/admin/inventory"
          className="rounded-2xl border border-brown-200 bg-white/60 p-6 transition hover:border-green-500"
        >
          <h2 className="font-nickainley text-2xl text-brown-800">Inventory</h2>
          <p className="mt-2 text-sm text-brown-600">
            Search, edit detailed records, attach photos, and add items to
            orders.
          </p>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-2xl border border-brown-200 bg-white/60 p-6 transition hover:border-green-500"
        >
          <h2 className="font-nickainley text-2xl text-brown-800">Reports</h2>
          <p className="mt-2 text-sm text-brown-600">
            Review missing and broken items from the warehouse and returns.
          </p>
        </Link>
      </div>
    </section>
  );
}
