import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  createCatalogItem,
  parseCatalogCreateInput,
  withItemReadUrls,
} from "@/lib/item/catalogService";
import {
  readJsonObject,
  toCatalogErrorResponse,
} from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * POST /api/item/catalog
 * Create ITEM with verified photo(s), name, qty, optional category.
 * QR and location are attached in later journey steps.
 */
export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCatalogCreateInput(parsed.value);
    const auth = await requireWarehouseAdmin(request, input.warehouseId);
    if (isAuthFailure(auth)) {
      return auth.response;
    }

    const item = await withItemReadUrls(await createCatalogItem(input));
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
