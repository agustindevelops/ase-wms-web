import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
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
    const orders = await listOrders(auth.organizationId, statusCodes);
    return NextResponse.json({ orders });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * POST /api/order
 * Create an event order with name, optional eventDate, status PAID.
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
    const order = await createOrder(input, auth.user.id, auth.organizationId);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_CREATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Created order "${order.name}"`,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
