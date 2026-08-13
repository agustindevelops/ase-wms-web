"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { type User } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";

export default function AdminPage() {
  const { user } = useAuthContext() as { user: User | null };
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [apiBusy, setApiBusy] = useState(false);

  if (!user) {
    return null;
  }

  const runAuthSmoke = async () => {
    setApiBusy(true);
    setApiStatus(null);
    try {
      const idToken = await user.getIdToken();
      const [healthRes, meRes] = await Promise.all([
        wmsFetch("/api/health", { idToken }),
        wmsFetch("/api/me", { idToken }),
      ]);
      const health = await healthRes.json();
      const me = await meRes.json();

      if (!healthRes.ok || !meRes.ok) {
        setApiStatus(
          `Failed — health ${healthRes.status}, me ${meRes.status}. Check DATABASE_URL + FIREBASE_ADMIN_* in .env.local.`,
        );
        return;
      }

      if (me.tokenRefreshRequired) {
        await user.getIdToken(true);
      }

      setApiStatus(
        `OK — db ${health.db}; Prisma user ${me.user?.email} (${me.user?.id}); warehouse ${me.warehouse?.name} (${me.role?.code})`,
      );
    } catch (error) {
      setApiStatus(
        error instanceof Error ? error.message : "Smoke request failed",
      );
    } finally {
      setApiBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-sm text-brown-500">Signed in as</p>
      <p className="mt-1 text-lg font-medium text-brown-800">{user.email}</p>

      <div className="mt-6 rounded-2xl border border-brown-200 bg-white/60 p-6">
        <h2 className="font-nickainley text-2xl text-brown-800">
          API smoke (ASE-9)
        </h2>
        <p className="mt-2 text-sm text-brown-600">
          Calls <code className="text-brown-800">/api/health</code> (SELECT 1)
          and <code className="text-brown-800">/api/me</code> (User + warehouse
          membership) with your Firebase ID token.
        </p>
        <button
          type="button"
          onClick={runAuthSmoke}
          disabled={apiBusy}
          className="mt-4 rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-60"
        >
          {apiBusy ? "Checking…" : "Run authenticated smoke"}
        </button>
        {apiStatus ? (
          <p className="mt-3 text-sm text-brown-700">{apiStatus}</p>
        ) : null}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
          href="/admin/inventory"
          className="rounded-2xl border border-brown-200 bg-white/60 p-6 transition hover:border-green-500"
        >
          <h2 className="font-nickainley text-2xl text-brown-800">Inventory</h2>
          <p className="mt-2 text-sm text-brown-600">
            Search, edit detailed records, attach photos, and add items to
            orders.
          </p>
        </Link>
      </div>
    </section>
  );
}
