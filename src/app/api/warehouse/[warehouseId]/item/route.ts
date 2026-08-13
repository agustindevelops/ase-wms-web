import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { withWarehouseAdminRead } from "@/lib/auth/requireWarehouseAdmin";
import {
  listWarehouseItems,
  parseWarehouseItemListFilters,
  withItemsReadUrls,
} from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/warehouse/{warehouseId}/item
 * Query: location=none|set|all, q, categoryId, archived=0|1|all (default 0)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ warehouseId: string }> },
) {
  try {
    const { warehouseId } = await context.params;
    const filters = parseWarehouseItemListFilters(new URL(request.url).searchParams);

    const result = await withWarehouseAdminRead(request, warehouseId, () =>
      listWarehouseItems(warehouseId, filters),
    );
    if (isAuthFailure(result)) {
      return result.response;
    }

    const items = await withItemsReadUrls(result.data);
    return NextResponse.json({ items });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
