import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import { ITEM_DISPOSITIONS } from "@/lib/db/defaults";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/** GET /api/lookup/item-dispositions */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    return NextResponse.json({
      dispositions: ITEM_DISPOSITIONS.map((disposition) => ({
        code: disposition.code,
        name: disposition.name,
      })),
    });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
