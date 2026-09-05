import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
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
    const filters = parseInventoryListFilters(
      auth.organizationId,
      new URL(request.url).searchParams,
    );
    const [rawItems, locations, warehouses] = await Promise.all([
      listInventoryItems(filters),
      listInventoryLocationPaths(auth.organizationId, filters.warehouseId),
      listWarehouses(auth.organizationId),
    ]);
    const items = await withItemsReadUrls(rawItems, {
      organizationId: auth.organizationId,
      warehouseId: filters.warehouseId,
    });
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

    const item = await withItemReadUrls(
      await createCatalogItem(auth.organizationId, input),
      { organizationId: auth.organizationId, warehouseId: input.warehouseId },
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ITEM_CREATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ITEM,
      entityId: item.id,
      summary: `Created item "${item.name}"`,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
