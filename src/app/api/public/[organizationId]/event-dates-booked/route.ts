import { NextResponse } from "next/server";
import { toOrderErrorResponse } from "@/lib/order/errors";
import {
  getEventDatesBooked,
  parseBookingMonth,
} from "@/lib/order/eventDatesBooked";
import {
  corsPreflight,
  findPublicOrganizationId,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = "GET";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

/**
 * GET /api/public/{organizationId}/event-dates-booked?month=YYYY-MM
 * Unauthenticated read for the customer-site calendar. `month` defaults to the
 * current month in America/Chicago. Returns { earliestBookableDate, bookedDates }:
 * earliestBookableDate is the first day a guest may book (today + lead time),
 * independent of `month`; bookedDates are YYYY-MM-DD days in `month` that
 * already have a paid or later event. Not cached.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }
    const month = parseBookingMonth(
      new URL(request.url).searchParams.get("month"),
    );
    const result = await getEventDatesBooked(resolvedId, month);
    return withCors(request, NextResponse.json(result), METHODS);
  } catch (error) {
    return withCors(request, toOrderErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
