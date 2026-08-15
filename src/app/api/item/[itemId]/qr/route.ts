import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireItemWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
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
    return NextResponse.json(result);
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
