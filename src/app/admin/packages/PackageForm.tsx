"use client";

import ItemSearch, { type ItemOption } from "@/components/ItemSearch";
import MarkdownEditor from "@/components/MarkdownEditor";
import {
  isReservedSlug,
  isValidSlug,
  PACKAGE_SLUG_MAX_LENGTH,
  slugify,
} from "@/lib/package/slug";
import { FormEvent, useState } from "react";
import { fieldClass } from "../inventory/inventoryTypes";
import PackageMediaList, {
  initialMediaLines,
  type MediaLine,
} from "./PackageMediaList";
import {
  centsToInput,
  inputToCents,
  PACKAGE_SUMMARY_MAX_LENGTH,
  type PackageDetail,
  type PackagePayload,
} from "./packageTypes";

type ItemEntry = { itemId: string; name: string; quantity: string };

type Props = {
  initial?: PackageDetail;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: PackagePayload) => void;
};

export default function PackageForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // New packages follow the name until the slug is edited; existing URLs never change on their own.
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    centsToInput(initial?.basePriceCents ?? 0),
  );
  const [items, setItems] = useState<ItemEntry[]>(
    (initial?.items ?? []).map((row) => ({
      itemId: row.itemId,
      name: row.name,
      quantity: String(row.quantity),
    })),
  );
  const [media, setMedia] = useState<MediaLine[]>(() =>
    initialMediaLines(initial?.media),
  );
  const [pickItem, setPickItem] = useState<ItemOption | null>(null);
  const [pickQty, setPickQty] = useState("1");
  const [localError, setLocalError] = useState<string | null>(null);

  const addItem = () => {
    const item = pickItem;
    const qty = Number(pickQty);
    if (!item) return;
    if (!Number.isInteger(qty) || qty <= 0) {
      setLocalError("Item quantity must be a whole number greater than 0");
      return;
    }
    setLocalError(null);
    setItems((current) => [
      ...current,
      { itemId: item.id, name: item.name, quantity: String(qty) },
    ]);
    setPickItem(null);
    setPickQty("1");
  };

  const uploading = media.some((line) => line.status === "uploading");
  const summaryLength = summary.trim().length;
  const summaryTooLong = summaryLength > PACKAGE_SUMMARY_MAX_LENGTH;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (uploading) {
      setLocalError("Wait for uploads to finish before saving");
      return;
    }
    if (media.some((line) => line.status === "error")) {
      setLocalError("Retry or remove failed uploads before saving");
      return;
    }
    const basePriceCents = inputToCents(basePrice) ?? 0;
    if (Number.isNaN(basePriceCents)) {
      setLocalError("Base price must be a dollar amount like 250 or 250.00");
      return;
    }
    const parsedItems = items.map((row) => ({
      itemId: row.itemId,
      quantity: Number(row.quantity),
    }));
    if (parsedItems.some((row) => !Number.isInteger(row.quantity) || row.quantity <= 0)) {
      setLocalError("Item quantities must be whole numbers greater than 0");
      return;
    }
    if (summaryTooLong) {
      setLocalError(
        `Summary must be ${PACKAGE_SUMMARY_MAX_LENGTH} characters or fewer, including formatting`,
      );
      return;
    }
    if (!isValidSlug(slug)) {
      setLocalError(
        "URL slug must be lowercase letters and numbers separated by hyphens, like fantasy-forest",
      );
      return;
    }
    if (isReservedSlug(slug)) {
      setLocalError(`"${slug}" is already used by a page on the website. Choose another URL slug.`);
      return;
    }
    setLocalError(null);
    onSubmit({
      name,
      slug,
      summary: summary.trim() || null,
      description: description.trim() ? description : null,
      basePriceCents,
      items: parsedItems,
      media: media.flatMap((line) => (line.fileId ? [{ fileId: line.fileId }] : [])),
    });
  };

  const shownError = localError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid gap-6 rounded-2xl border border-brown-200 bg-white/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-brown-700">
            Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="slug" className="mb-2 block text-sm font-medium text-brown-700">
            URL slug
          </label>
          <input
            id="slug"
            required
            maxLength={PACKAGE_SLUG_MAX_LENGTH}
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
            onBlur={() => setSlug((current) => slugify(current))}
            placeholder="fantasy-forest"
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-brown-500">
            Customer site page: /intimate-celebrations/{slug || "…"}
            {initial && slug !== initial.slug
              ? ". Changing it breaks links already shared."
              : ""}
          </p>
        </div>
        <div>
          <label
            htmlFor="basePrice"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Base price (USD)
          </label>
          <input
            id="basePrice"
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="0.00"
            className={fieldClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="summary"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Summary
          </label>
          <MarkdownEditor
            id="summary"
            ariaLabel="Summary"
            value={summary}
            onChange={setSummary}
            placeholder="A candlelit dinner for up to eight, styled and set up in your home."
          />
          <p className="mt-1 text-xs text-brown-500">
            Shown on the package card. Formatting is saved as markdown and counts
            toward the limit.{" "}
            <span
              className={summaryTooLong ? "font-medium text-peach-700" : undefined}
              role={summaryTooLong ? "alert" : undefined}
            >
              {summaryLength}/{PACKAGE_SUMMARY_MAX_LENGTH}
            </span>
          </p>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="description"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Description
          </label>
          <MarkdownEditor
            id="description"
            value={description}
            onChange={setDescription}
            placeholder="What's included, the vibe, setup notes…"
          />
          <p className="mt-1 text-xs text-brown-500">
            Formatting is saved as markdown and shown the same way on the customer site.
          </p>
        </div>
      </div>

      <PackageMediaList lines={media} setLines={setMedia} disabled={busy} />

      <div>
        <p className="mb-2 text-sm font-medium text-brown-700">Items included</p>
        {items.length === 0 ? (
          <p className="text-sm text-brown-500">No items yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row, index) => (
              <li
                key={row.itemId}
                className="flex items-center gap-3 rounded-lg border border-brown-100 bg-white px-3 py-2"
              >
                <span className="flex-1 text-sm text-brown-800">{row.name}</span>
                <input
                  aria-label={`Quantity for ${row.name}`}
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, quantity: e.target.value } : entry,
                      ),
                    )
                  }
                  className="w-20 rounded-lg border border-brown-200 bg-white px-2 py-1 text-brown-800"
                />
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-sm font-medium text-peach-700 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label
              htmlFor="pickItem"
              className="mb-1 block text-xs font-medium text-brown-600"
            >
              Catalog item
            </label>
            <ItemSearch
              id="pickItem"
              value={pickItem}
              onChange={setPickItem}
              excludeIds={items.map((row) => row.itemId)}
              onConfirm={addItem}
            />
          </div>
          <div className="w-24">
            <label
              htmlFor="pickQty"
              className="mb-1 block text-xs font-medium text-brown-600"
            >
              Qty
            </label>
            <input
              id="pickQty"
              type="number"
              min={1}
              step={1}
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              className={fieldClass}
            />
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={!pickItem}
            className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Add item
          </button>
        </div>
      </div>

      {shownError ? (
        <p className="text-sm text-peach-700" role="alert">
          {shownError}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={busy || uploading}
          className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : uploading ? "Uploading media…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
