"use client";

import { wmsFetch } from "@/lib/api/wmsFetch";
import { ChangeEvent, FormEvent, useState } from "react";
import {
  fieldClass,
  type CategoryOption,
  type InventoryFormValues,
  type LookupOption,
} from "./inventoryTypes";

export type PendingPhoto = { fileId: string; previewUrl: string };

type Props = {
  values: InventoryFormValues;
  onChange: (values: InventoryFormValues) => void;
  categories: CategoryOption[];
  materials: LookupOption[];
  conditions: LookupOption[];
  dispositions: LookupOption[];
  existingPhotos?: Array<{ id: string; readUrl: string | null }>;
  pendingPhotos: PendingPhoto[];
  onPendingPhotosChange: (photos: PendingPhoto[]) => void;
  idToken: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
  requireNewPhoto?: boolean;
};

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export async function uploadVerifiedPhoto(
  idToken: string,
  file: File,
): Promise<PendingPhoto> {
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Photo must be JPEG, PNG, or WebP");
  }

  const signRes = await wmsFetch("/api/img/upload", {
    idToken,
    method: "POST",
    body: JSON.stringify({
      content_type: file.type,
      byte_size: file.size,
    }),
  });
  const signJson = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signJson.message ?? "Could not start photo upload");
  }

  const putRes = await fetch(signJson.upload_url as string, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Direct upload failed (${putRes.status})`);
  }

  const verifyRes = await wmsFetch("/api/img/verify", {
    idToken,
    method: "POST",
    body: JSON.stringify({ file_id: signJson.file_id }),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(verifyJson.message ?? "Photo verification failed");
  }

  return {
    fileId: signJson.file_id as string,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function InventoryForm({
  values,
  onChange,
  categories,
  materials,
  conditions,
  dispositions,
  existingPhotos = [],
  pendingPhotos,
  onPendingPhotosChange,
  idToken,
  submitLabel,
  busy,
  error,
  onSubmit,
  requireNewPhoto = false,
}: Props) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const setField = <K extends keyof InventoryFormValues>(
    key: K,
    value: InventoryFormValues[K],
  ) => {
    onChange({ ...values, [key]: value });
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const photo = await uploadVerifiedPhoto(idToken, file);
      onPendingPhotosChange([...pendingPhotos, photo]);
    } catch (cause) {
      setPhotoError(
        cause instanceof Error ? cause.message : "Photo upload failed",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePending = (fileId: string) => {
    const photo = pendingPhotos.find((entry) => entry.fileId === fileId);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    onPendingPhotosChange(
      pendingPhotos.filter((entry) => entry.fileId !== fileId),
    );
  };

  const hasPhoto =
    existingPhotos.length > 0 || pendingPhotos.length > 0;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 grid gap-4 rounded-2xl border border-brown-200 bg-white/60 p-6 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <p className="mb-2 text-sm font-medium text-brown-700">Photos</p>
        <div className="flex flex-wrap gap-3">
          {existingPhotos.map((file) =>
            file.readUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={file.id}
                src={file.readUrl}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
            ) : (
              <div
                key={file.id}
                className="flex h-20 w-20 items-center justify-center rounded-lg bg-brown-100 text-xs text-brown-500"
              >
                No preview
              </div>
            ),
          )}
          {pendingPhotos.map((photo) => (
            <div key={photo.fileId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removePending(photo.fileId)}
                className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-xs text-peach-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <label className="mt-3 inline-flex cursor-pointer rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 hover:bg-brown-100">
          {photoBusy ? "Uploading…" : "Add verified photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={photoBusy || busy}
            onChange={(event) => void onFileChange(event)}
          />
        </label>
        {requireNewPhoto && !hasPhoto ? (
          <p className="mt-2 text-xs text-brown-500">
            At least one verified photo is required.
          </p>
        ) : null}
        {photoError ? (
          <p className="mt-2 text-sm text-peach-700" role="alert">
            {photoError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-brown-700">
          Name
        </label>
        <input
          id="name"
          required
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="quantity"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Quantity owned
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          step={1}
          required
          value={values.quantity}
          onChange={(e) => setField("quantity", e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="categoryId"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Category
        </label>
        <select
          id="categoryId"
          value={values.categoryId}
          onChange={(e) => setField("categoryId", e.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="material"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Material
        </label>
        <select
          id="material"
          value={values.material}
          onChange={(e) => setField("material", e.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {materials.map((material) => (
            <option key={material.code} value={material.code}>
              {material.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="unitRentalPrice"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Unit rental price
        </label>
        <input
          id="unitRentalPrice"
          inputMode="decimal"
          value={values.unitRentalPrice}
          onChange={(e) => setField("unitRentalPrice", e.target.value)}
          placeholder="0.00"
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="replacementCost"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Replacement cost
        </label>
        <input
          id="replacementCost"
          inputMode="decimal"
          value={values.replacementCost}
          onChange={(e) => setField("replacementCost", e.target.value)}
          placeholder="0.00"
          className={fieldClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label
          htmlFor="purchaseLink"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Purchase link
        </label>
        <input
          id="purchaseLink"
          type="text"
          value={values.purchaseLink}
          onChange={(e) => setField("purchaseLink", e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor="condition"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Condition
        </label>
        <select
          id="condition"
          value={values.condition}
          onChange={(e) => setField("condition", e.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {conditions.map((condition) => (
            <option key={condition.code} value={condition.code}>
              {condition.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="disposition"
          className="mb-2 block text-sm font-medium text-brown-700"
        >
          Disposition
        </label>
        <select
          id="disposition"
          value={values.disposition}
          onChange={(e) => setField("disposition", e.target.value)}
          className={fieldClass}
        >
          <option value="">None</option>
          {dispositions.map((disposition) => (
            <option key={disposition.code} value={disposition.code}>
              {disposition.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-brown-500">
          Sell or Discard archives the item from the default list.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="mb-2 block text-sm font-medium text-brown-700">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => setField("notes", e.target.value)}
          className={fieldClass}
        />
      </div>

      {error ? (
        <p className="sm:col-span-2 text-sm text-peach-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy || photoBusy || (requireNewPhoto && !hasPhoto)}
          className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
