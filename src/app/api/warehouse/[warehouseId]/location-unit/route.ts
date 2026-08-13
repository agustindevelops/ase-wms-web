import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  readJsonObject,
  toWarehouseErrorResponse,
} from "@/lib/warehouse/errors";
import {
  createLocationUnit,
  parseLocationUnitInput,
} from "@/lib/warehouse/locationUnitService";

export const runtime = "nodejs";

/**
 * POST /api/warehouse/{warehouseId}/location-unit
 * Create a location unit. parentLocationUnitId is optional (null = top level).
 * Type is assigned by the server from the parent. QR is attached in POST /QR.
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
    const input = parseLocationUnitInput(parsed.value);
    const locationUnit = await createLocationUnit(auth.warehouseId, input);
    return NextResponse.json({ locationUnit }, { status: 201 });
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
