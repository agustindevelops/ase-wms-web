import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import { listItemCategories } from "@/lib/item/catalogService";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/lookup/item-categories
 * Seeded ITEM_CATEGORY list for the catalog picker.
 */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const categories = await listItemCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
