import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import {
  readJsonObject,
  toWarehouseErrorResponse,
} from "@/lib/warehouse/errors";
import {
  createLocationQrCode,
  parseCreateLocationQrInput,
} from "@/lib/warehouse/qrCodeService";

export const runtime = "nodejs";

/**
 * POST /api/warehouse/{warehouseId}/QR
 * Create a location QR (type code 1) and attach it to locationUnitId.
 * Omit payload to generate a printable code (payload = id). Pass payload to
 * bind a scanned label, rejected when that id/payload is already in use.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ warehouseId: string }> },
) {
  const { warehouseId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCreateLocationQrInput(parsed.value);
    const result = await createLocationQrCode(
      auth.organizationId,
      auth.warehouseId,
      input,
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.LOCATION_QR_ATTACHED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.QR_CODE,
      entityId: result.qrCode.id,
      summary: `Attached QR to location unit "${result.locationUnit.name}"`,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
