"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { type User } from "firebase/auth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OrderStatus = { id: string; code: string; name: string };

type OrderListItem = {
  id: string;
  name: string;
  eventDate: string | null;
  status: OrderStatus;
  _count: { lines: number };
};

function formatEventDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return value.slice(0, 10);
}

export default function OrdersPage() {
  const { user } = useAuthContext() as { user: User | null };
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const params = new URLSearchParams();
      for (const code of selectedCodes) {
        params.append("status", code);
      }
      const query = params.toString();
      const [statusRes, orderRes] = await Promise.all([
        wmsFetch("/api/lookup/order-statuses", { idToken }),
        wmsFetch(query ? `/api/order?${query}` : "/api/order", { idToken }),
      ]);
      const statusJson = await statusRes.json();
      const orderJson = await orderRes.json();
      if (!statusRes.ok) {
        throw new Error(statusJson.message ?? "Could not load statuses");
      }
      if (!orderRes.ok) {
        throw new Error(orderJson.message ?? "Could not load orders");
      }
      setStatuses(statusJson.statuses);
      setOrders(orderJson.orders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCodes]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code)
        ? current.filter((value) => value !== code)
        : [...current, code],
    );
  };

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-nickainley text-3xl text-brown-800">Orders</h2>
          <p className="mt-1 text-sm text-brown-600">
            All event orders. Filter by status if needed.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {statuses.map((status) => {
          const active = selectedCodes.includes(status.code);
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => toggleStatus(status.code)}
              className={
                active
                  ? "rounded-full bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-brown-300 px-3 py-1.5 text-sm font-medium text-brown-700 hover:bg-brown-100"
              }
            >
              {status.name}
            </button>
          );
        })}
        {selectedCodes.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedCodes([])}
            className="rounded-full px-3 py-1.5 text-sm text-brown-500 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brown-200 text-brown-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Event date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lines</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={4}>
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={4}>
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-brown-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-green-800 underline-offset-2 hover:underline"
                    >
                      {order.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {formatEventDate(order.eventDate)}
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {order.status.name}
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {order._count.lines}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
