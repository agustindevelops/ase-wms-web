import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  createItemQrCode,
  parseItemId,
  withItemReadUrls,
} from "@/lib/item/catalogService";
import {
  CatalogServiceError,
  readJsonObject,
  toCatalogErrorResponse,
} from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * POST /api/item/catalog/QR
 * Create a type=0 item QR and attach it to the item.
 */
export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const warehouseId =
      typeof parsed.value.warehouseId === "string"
        ? parsed.value.warehouseId.trim()
        : "";
    if (!warehouseId) {
      throw new CatalogServiceError("Bad Request", "warehouseId is required");
    }

    const itemId = parseItemId(parsed.value);
    const auth = await requireWarehouseAdmin(request, warehouseId);
    if (isAuthFailure(auth)) {
      return auth.response;
    }

    const result = await createItemQrCode(auth.warehouseId, itemId);
    return NextResponse.json(
      { ...result, item: await withItemReadUrls(result.item) },
      { status: 201 },
    );
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
