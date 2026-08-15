import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import { ITEM_CONDITIONS } from "@/lib/db/defaults";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/** GET /api/lookup/item-conditions */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    return NextResponse.json({
      conditions: ITEM_CONDITIONS.map((condition) => ({
        code: condition.code,
        name: condition.name,
      })),
    });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
