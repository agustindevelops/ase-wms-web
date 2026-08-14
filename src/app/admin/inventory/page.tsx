"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch, wmsJson } from "@/lib/api/wmsFetch";
import { ARCHIVED_DISPOSITION_CODES } from "@/lib/db/defaults";
import { useItemCategories } from "@/lib/query/lookups";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { InventoryItem } from "./inventoryTypes";

type LocationFilter = "all" | "set" | "none";
type ArchivedFilter = "0" | "1" | "all";
type LocationOption = { id: string; path: string; warehouseId: string };
type WarehouseOption = { id: string; name: string };
type ArchiveChoice = (typeof ARCHIVED_DISPOSITION_CODES)[number];

const archivedCodes = new Set<string>(ARCHIVED_DISPOSITION_CODES);

const pill = (active: boolean) =>
  active
    ? "rounded-full bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
    : "rounded-full border border-brown-300 px-3 py-1.5 text-sm font-medium text-brown-700 hover:bg-brown-100";

function isArchived(item: InventoryItem) {
  return item.disposition != null && archivedCodes.has(item.disposition);
}

function locationText(item: InventoryItem) {
  return item.locationPath || item.locationUnit?.label || item.locationUnit?.name || "—";
}

export default function InventoryPage() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { data: categories = [], error: categoriesError } = useItemCategories();
  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState<LocationFilter>("all");
  const [locationUnitId, setLocationUnitId] = useState("");
  const [archived, setArchived] = useState<ArchivedFilter>("0");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inventoryQuery = useQuery({
    queryKey: [
      "inventory",
      { q, warehouseId, categoryId, location, locationUnitId, archived },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      }
      if (warehouseId) {
        params.set("warehouseId", warehouseId);
      }
      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (location !== "all") {
        params.set("location", location);
      }
      if (locationUnitId) {
        params.set("locationUnitId", locationUnitId);
      }
      params.set("archived", archived);
      return wmsJson<{
        items: InventoryItem[];
        locations?: LocationOption[];
        warehouses?: WarehouseOption[];
      }>(`/api/inventory?${params}`);
    },
    enabled: Boolean(userId),
  });

  const items = inventoryQuery.data?.items ?? [];
  const locations = inventoryQuery.data?.locations ?? [];
  const warehouses = inventoryQuery.data?.warehouses ?? [];
  const loading = inventoryQuery.isLoading;

  const patchDisposition = async (
    item: InventoryItem,
    disposition: string | null,
  ) => {
    if (!user) {
      return;
    }
    setRowBusyId(item.id);
    setError(null);
    try {
      const response = await wmsFetch(`/api/inventory/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ disposition }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message ?? "Could not update item");
      }
      setConfirmId(null);
      await inventoryQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setRowBusyId(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-nickainley text-3xl text-brown-800">Inventory</h2>
          <p className="mt-1 text-sm text-brown-600">
            Search by name or warehouse path, then complete detailed records.
          </p>
        </div>
        <Link
          href="/admin/inventory/new"
          className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          New item
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="q" className="mb-2 block text-sm font-medium text-brown-700">
            Search
          </label>
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, warehouse, or location path"
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>
        <div>
          <label
            htmlFor="warehouseId"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Warehouse
          </label>
          <select
            id="warehouseId"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setLocationUnitId("");
            }}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="locationUnitId"
            className="mb-2 block text-sm font-medium text-brown-700"
          >
            Location path
          </label>
          <select
            id="locationUnitId"
            value={locationUnitId}
            onChange={(e) => {
              setLocationUnitId(e.target.value);
              if (e.target.value) {
                setLocation("all");
              }
            }}
            className="w-full rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          >
            <option value="">All location paths</option>
            {locations.map((option) => (
              <option key={option.id} value={option.id}>
                {option.path}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={pill(!categoryId)}
          onClick={() => setCategoryId("")}
        >
          All categories
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={pill(categoryId === category.id)}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All locations"],
            ["set", "Located"],
            ["none", "Unlocated"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={pill(location === value && !locationUnitId)}
            onClick={() => {
              setLocation(value);
              setLocationUnitId("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["0", "Active"],
            ["1", "Archived"],
            ["all", "All items"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={pill(archived === value)}
            onClick={() => setArchived(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error || inventoryQuery.error || categoriesError ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {error ??
            (inventoryQuery.error instanceof Error
              ? inventoryQuery.error.message
              : categoriesError instanceof Error
                ? categoriesError.message
                : "Could not load inventory")}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brown-200 text-brown-500">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Warehouse</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location path</th>
              <th className="px-4 py-3 font-medium">Owned</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={8}>
                  No items match these filters.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const thumb =
                  item.files.find((file) => file.readUrl)?.readUrl ?? null;
                const confirming = confirmId === item.id;
                const archivedItem = isArchived(item);
                return (
                  <tr key={item.id} className="border-t border-brown-100 align-top">
                    <td className="px-4 py-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-brown-100" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventory/${item.id}`}
                        className="font-medium text-green-800 underline-offset-2 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.warehouse?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.category?.name ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-brown-700">
                      {locationText(item)}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.quantityOwned}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.quantityAvailable}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirming ? (
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-xs text-brown-600">
                            Archive {item.name}?
                          </p>
                          <div className="flex flex-wrap justify-end gap-2">
                            {ARCHIVED_DISPOSITION_CODES.map((code: ArchiveChoice) => (
                              <button
                                key={code}
                                type="button"
                                disabled={rowBusyId === item.id}
                                onClick={() => void patchDisposition(item, code)}
                                className="rounded-full bg-peach-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                              >
                                {code === "SELL" ? "Sell" : "Discard"}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={rowBusyId === item.id}
                              onClick={() => setConfirmId(null)}
                              className="rounded-full border border-brown-300 px-3 py-1 text-xs font-medium text-brown-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : archivedItem ? (
                        <button
                          type="button"
                          disabled={rowBusyId === item.id}
                          onClick={() => void patchDisposition(item, "BUSINESS")}
                          className="text-sm font-medium text-green-800 underline-offset-2 hover:underline disabled:opacity-60"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={rowBusyId === item.id}
                          onClick={() => setConfirmId(item.id)}
                          className="text-sm font-medium text-peach-700 underline-offset-2 hover:underline disabled:opacity-60"
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
