import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { withWarehouseAdminRead } from "@/lib/auth/requireWarehouseAdmin";
import {
  listWarehouseItems,
  parseWarehouseItemLocationFilter,
} from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/warehouse/{warehouseId}/item?location=none|set
 * List catalog items with or without a location attachment.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ warehouseId: string }> },
) {
  try {
    const { warehouseId } = await context.params;
    const location = parseWarehouseItemLocationFilter(
      new URL(request.url).searchParams.get("location"),
    );

    const result = await withWarehouseAdminRead(request, warehouseId, () =>
      listWarehouseItems(warehouseId, location),
    );
    if (isAuthFailure(result)) {
      return result.response;
    }

    return NextResponse.json({ items: result.data });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
