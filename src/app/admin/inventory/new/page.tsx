"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wisFetch, wisJson } from "@/lib/api/wisFetch";
import { useInventoryLookups } from "@/lib/query/lookups";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import InventoryForm, { type PendingPhoto } from "../InventoryForm";
import {
  emptyInventoryForm,
  fieldClass,
  formToPayload,
  type InventoryFormValues,
} from "../inventoryTypes";

type WarehouseOption = { id: string; name: string };

export default function NewInventoryPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const lookups = useInventoryLookups();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryForm);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ["inventory", { archived: "0" }],
    queryFn: () =>
      wisJson<{ warehouses?: WarehouseOption[] }>("/api/item?archived=0"),
    enabled: Boolean(userId),
  });
  const warehouses = warehousesQuery.data?.warehouses ?? [];

  useEffect(() => {
    if (warehouseId || warehouses.length === 0) {
      return;
    }
    setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!warehouseId) {
      setError("Select a warehouse");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = formToPayload(values);
      const response = await wisFetch("/api/item", {
        method: "POST",
        body: JSON.stringify({
          warehouseId,
          ...payload,
          photoFileIds: pendingPhotos.map((photo) => photo.fileId),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "Could not create item");
      }
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      router.push(`/admin/inventory/${json.item.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

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
        New item
      </h2>
      <p className="mt-1 text-sm text-brown-600">
        Upload a verified photo, then fill catalog and detail fields.
      </p>
      {!warehousesQuery.isLoading && !lookups.isLoading ? (
        <>
          <div className="mt-6 max-w-sm">
            <label
              htmlFor="warehouseId"
              className="mb-2 block text-sm font-medium text-brown-700"
            >
              Warehouse
            </label>
            <select
              id="warehouseId"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={fieldClass}
            >
              {warehouses.length === 0 ? (
                <option value="">No warehouses</option>
              ) : (
                warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <InventoryForm
            values={values}
            onChange={setValues}
            categories={lookups.categories}
            materials={lookups.materials}
            conditions={lookups.conditions}
            dispositions={lookups.dispositions}
            pendingPhotos={pendingPhotos}
            onPendingPhotosChange={setPendingPhotos}
            submitLabel="Create item"
            busy={busy}
            error={error}
            onSubmit={(event: FormEvent) => void handleSubmit(event)}
            requireNewPhoto
          />
        </>
      ) : (
        <p className="mt-6 text-sm text-brown-500">
          {error ??
            lookups.error ??
            (warehousesQuery.error instanceof Error
              ? warehousesQuery.error.message
              : "Loading…")}
        </p>
      )}
    </section>
  );
}
