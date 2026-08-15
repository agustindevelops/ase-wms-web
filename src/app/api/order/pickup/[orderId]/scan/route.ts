import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/auth/requireAuth";
import { toOrderErrorResponse } from "@/lib/order/errors";
import { scanFulfillmentQr } from "@/lib/order/fulfillmentService";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

/**
 * GET /api/order/pickup/{orderId}/scan?payload=
 * Resolve QR type 0 to an order line on this pickup order.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) {
    return auth.response;
  }

  try {
    const { orderId } = await context.params;
    const payload =
      new URL(request.url).searchParams.get("payload")?.trim() ?? "";
    const result = await scanFulfillmentQr(
      auth.organizationId,
      orderId,
      payload,
      "pickup",
    );
    return NextResponse.json(result);
  } catch (error) {
    return toOrderErrorResponse(error);
  }
}
