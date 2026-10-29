import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import {
  deleteOrder,
  getOrder,
  parseOrderUpdateInput,
  updateOrder,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * GET /api/order/{orderId}
 * Order detail with lines and pick/return progress.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const order = await getOrder(auth.organizationId, orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * PATCH /api/order/{orderId}
 * Update name, eventDate, and/or statusId.
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
    const { orderId } = await context.params;
    const input = parseOrderUpdateInput(parsed.value);
    const order = await updateOrder(auth.organizationId, orderId, input);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_UPDATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Updated order "${order.name}"`,
    });
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * DELETE /api/order/{orderId}
 * Permanently delete an order and release its outstanding picked inventory.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const order = await deleteOrder(auth.organizationId, orderId);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_DELETED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Deleted order "${order.name}"`,
    });
    return NextResponse.json({ deletedOrderId: order.id });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
