import { NextResponse } from "next/server";
import { isAuthFailure, requirePrismaUser } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { ITEM_CONDITIONS } from "@/lib/db/defaults";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/** GET /api/lookup/item-conditions */
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
