import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import { bindItemToLocationUnit, withItemReadUrls } from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * PUT /api/warehouse/{warehouseId}/location-unit/{id}/item/{itemId}
 * Bind a cataloged item to a warehouse location (via scanned location QR).
 */
export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      warehouseId: string;
      id: string;
      itemId: string;
    }>;
  },
) {
  const { warehouseId, id: locationUnitId, itemId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!locationUnitId || !itemId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "locationUnitId and itemId are required",
      },
      { status: 400 },
    );
  }

  try {
    const item = await withItemReadUrls(
      await bindItemToLocationUnit(
        auth.organizationId,
        auth.warehouseId,
        locationUnitId,
        itemId,
      ),
      { organizationId: auth.organizationId, warehouseId: auth.warehouseId },
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ITEM_LOCATION_SET,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ITEM,
      entityId: item.id,
      summary: `Set location for "${item.name}" to "${item.locationPath ?? item.locationUnit?.name ?? "location"}"`,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
