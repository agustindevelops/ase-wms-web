import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  deleteOrderLine,
  parseOrderLineQtyUpdate,
  updateOrderLineQty,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string; lineId: string }>;
};

/**
 * PATCH /api/order/{orderId}/line/{lineId}
 * Update qtyRequested.
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
    const qtyRequested = parseOrderLineQtyUpdate(parsed.value);
    const order = await updateOrderLineQty(orderId, lineId, qtyRequested);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * DELETE /api/order/{orderId}/line/{lineId}
 * Remove a line that has not been picked.
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
