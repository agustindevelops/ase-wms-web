import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  createCatalogItem,
  listInventoryItems,
  listInventoryLocationPaths,
  listWarehouses,
  parseCatalogCreateInput,
  parseInventoryListFilters,
  withItemReadUrls,
  withItemsReadUrls,
} from "@/lib/item/catalogService";
import { readJsonObject, toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/item
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

/**
 * POST /api/item
 * Create ITEM with verified photo(s), name, qty, optional category.
 * QR and location are attached in later journey steps.
 */
export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCatalogCreateInput(parsed.value);
    const auth = await requireWarehouseAdmin(request, input.warehouseId);
    if (isAuthFailure(auth)) {
      return auth.response;
    }

    const item = await withItemReadUrls(await createCatalogItem(input));
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
