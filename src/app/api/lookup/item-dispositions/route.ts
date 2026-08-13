import { NextResponse } from "next/server";
import { isAuthFailure, requirePrismaUser } from "@/lib/auth/requireAuth";
import { requireWarehouseAdmin } from "@/lib/auth/requireWarehouseAdmin";
import { ITEM_DISPOSITIONS } from "@/lib/db/defaults";
import { toCatalogErrorResponse } from "@/lib/item/errors";

export const runtime = "nodejs";

/** GET /api/lookup/item-dispositions */
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
      dispositions: ITEM_DISPOSITIONS.map((disposition) => ({
        code: disposition.code,
        name: disposition.name,
      })),
    });
  } catch (error) {
    return toCatalogErrorResponse(error);
  }
}
