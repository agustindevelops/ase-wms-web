"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch, wmsJson } from "@/lib/api/wmsFetch";
import { useInventoryLookups } from "@/lib/query/lookups";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import InventoryForm, { type PendingPhoto } from "../InventoryForm";
import {
  emptyInventoryForm,
  fieldClass,
  formToPayload,
  itemToForm,
  type InventoryFormValues,
  type InventoryItem,
} from "../inventoryTypes";

type OrderListItem = {
  id: string;
  name: string;
  eventDate: string | null;
};

export default function EditInventoryPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const lookups = useInventoryLookups();
  const queryClient = useQueryClient();
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryForm);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [orderId, setOrderId] = useState("");
  const [qtyRequested, setQtyRequested] = useState("1");
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const itemQuery = useQuery({
    queryKey: ["inventory-item", itemId],
    queryFn: () => wmsJson<{ item: InventoryItem }>(`/api/item/${itemId}`),
    enabled: Boolean(userId && itemId),
  });
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => wmsJson<{ orders: OrderListItem[] }>("/api/order"),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!itemQuery.data?.item) {
      return;
    }
    setItem(itemQuery.data.item);
    setValues(itemToForm(itemQuery.data.item));
  }, [itemQuery.data]);

  useEffect(() => {
    const nextOrders = ordersQuery.data?.orders ?? [];
    setOrderId((current) => current || nextOrders[0]?.id || "");
  }, [ordersQuery.data]);

  const orders = ordersQuery.data?.orders ?? [];
  const loading = itemQuery.isLoading || ordersQuery.isLoading;

  if (!user) {
    return null;
  }

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = formToPayload(values);
      const response = await wmsFetch(`/api/item/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          quantityOwned: payload.quantity,
          ...(pendingPhotos.length > 0
            ? { photoFileIds: pendingPhotos.map((photo) => photo.fileId) }
            : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "Could not save item");
      }
      setItem(json.item);
      setValues(itemToForm(json.item));
      queryClient.setQueryData(["inventory-item", itemId], { item: json.item });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPendingPhotos([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const addToOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!item || !orderId) {
      return;
    }
    setBusy(true);
    setError(null);
    setOrderMessage(null);
    try {
      const response = await wmsFetch(`/api/order/${orderId}/line`, {
        method: "POST",
        body: JSON.stringify({
          itemId: item.id,
          qtyRequested: Number(qtyRequested),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "Could not add to order");
      }
      setOrderMessage(`Added to ${json.order.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Add to order failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || lookups.isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-brown-500">
          {lookups.error ??
            (itemQuery.error instanceof Error
              ? itemQuery.error.message
              : "Loading…")}
        </p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-peach-700">
          {error ??
            (itemQuery.error instanceof Error
              ? itemQuery.error.message
              : "Item not found")}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm">
        <Link
          href="/admin/inventory"
          className="text-green-800 underline-offset-2 hover:underline"
        >
          ← Inventory
        </Link>
      </p>
      <h2 className="mt-4 font-nickainley text-3xl text-brown-800">
        {item.name}
      </h2>
      <p className="mt-1 text-sm text-brown-600">
        {item.warehouse?.name ? `${item.warehouse.name} · ` : ""}
        {item.locationPath ||
          item.locationUnit?.label ||
          item.locationUnit?.name ||
          "No location"}
        {" · "}
        {item.quantityOwned} owned / {item.quantityAvailable} available
      </p>

      <InventoryForm
        values={values}
        onChange={setValues}
        categories={lookups.categories}
        materials={lookups.materials}
        conditions={lookups.conditions}
        dispositions={lookups.dispositions}
        existingPhotos={item.files}
        pendingPhotos={pendingPhotos}
        onPendingPhotosChange={setPendingPhotos}
        submitLabel="Save item"
        busy={busy}
        error={error}
        onSubmit={(event) => void saveItem(event)}
      />

      <div className="mt-10 rounded-2xl border border-brown-200 bg-white/60 p-6">
        <h3 className="font-nickainley text-2xl text-brown-800">
          Add to order
        </h3>
        <p className="mt-1 text-sm text-brown-600">
          Creates a line or updates quantity if this item is already on the
          order.
        </p>
        <form
          onSubmit={(event) => void addToOrder(event)}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <label
              htmlFor="orderId"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Order
            </label>
            <select
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className={fieldClass}
            >
              {orders.length === 0 ? (
                <option value="">No orders yet</option>
              ) : (
                orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.name}
                    {order.eventDate ? ` (${order.eventDate.slice(0, 10)})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="w-28">
            <label
              htmlFor="qtyRequested"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Qty
            </label>
            <input
              id="qtyRequested"
              type="number"
              min={1}
              step={1}
              value={qtyRequested}
              onChange={(e) => setQtyRequested(e.target.value)}
              className={fieldClass}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !orderId}
            className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Add to order
          </button>
        </form>
        {orderMessage ? (
          <p className="mt-3 text-sm text-brown-700">
            {orderMessage}{" "}
            {orderId ? (
              <Link
                href={`/admin/orders/${orderId}`}
                className="font-medium text-green-800 underline-offset-2 hover:underline"
              >
                Open order
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
