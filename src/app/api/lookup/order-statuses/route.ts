import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { listOrderStatuses } from "@/lib/order/orderService";
import { toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

/**
 * GET /api/lookup/order-statuses
 * Seeded ORDER_STATUS list for the orders list filter.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const statuses = await listOrderStatuses();
    return NextResponse.json({ statuses });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
