"use client";

import type { CategoryOption, LookupOption } from "@/app/admin/inventory/inventoryTypes";
import { useAuthContext } from "@/context/AuthContext";
import { wisJson } from "@/lib/api/wisFetch";
import { useQuery, type QueryClient } from "@tanstack/react-query";

export type OrderStatusOption = { id: string; code: string; name: string };

export const lookupKeys = {
  all: ["lookup"] as const,
  itemCategories: ["lookup", "item-categories"] as const,
  materials: ["lookup", "materials"] as const,
  itemConditions: ["lookup", "item-conditions"] as const,
  itemDispositions: ["lookup", "item-dispositions"] as const,
  orderStatuses: ["lookup", "order-statuses"] as const,
};

const cachedLookup = {
  staleTime: Infinity,
  gcTime: Infinity,
} as const;

export async function fetchItemCategories() {
  const json = await wisJson<{ categories: CategoryOption[] }>(
    "/api/lookup/item-categories",
  );
  return json.categories;
}

export async function fetchMaterials() {
  const json = await wisJson<{ materials: LookupOption[] }>(
    "/api/lookup/materials",
  );
  return json.materials;
}

export async function fetchItemConditions() {
  const json = await wisJson<{ conditions: LookupOption[] }>(
    "/api/lookup/item-conditions",
  );
  return json.conditions;
}

export async function fetchItemDispositions() {
  const json = await wisJson<{ dispositions: LookupOption[] }>(
    "/api/lookup/item-dispositions",
  );
  return json.dispositions;
}

export async function fetchOrderStatuses() {
  const json = await wisJson<{ statuses: OrderStatusOption[] }>(
    "/api/lookup/order-statuses",
  );
  return json.statuses;
}

function useAuthedLookup<T>(
  queryKey: readonly string[],
  queryFn: () => Promise<T>,
) {
  const { user } = useAuthContext();
  return useQuery({
    queryKey,
    queryFn,
    enabled: Boolean(user),
    ...cachedLookup,
  });
}

export function useItemCategories() {
  return useAuthedLookup(lookupKeys.itemCategories, fetchItemCategories);
}

export function useMaterials() {
  return useAuthedLookup(lookupKeys.materials, fetchMaterials);
}

export function useItemConditions() {
  return useAuthedLookup(lookupKeys.itemConditions, fetchItemConditions);
}

export function useItemDispositions() {
  return useAuthedLookup(lookupKeys.itemDispositions, fetchItemDispositions);
}

export function useOrderStatuses() {
  return useAuthedLookup(lookupKeys.orderStatuses, fetchOrderStatuses);
}

export function useInventoryLookups() {
  const categories = useItemCategories();
  const materials = useMaterials();
  const conditions = useItemConditions();
  const dispositions = useItemDispositions();
  const firstError =
    categories.error ?? materials.error ?? conditions.error ?? dispositions.error;

  return {
    categories: categories.data ?? [],
    materials: materials.data ?? [],
    conditions: conditions.data ?? [],
    dispositions: dispositions.data ?? [],
    isLoading:
      categories.isLoading ||
      materials.isLoading ||
      conditions.isLoading ||
      dispositions.isLoading,
    error:
      firstError instanceof Error
        ? firstError.message
        : firstError
          ? "Failed to load lookups"
          : null,
  };
}

export function prefetchLookups(queryClient: QueryClient) {
  void queryClient.prefetchQuery({
    queryKey: lookupKeys.itemCategories,
    queryFn: fetchItemCategories,
    ...cachedLookup,
  });
  void queryClient.prefetchQuery({
    queryKey: lookupKeys.materials,
    queryFn: fetchMaterials,
    ...cachedLookup,
  });
  void queryClient.prefetchQuery({
    queryKey: lookupKeys.itemConditions,
    queryFn: fetchItemConditions,
    ...cachedLookup,
  });
  void queryClient.prefetchQuery({
    queryKey: lookupKeys.itemDispositions,
    queryFn: fetchItemDispositions,
    ...cachedLookup,
  });
  void queryClient.prefetchQuery({
    queryKey: lookupKeys.orderStatuses,
    queryFn: fetchOrderStatuses,
    ...cachedLookup,
  });
}
