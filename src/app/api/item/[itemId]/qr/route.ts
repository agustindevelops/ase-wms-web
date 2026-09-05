import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireItemWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import {
  createItemQrCode,
  deleteItemQrCode,
  withItemReadUrls,
} from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

/**
 * POST /api/item/{itemId}/qr
 * Create a type=0 item QR and attach it to the item.
 */
export async function POST(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const auth = await requireItemWarehouseAdmin(request, itemId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const result = await createItemQrCode(auth.organizationId, auth.item.id);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ITEM_QR_ATTACHED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ITEM,
      entityId: auth.item.id,
      summary: `Attached QR to item "${auth.item.name}"`,
    });
    return NextResponse.json(
      {
        ...result,
        item: await withItemReadUrls(result.item, {
          organizationId: auth.organizationId,
          warehouseId: auth.warehouseId ?? undefined,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}

/**
 * DELETE /api/item/{itemId}/qr
 * Deletes the item's type=0 QR code.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const auth = await requireItemWarehouseAdmin(request, itemId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const result = await deleteItemQrCode(auth.organizationId, auth.item.id);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ITEM_QR_REMOVED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ITEM,
      entityId: auth.item.id,
      summary: `Removed QR from item "${auth.item.name}"`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
