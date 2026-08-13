"use client";

import { useAuthContext } from "@/context/AuthContext";
import { wmsFetch } from "@/lib/api/wmsFetch";
import { type User } from "firebase/auth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CategoryOption, InventoryItem } from "./inventoryTypes";

type LocationFilter = "all" | "set" | "none";
type ArchivedFilter = "0" | "1" | "all";

const pill = (active: boolean) =>
  active
    ? "rounded-full bg-green-700 px-3 py-1.5 text-sm font-medium text-white"
    : "rounded-full border border-brown-300 px-3 py-1.5 text-sm font-medium text-brown-700 hover:bg-brown-100";

export default function InventoryPage() {
  const { user } = useAuthContext() as { user: User | null };
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [location, setLocation] = useState<LocationFilter>("all");
  const [archived, setArchived] = useState<ArchivedFilter>("0");
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
      const meRes = await wmsFetch("/api/me", { idToken });
      const me = await meRes.json();
      const warehouseId = me.warehouse?.id as string | undefined;
      if (!warehouseId) {
        throw new Error("No warehouse on this account");
      }

      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      }
      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (location !== "all") {
        params.set("location", location);
      }
      params.set("archived", archived);

      const [itemRes, catRes] = await Promise.all([
        wmsFetch(`/api/warehouse/${warehouseId}/item?${params}`, { idToken }),
        wmsFetch("/api/lookup/item-categories", { idToken }),
      ]);
      const itemJson = await itemRes.json();
      const catJson = await catRes.json();
      if (!itemRes.ok) {
        throw new Error(itemJson.message ?? "Could not load inventory");
      }
      if (!catRes.ok) {
        throw new Error(catJson.message ?? "Could not load categories");
      }
      setItems(itemJson.items);
      setCategories(catJson.categories);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load inventory",
      );
    } finally {
      setLoading(false);
    }
  }, [user, q, categoryId, location, archived]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-nickainley text-3xl text-brown-800">Inventory</h2>
          <p className="mt-1 text-sm text-brown-600">
            Search and complete detailed item records.
          </p>
        </div>
        <Link
          href="/admin/inventory/new"
          className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          New item
        </Link>
      </div>

      <div className="mt-6">
        <label htmlFor="q" className="sr-only">
          Search by name
        </label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          className="w-full max-w-md rounded-lg border border-brown-200 bg-white px-3 py-2 text-brown-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
        />
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
            className={pill(location === value)}
            onClick={() => setLocation(value)}
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

      {error ? (
        <p className="mt-6 text-sm text-peach-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-brown-200 bg-white/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-brown-200 text-brown-500">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Owned</th>
              <th className="px-4 py-3 font-medium">Available</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-brown-500" colSpan={6}>
                  No items match these filters.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const thumb =
                  item.files.find((file) => file.readUrl)?.readUrl ?? null;
                return (
                  <tr key={item.id} className="border-t border-brown-100">
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
                      {item.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.locationUnit?.label ||
                        item.locationUnit?.name ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.quantityOwned}
                    </td>
                    <td className="px-4 py-3 text-brown-700">
                      {item.quantityAvailable}
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
