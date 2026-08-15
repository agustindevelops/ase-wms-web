import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toOrderErrorResponse } from "@/lib/order/errors";
import { scanFulfillmentQr } from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * GET /api/order/return/{orderId}/scan?payload=
 * Type 0 → order line; type 1 → put-away location.
 * Pass itemId when scanning a location so the home location is checked.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const search = new URL(request.url).searchParams;
    const payload = search.get("payload")?.trim() ?? "";
    const itemId = search.get("itemId")?.trim() || undefined;
    const result = await scanFulfillmentQr(
      auth.organizationId,
      orderId,
      payload,
      "return",
      itemId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
