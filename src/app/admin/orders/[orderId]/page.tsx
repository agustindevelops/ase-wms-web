"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { type User } from "firebase/auth";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type OrderStatus = { id: string; code: string; name: string };

type OrderLine = {
  id: string;
  qtyRequested: number;
  qtyPicked: number;
  qtyReturned: number;
  item: { id: string; name: string; warehouseId: string };
};

type OrderDetail = {
  id: string;
  name: string;
  eventDate: string | null;
  status: OrderStatus;
  lines: OrderLine[];
};

function formatEventDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return value.slice(0, 10);
}

export default function OrderDetailPage() {
  const { user } = useAuthContext() as { user: User | null };
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !orderId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const orderRes = await wmsFetch(`/api/order/${orderId}`, { idToken });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderJson.message ?? "Order not found");
      }
      setOrder(orderJson.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [user, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-brown-500">Loading…</p>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-peach-700">{error ?? "Order not found"}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Link
        href="/admin/orders"
        className="text-sm font-medium text-green-800 underline-offset-2 hover:underline"
      >
        ← Orders
      </Link>
      <h2 className="mt-4 font-nickainley text-3xl text-brown-800">
        {order.name}
      </h2>
      <p className="mt-1 text-sm text-brown-600">
        {order.status.name}
        {order.eventDate ? ` · ${formatEventDate(order.eventDate)}` : ""}
      </p>

      {error ? (
        <p className="mt-4 text-sm text-peach-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-10">
        <h3 className="font-nickainley text-2xl text-brown-800">Items</h3>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brown-200 text-brown-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Picked</th>
                <th className="px-4 py-3 font-medium">Returned</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-brown-500" colSpan={4}>
                    No items yet.
                  </td>
                </tr>
              ) : (
                order.lines.map((line) => (
                  <tr key={line.id} className="border-t border-brown-100">
                    <td className="px-4 py-3 text-brown-800">
                      {line.item.name}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {line.qtyRequested}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {line.qtyPicked}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {line.qtyReturned}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
