import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toOrderErrorResponse } from "@/lib/order/errors";
import { listPickupOrders } from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

/**
 * GET /api/order/pickup
 * Pickup-eligible orders with lines and pick status. Warehouse-agnostic.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const orders = await listPickupOrders(auth.organizationId);
    return NextResponse.json({ orders });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
