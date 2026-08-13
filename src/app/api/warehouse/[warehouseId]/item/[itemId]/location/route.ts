import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { unbindItemFromLocation } from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * DELETE /api/warehouse/{warehouseId}/item/{itemId}/location
 * Clears Item.locationUnitId only. Does not delete the item or its QR.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ warehouseId: string; itemId: string }> },
) {
  const { warehouseId, itemId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!itemId) {
    return NextResponse.json(
      { error: "Bad Request", message: "itemId is required" },
      { status: 400 },
    );
  }

  try {
    const item = await unbindItemFromLocation(auth.warehouseId, itemId);
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
