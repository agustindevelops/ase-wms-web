import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import {
  requireWarehouseAdmin,
  withWarehouseAdminRead,
} from "@/lib/auth/requireWarehouseAdmin";
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
    const result = await withWarehouseAdminRead(request, warehouseId, () =>
      getLocationUnitWithChildren(warehouseId, id),
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
      auth.warehouseId,
      id,
      input,
    );
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
    const result = await deleteLocationUnit(auth.warehouseId, id);
    return NextResponse.json(result);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
