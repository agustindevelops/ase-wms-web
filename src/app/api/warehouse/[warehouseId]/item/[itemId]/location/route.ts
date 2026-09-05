import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import { unbindItemFromLocation, withItemReadUrls } from "@/lib/item/catalogService";
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
    const item = await withItemReadUrls(
      await unbindItemFromLocation(
        auth.organizationId,
        auth.warehouseId,
        itemId,
      ),
      { organizationId: auth.organizationId, warehouseId: auth.warehouseId },
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ITEM_LOCATION_CLEARED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ITEM,
      entityId: item.id,
      summary: `Cleared location for item "${item.name}"`,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
