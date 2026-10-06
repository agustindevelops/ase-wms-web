import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toCatalogErrorResponse } from "@/lib/item/errors";
import { searchItems } from "@/lib/item/itemSearch";

export const runtime = "nodejs";

/**
 * GET /api/item/search?q=&limit=
 * Fuzzy, typo-tolerant search over active (non-archived) catalog items for
 * pickers. Returns id, name, categoryName, and summed owned/available stock.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 8);
    const items = await searchItems(
      auth.organizationId,
      params.get("q") ?? "",
      Number.isFinite(limit) ? limit : 8,
    );
    return NextResponse.json({ items });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
