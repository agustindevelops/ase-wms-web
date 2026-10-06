"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import {
  useOrderStatuses,
  type OrderStatusOption,
} from "@/lib/query/lookups";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

type OrderListItem = {
  id: string;
  name: string;
  eventDate: string | null;
  status: OrderStatusOption;
  contact: { firstName: string; lastName: string } | null;
  package: { id: string; name: string } | null;
  _count: { items: number };
};

function formatEventDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return value.slice(0, 10);
}

export default function OrdersPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { data: statuses = [], error: statusesError } = useOrderStatuses();
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const ordersQuery = useQuery({
    queryKey: ["orders", selectedCodes],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const code of selectedCodes) {
        params.append("status", code);
      }
      const query = params.toString();
      return wisJson<{ orders: OrderListItem[] }>(
        query ? `/api/order?${query}` : "/api/order",
      );
    },
    enabled: Boolean(userId),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const loading = ordersQuery.isLoading;
  const error =
    ordersQuery.error instanceof Error
      ? ordersQuery.error.message
      : ordersQuery.error
        ? "Failed to load orders"
        : null;

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
          <h2 className="font-nickainley text-3xl text-coral">Orders</h2>
          <p className="mt-1 text-sm text-brown-600">
            All event orders. Filter by status if needed.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          Create order
        </Link>
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

      {error || statusesError ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {error ??
            (statusesError instanceof Error
              ? statusesError.message
              : "Could not load statuses")}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brown-200 text-brown-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Event date</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Package</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={6}>
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
                    {order.contact
                      ? `${order.contact.firstName} ${order.contact.lastName}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {order.package?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {order.status.name}
                  </td>
                  <td className="px-4 py-3 text-brown-700">
                    {order._count.items}
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
