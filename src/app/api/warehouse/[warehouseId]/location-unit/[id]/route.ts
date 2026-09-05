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
import {
  deleteLocationUnit,
  getLocationUnitWithChildren,
  parseLocationUnitInput,
  replaceLocationUnit,
} from "@/lib/warehouse/locationUnitService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ warehouseId: string; id: string }>;
};

/**
 * GET /api/warehouse/{warehouseId}/location-unit/{id}
 * Location unit plus next-level children (parentLocationUnitId = id).
 */
export async function GET(request: Request, context: RouteContext) {
  const { warehouseId, id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "location unit id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await withWarehouseAdminRead(
      request,
      warehouseId,
      (organizationId) =>
        getLocationUnitWithChildren(organizationId, warehouseId, id),
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
 * PUT /api/warehouse/{warehouseId}/location-unit/{id}
 * Replace the location unit with the same body as POST.
 */
export async function PUT(request: Request, context: RouteContext) {
  const { warehouseId, id } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "location unit id is required" },
      { status: 400 },
    );
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseLocationUnitInput(parsed.value);
    const locationUnit = await replaceLocationUnit(
      auth.organizationId,
      auth.warehouseId,
      id,
      input,
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.LOCATION_UNIT_UPDATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.LOCATION_UNIT,
      entityId: locationUnit.id,
      summary: `Updated location unit "${locationUnit.name}"`,
    });
    return NextResponse.json({ locationUnit });
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}

/**
 * DELETE /api/warehouse/{warehouseId}/location-unit/{id}
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { warehouseId, id } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!id) {
    return NextResponse.json(
      { error: "Bad Request", message: "location unit id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await deleteLocationUnit(
      auth.organizationId,
      auth.warehouseId,
      id,
    );
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.LOCATION_UNIT_DELETED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.LOCATION_UNIT,
      entityId: id,
      summary: `Deleted location unit "${result.name}"`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
