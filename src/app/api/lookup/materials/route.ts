import { NextResponse } from "next/server";
import { isAuthFailure, requireOrgContext } from "@/lib/auth/requireAuth";
import { ITEM_MATERIALS } from "@/lib/db/defaults";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/**
 * GET /api/lookup/materials
 * Material options for the catalog details picker.
 */
export async function GET(request: Request) {
  const auth = await requireOrgContext(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    return NextResponse.json({
      materials: ITEM_MATERIALS.map((material) => ({
        code: material.code,
        name: material.name,
      })),
    });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
