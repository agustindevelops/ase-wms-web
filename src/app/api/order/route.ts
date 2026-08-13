import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  createOrder,
  listOrders,
  parseOrderCreateInput,
  parseStatusFilter,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

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

/**
 * POST /api/order
 * Create an event order with name, optional eventDate, status PAYMENT_PENDING.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const input = parseOrderCreateInput(parsed.value);
    const order = await createOrder(input, auth.user.id);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
