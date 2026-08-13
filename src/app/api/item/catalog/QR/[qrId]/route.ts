import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { deleteItemQrCode } from "@/lib/item/catalogService";
import {
  CatalogServiceError,
  toCatalogErrorResponse,
} from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * DELETE /api/item/catalog/QR/{qrId}?warehouseId=
 * Deletes only item-type (0) QR codes.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ qrId: string }> },
) {
  const { qrId } = await context.params;
  const warehouseId =
    new URL(request.url).searchParams.get("warehouseId")?.trim() ?? "";

  if (!qrId) {
    return NextResponse.json(
      { error: "Bad Request", message: "qrId is required" },
      { status: 400 },
    );
  }

  try {
    if (!warehouseId) {
      throw new CatalogServiceError("Bad Request", "warehouseId is required");
    }

    const auth = await requireWarehouseAdmin(request, warehouseId);
    if (isAuthFailure(auth)) {
      return auth.response;
    }

    const result = await deleteItemQrCode(auth.warehouseId, qrId);
    return NextResponse.json(result);
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
