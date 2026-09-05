"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  summary: string;
  createdAt: string;
  actor: { email: string; initial: string };
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ActivityPage() {
  const { user } = useAuthContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await wisJson<{ day: string; activities: ActivityItem[] }>(
        "/api/dashboard/activity?limit=100",
      );
      setActivities(res.activities);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load activity");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void load();
    }
  }, [user, load]);

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-nickainley text-3xl text-brown-900">Activity</h1>
          <p className="mt-1 text-sm text-brown-500">Last 24 hours</p>
        </div>
        <Link
          href="/admin"
          className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 hover:bg-brown-100"
        >
          Back
        </Link>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-peach-300 bg-white/60 p-4">
          <p className="text-sm text-peach-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-full bg-brown-100 px-4 py-2 text-sm font-medium text-brown-800"
          >
            Retry
          </button>
        </div>
      ) : null}

      {busy ? (
        <p className="mt-8 text-sm text-brown-500">Loading…</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {!busy && activities.length === 0 ? (
          <p className="text-sm text-brown-500">
            No activity in the last 24 hours.
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
              <p className="truncate text-xs text-brown-500">{item.actor.email}</p>
            </div>
            <p className="shrink-0 text-xs text-brown-500">
              {timeAgo(item.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
