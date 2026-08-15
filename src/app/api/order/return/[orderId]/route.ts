import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  getReturnOrder,
  parseReturnBody,
  returnOrderLine,
} from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * GET /api/order/return/{orderId}
 * Return list for one teardown order.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const order = await getReturnOrder(auth.organizationId, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * POST /api/order/return/{orderId}
 * Record a return: increment qtyReturned, restore available.
 * Location QR must match the item's cataloged home location when one is set.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const { orderId } = await context.params;
    const input = parseReturnBody(parsed.value);
    const order = await returnOrderLine(
      auth.organizationId,
      orderId,
      input.itemId,
      input.qty,
      input.locationUnitId,
    );
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
