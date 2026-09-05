import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
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
    const itemName =
      order.lines.find((line) => line.itemId === input.itemId)?.item.name ??
      "item";
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ORDER_PICKED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.EVENT_ORDER,
      entityId: order.id,
      summary: `Picked ${input.qty} of "${itemName}" for order "${order.name}"`,
    });
    return NextResponse.json({ order });
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
