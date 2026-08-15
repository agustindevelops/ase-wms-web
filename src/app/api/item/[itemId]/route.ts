import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireItemWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  parseCatalogUpdateInput,
  updateInventoryItem,
  withItemReadUrls,
} from "@/lib/item/catalogService";
import { readJsonObject, toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

/**
 * GET /api/item/{itemId}
 */
export async function GET(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const auth = await requireItemWarehouseAdmin(request, itemId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const item = await withItemReadUrls(auth.item, {
      organizationId: auth.organizationId,
      warehouseId: auth.warehouseId ?? undefined,
    });
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}

/**
 * PATCH /api/item/{itemId}
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const auth = await requireItemWarehouseAdmin(request, itemId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCatalogUpdateInput(parsed.value);
    const item = await withItemReadUrls(
      await updateInventoryItem(auth.organizationId, auth.item.id, input),
      {
        organizationId: auth.organizationId,
        warehouseId: auth.warehouseId ?? undefined,
      },
    );
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
