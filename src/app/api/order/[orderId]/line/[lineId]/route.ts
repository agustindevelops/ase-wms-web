import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import {
  deleteOrderItem,
  getOrder,
  parseOrderItemUpdate,
  updateOrderItem,
} from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string; lineId: string }>;
};

/**
 * PATCH /api/order/{orderId}/line/{lineId}
 * Update qtyRequested on an order item.
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
    const input = parseOrderItemUpdate(parsed.value);
    const order = await updateOrderItem(
      auth.organizationId,
      orderId,
      lineId,
      input,
    );
    const itemName =
      order.items.find((row) => row.id === lineId)?.item.name ?? "item";
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_LINE_UPDATED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Updated "${itemName}" on order "${order.name}" to qty ${input.qtyRequested}`,
    });
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}

/**
 * DELETE /api/order/{orderId}/line/{lineId}
 * Remove an order item. Restores available qty still outstanding on it.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId, lineId } = await context.params;
    const before = await getOrder(auth.organizationId, orderId);
    const itemName =
      before.items.find((row) => row.id === lineId)?.item.name ?? "item";
    const order = await deleteOrderItem(auth.organizationId, orderId, lineId);
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_LINE_REMOVED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Removed "${itemName}" from order "${before.name}"`,
    });
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
