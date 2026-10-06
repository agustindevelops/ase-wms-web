import { NextResponse } from "next/server";
import { recordUserActivity } from "@/lib/activity/activityService";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import {
  USER_ACTIVITY_ACTIONS,
  USER_ACTIVITY_ENTITY_TYPES,
} from "@/lib/db/defaults";
import { getOrder } from "@/lib/order/orderService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  getReturnOrder,
  parseIssueBody,
  reportReturnIssue,
} from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * POST /api/order/{orderId}/issue
 * Admin override: record MISSING/BROKEN regardless of order status.
 * Decrements owned qty only; never restores available.
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
    const input = parseIssueBody(parsed.value);
    await reportReturnIssue(auth.organizationId, orderId, auth.user.id, input, {
      requireEligible: false,
    });
    const [order, fulfillment] = await Promise.all([
      getOrder(auth.organizationId, orderId),
      getReturnOrder(auth.organizationId, orderId),
    ]);
    const itemName =
      order.items.find((row) => row.itemId === input.itemId)?.item.name ??
      "item";
    await recordUserActivity({
      organizationId: auth.organizationId,
      actorUserId: auth.user.id,
      action: USER_ACTIVITY_ACTIONS.ISSUE_REPORTED,
      entityType: USER_ACTIVITY_ENTITY_TYPES.ISSUE,
      entityId: orderId,
      summary: `Reported ${input.type} on "${itemName}" for order "${order.name}" (qty ${input.quantity})`,
    });
    // Warehouse app reads fulfillment `lines` from this response; admin reads `items`.
    return NextResponse.json(
      { order: { ...order, lines: fulfillment.lines } },
      { status: 201 },
    );
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
