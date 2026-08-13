import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  addOrUpdateOrderLine,
  parseOrderLineCreateInput,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * POST /api/order/{orderId}/line
 * Create or update an order line (itemId + qtyRequested).
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
    const input = parseOrderLineCreateInput(parsed.value);
    const order = await addOrUpdateOrderLine(orderId, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
