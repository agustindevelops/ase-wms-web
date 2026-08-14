import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  deleteOrderLine,
  parseOrderLineUpdate,
  updateOrderLine,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string; lineId: string }>;
};

/**
 * PATCH /api/order/{orderId}/line/{lineId}
 * Admin override: update qtyRequested, qtyPicked, and/or qtyReturned.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const { orderId, lineId } = await context.params;
    const input = parseOrderLineUpdate(parsed.value);
    const order = await updateOrderLine(orderId, lineId, input);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * DELETE /api/order/{orderId}/line/{lineId}
 * Remove a line. Restores available qty still outstanding on the line.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId, lineId } = await context.params;
    const order = await deleteOrderLine(orderId, lineId);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
