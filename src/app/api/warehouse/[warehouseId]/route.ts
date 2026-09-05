import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import {
  requireWarehouseAdmin,
  withWarehouseAdminRead,
} from "@/lib/auth/requireWarehouseAdmin";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import {
  readJsonObject,
  toWarehouseErrorResponse,
} from "@/lib/warehouse/errors";
import { getWarehouseView } from "@/lib/warehouse/locationUnitService";
import {
  parseWarehouseInput,
  replaceWarehouse,
} from "@/lib/warehouse/warehouseService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ warehouseId: string }>;
};

/**
 * GET /api/warehouse/{warehouseId}
 * Root LOCATION_UNIT rows (parentLocationUnitId is null) plus warehouse address
 * and location unit types for create/edit forms.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { warehouseId } = await context.params;
    const result = await withWarehouseAdminRead(
      request,
      warehouseId,
      (organizationId) => getWarehouseView(organizationId, warehouseId),
    );
    if (isAuthFailure(result)) {
      return result.response;
    }
    return NextResponse.json(result.data);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}

/**
 * PUT /api/warehouse/{warehouseId}
 * Replace warehouse name. Address is replaced when provided; omitted keeps the
 * current address; null clears all address fields. Path warehouseId is the scope.
 */
export async function PUT(request: Request, context: RouteContext) {
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
    const input = parseWarehouseInput(parsed.value);
    const data = await replaceWarehouse(
      auth.organizationId,
      auth.warehouseId,
      input,
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.WAREHOUSE_UPDATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.WAREHOUSE,
      entityId: data.warehouse.id,
      summary: `Updated warehouse "${data.warehouse.name}"`,
    });
    return NextResponse.json(data);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
