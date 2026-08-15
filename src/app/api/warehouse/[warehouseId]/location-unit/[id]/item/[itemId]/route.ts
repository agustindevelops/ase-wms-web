import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
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
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
