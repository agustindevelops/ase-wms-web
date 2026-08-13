import { NextResponse } from "next/server";
import { isAuthFailure } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import {
  getWarehouseItem,
  parseCatalogUpdateInput,
  updateWarehouseItem,
  withItemReadUrls,
} from "@/lib/item/catalogService";
import { readJsonObject, toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ warehouseId: string; itemId: string }>;
};

/**
 * GET /api/warehouse/{warehouseId}/item/{itemId}
 */
export async function GET(request: Request, context: RouteContext) {
  const { warehouseId, itemId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!itemId) {
    return NextResponse.json(
      { error: "Bad Request", message: "itemId is required" },
      { status: 400 },
    );
  }

  try {
    const item = await withItemReadUrls(
      await getWarehouseItem(auth.warehouseId, itemId),
    );
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}

/**
 * PATCH /api/warehouse/{warehouseId}/item/{itemId}
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { warehouseId, itemId } = await context.params;
  const auth = await requireWarehouseAdmin(request, warehouseId);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  if (!itemId) {
    return NextResponse.json(
      { error: "Bad Request", message: "itemId is required" },
      { status: 400 },
    );
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseCatalogUpdateInput(parsed.value);
    const item = await withItemReadUrls(
      await updateWarehouseItem(auth.warehouseId, itemId, input),
    );
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
