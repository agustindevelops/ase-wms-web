import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  listInventoryItems,
  listInventoryLocationPaths,
  listWarehouses,
  parseInventoryListFilters,
  withItemsReadUrls,
} from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/inventory
 * Admin list of items across all warehouses.
 * Optional: warehouseId, location=none|set|all, q, categoryId, locationUnitId,
 * archived=0|1|all (default 0).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const filters = parseInventoryListFilters(new URL(request.url).searchParams);
    const [rawItems, locations, warehouses] = await Promise.all([
      listInventoryItems(filters),
      listInventoryLocationPaths(filters.warehouseId),
      listWarehouses(),
    ]);
    const items = await withItemsReadUrls(rawItems);
    return NextResponse.json({ items, locations, warehouses });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
