import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
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
    return NextResponse.json(result);
  } catch (error) {
    return toWarehouseErrorResponse(error);
  }
}
