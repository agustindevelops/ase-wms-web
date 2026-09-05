import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import { resolveWarehouseQr } from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";
import { toWarehouseErrorResponse } from "@/lib/warehouse/errors";
import { deleteWarehouseQrCode } from "@/lib/warehouse/qrCodeService";

export const runtime = "nodejs";

/**
 * GET /api/warehouse/{warehouseId}/QR/{id}
 * Resolve a QR by id or payload. Returns typeCode + linked locationUnit/item.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ warehouseId: string; id: string }> },
) {
  const { warehouseId, id } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "QR id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveWarehouseQr(
      auth.organizationId,
      auth.warehouseId,
      id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}

/**
 * DELETE /api/warehouse/{warehouseId}/QR/{id}
 * Deletes a QR only if it belongs to a LOCATION_UNIT in this warehouse.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ warehouseId: string; id: string }> },
) {
  const { warehouseId, id } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "QR id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await deleteWarehouseQrCode(
      auth.organizationId,
      auth.warehouseId,
      id,
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.LOCATION_QR_REMOVED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.QR_CODE,
      entityId: id,
      summary: `Removed QR from location "${result.locationName}"`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
