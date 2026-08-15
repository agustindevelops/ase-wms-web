import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  getPickupOrder,
  parsePickBody,
  pickOrderLine,
} from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * GET /api/order/pickup/{orderId}
 * Pull list for one pickup-eligible order.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const order = await getPickupOrder(auth.organizationId, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * POST /api/order/pickup/{orderId}
 * Record a pick: increment qtyPicked, decrement quantityAvailable.
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
    const input = parsePickBody(parsed.value);
    const order = await pickOrderLine(
      auth.organizationId,
      orderId,
      input.itemId,
      input.qty,
      input.warehouseId,
    );
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
