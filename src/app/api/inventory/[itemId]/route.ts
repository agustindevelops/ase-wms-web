import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  getInventoryItem,
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
 * GET /api/inventory/{itemId}
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const { itemId } = await context.params;
  if (!itemId) {
    return NextResponse.json(
      { error: "Bad Request", message: "itemId is required" },
      { status: 400 },
    );
  }

  try {
    const item = await withItemReadUrls(await getInventoryItem(itemId));
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}

/**
 * PATCH /api/inventory/{itemId}
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const { itemId } = await context.params;
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
      await updateInventoryItem(itemId, input),
    );
    return NextResponse.json({ item });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
