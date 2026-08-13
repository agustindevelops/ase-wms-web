"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { type User } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import InventoryForm, { type PendingPhoto } from "../InventoryForm";
import {
  emptyInventoryForm,
  formToPayload,
  type CategoryOption,
  type InventoryFormValues,
  type LookupOption,
} from "../inventoryTypes";

export default function NewInventoryPage() {
  const { user } = useAuthContext() as { user: User | null };
  const router = useRouter();
  const [values, setValues] = useState<InventoryFormValues>(emptyInventoryForm);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [materials, setMaterials] = useState<LookupOption[]>([]);
  const [conditions, setConditions] = useState<LookupOption[]>([]);
  const [dispositions, setDispositions] = useState<LookupOption[]>([]);
  const [idToken, setIdToken] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    void (async () => {
      try {
        const token = await user.getIdToken();
        setIdToken(token);
        const [meRes, catRes, matRes, condRes, dispRes] = await Promise.all([
          wmsFetch("/api/me", { idToken: token }),
          wmsFetch("/api/lookup/item-categories", { idToken: token }),
          wmsFetch("/api/lookup/materials", { idToken: token }),
          wmsFetch("/api/lookup/item-conditions", { idToken: token }),
          wmsFetch("/api/lookup/item-dispositions", { idToken: token }),
        ]);
        const me = await meRes.json();
        const catJson = await catRes.json();
        const matJson = await matRes.json();
        const condJson = await condRes.json();
        const dispJson = await dispRes.json();
        if (!meRes.ok || !me.warehouse?.id) {
          throw new Error(me.message ?? "No warehouse on this account");
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
        setWarehouseId(me.warehouse.id);
        setCategories(catJson.categories);
        setMaterials(matJson.materials);
        setConditions(condJson.conditions);
        setDispositions(dispJson.dispositions);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load form");
      }
    })();
  }, [user]);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const payload = formToPayload(values);
      const response = await wmsFetch("/api/item/catalog", {
        idToken: token,
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
      {idToken ? (
        <InventoryForm
          values={values}
          onChange={setValues}
          categories={categories}
          materials={materials}
          conditions={conditions}
          dispositions={dispositions}
          pendingPhotos={pendingPhotos}
          onPendingPhotosChange={setPendingPhotos}
          idToken={idToken}
          submitLabel="Create item"
          busy={busy}
          error={error}
          onSubmit={(event: FormEvent) => void handleSubmit(event)}
          requireNewPhoto
        />
      ) : (
        <p className="mt-6 text-sm text-brown-500">Loading…</p>
      )}
    </section>
  );
}
