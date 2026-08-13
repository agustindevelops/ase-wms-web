"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import InventoryForm, { type PendingPhoto } from "../InventoryForm";
import {
  emptyInventoryForm,
  fieldClass,
  formToPayload,
  type CategoryOption,
  type InventoryFormValues,
  type LookupOption,
} from "../inventoryTypes";

type WarehouseOption = { id: string; name: string };

export default function NewInventoryPage() {
  const { user, warehouseId: claimWarehouseId } = useAuthContext();
  const router = useRouter();
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryForm);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [materials, setMaterials] = useState<LookupOption[]>([]);
  const [conditions, setConditions] = useState<LookupOption[]>([]);
  const [dispositions, setDispositions] = useState<LookupOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    void (async () => {
      try {
        const [invRes, catRes, matRes, condRes, dispRes] = await Promise.all([
          wmsFetch("/api/inventory?archived=0"),
          wmsFetch("/api/lookup/item-categories"),
          wmsFetch("/api/lookup/materials"),
          wmsFetch("/api/lookup/item-conditions"),
          wmsFetch("/api/lookup/item-dispositions"),
        ]);
        const invJson = await invRes.json();
        const catJson = await catRes.json();
        const matJson = await matRes.json();
        const condJson = await condRes.json();
        const dispJson = await dispRes.json();
        if (!invRes.ok) {
          throw new Error(invJson.message ?? "Could not load warehouses");
        }
        if (!catRes.ok) {
          throw new Error(catJson.message ?? "Could not load categories");
        }
        if (!matRes.ok) {
          throw new Error(matJson.message ?? "Could not load materials");
        }
        if (!condRes.ok) {
          throw new Error(condJson.message ?? "Could not load conditions");
        }
        if (!dispRes.ok) {
          throw new Error(dispJson.message ?? "Could not load dispositions");
        }
        const nextWarehouses = (invJson.warehouses ?? []) as WarehouseOption[];
        setWarehouses(nextWarehouses);
        setWarehouseId((current) => {
          if (current) {
            return current;
          }
          if (
            claimWarehouseId &&
            nextWarehouses.some((warehouse) => warehouse.id === claimWarehouseId)
          ) {
            return claimWarehouseId;
          }
          return nextWarehouses[0]?.id || "";
        });
        setCategories(catJson.categories);
        setMaterials(matJson.materials);
        setConditions(condJson.conditions);
        setDispositions(dispJson.dispositions);
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load form");
      }
    })();
  }, [user, claimWarehouseId]);

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
      const response = await wmsFetch("/api/item/catalog", {
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
      {ready ? (
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
            categories={categories}
            materials={materials}
            conditions={conditions}
            dispositions={dispositions}
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
          {error ?? "Loading…"}
        </p>
      )}
    </section>
  );
}
