import { NextResponse } from "next/server";
import { isAuthFailure, requirePrismaUser } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { listItemCategories } from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/lookup/item-categories
 * Seeded ITEM_CATEGORY list for the catalog picker.
 */
export async function GET(request: Request) {
  const auth = await requirePrismaUser(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const warehouseAuth = await requireWarehouseAdmin(
    request,
    auth.warehouse.id,
  );
  if (isAuthFailure(warehouseAuth)) {
    return warehouseAuth.response;
  }

  try {
    const categories = await listItemCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
