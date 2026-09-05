import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toOrderErrorResponse } from "@/lib/order/errors";
import { listReturnOrders } from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

/**
 * GET /api/order/return
 * Orders scheduled for today (America/Chicago), with lines and return status.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const orders = await listReturnOrders(auth.organizationId);
    return NextResponse.json({ orders });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
