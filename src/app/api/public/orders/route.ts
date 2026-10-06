import { NextResponse } from "next/server";
import {
  createPublicOrder,
  parsePublicOrderInput,
} from "@/lib/order/intakeService";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  corsPreflight,
  getPublicOrganizationId,
  publicOrganizationMissing,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";

const METHODS = "POST";

/**
 * POST /api/public/orders
 * Unauthenticated intake from the customer site. Creates a PAYMENT_PENDING order
 * with contact, venue address, details, optional client tables, upload links,
 * and the package items copied onto the order. Returns { order: { id, status, quote } };
 * pass order.id as Stripe Checkout metadata.orderId.
 */
export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return withCors(request, parsed.response, METHODS);
  }

  try {
    const organizationId = await getPublicOrganizationId();
    if (!organizationId) {
      return withCors(request, publicOrganizationMissing(), METHODS);
    }
    const input = parsePublicOrderInput(parsed.value);
    const order = await createPublicOrder(organizationId, input);
    return withCors(
      request,
      NextResponse.json({ order }, { status: 201 }),
      METHODS,
    );
  } catch (error) {
    return withCors(request, toOrderErrorResponse(error), METHODS);
  }
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, METHODS);
}
