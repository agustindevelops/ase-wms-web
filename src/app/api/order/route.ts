import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { listOrders, parseStatusFilter } from "@/lib/order/orderService";
import { toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

/**
 * GET /api/order?status=CODE
 * List all orders. Optional status codes (repeatable or comma-separated).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const statusCodes = parseStatusFilter(new URL(request.url).searchParams);
    const orders = await listOrders(statusCodes);
    return NextResponse.json({ orders });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
