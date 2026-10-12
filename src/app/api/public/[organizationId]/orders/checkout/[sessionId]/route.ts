import { NextResponse } from "next/server";
import { toOrderErrorResponse } from "@/lib/order/errors";
import { getPublicBookingBySession } from "@/lib/order/intakeService";
import {
  corsPreflight,
  findPublicOrganizationId,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = "GET";
const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

type RouteContext = {
  params: Promise<{ organizationId: string; sessionId: string }>;
};

function bookingNotFound() {
  return NextResponse.json(
    { error: "Not Found", message: "Booking not found" },
    { status: 404 },
  );
}

/**
 * GET /api/public/{organizationId}/orders/checkout/{sessionId}
 * Unauthenticated booking summary for the customer site's booked page, keyed
 * by the Stripe Checkout Session id from the success redirect. Returns
 * { booking } without contact email, phone, notes, or uploads.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { organizationId, sessionId } = await context.params;
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }
    if (!CHECKOUT_SESSION_ID.test(sessionId)) {
      return withCors(request, bookingNotFound(), METHODS);
    }
    const booking = await getPublicBookingBySession(resolvedId, sessionId);
    if (!booking) {
      return withCors(request, bookingNotFound(), METHODS);
    }
    return withCors(
      request,
      NextResponse.json(
        { booking },
        { headers: { "Cache-Control": "no-store" } },
      ),
      METHODS,
    );
  } catch (error) {
    return withCors(request, toOrderErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
