import { NextResponse } from "next/server";
import { readJsonObject, toOrderErrorResponse } from "@/lib/order/errors";
import {
  attachCheckoutSession,
  createPublicOrder,
} from "@/lib/order/intakeService";
import {
  bookingReturnUrls,
  parsePublicOrderInput,
} from "@/lib/order/publicOrder";
import {
  assertCheckoutConfigured,
  createOrderCheckoutSession,
} from "@/lib/payment/stripeCheckout";
import {
  corsPreflight,
  findPublicOrganizationId,
  marketingSiteNotConfigured,
  marketingSiteOrigin,
  publicOrganizationNotFound,
  withCors,
} from "@/lib/public/publicApi";

export const runtime = "nodejs";

const METHODS = "POST";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

/**
 * POST /api/public/{organizationId}/orders
 * Unauthenticated at-home experience booking from the customer site. The body
 * carries facts only (contact, venue, event times, pickup choice, details,
 * optional client tables, photo URLs). The server builds setup/pickup windows,
 * calculates the quote, creates a PAYMENT_PENDING order with the package items,
 * and opens Stripe Checkout for that amount.
 * Returns { order: { id, status, quote }, checkoutUrl }.
 * The caller must know the organization id.
 */
export async function POST(request: Request, context: RouteContext) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) {
    return withCors(request, parsed.response, METHODS);
  }

  try {
    const { organizationId } = await context.params;
    const resolvedId = await findPublicOrganizationId(organizationId);
    if (!resolvedId) {
      return withCors(request, publicOrganizationNotFound(), METHODS);
    }
    const siteOrigin = marketingSiteOrigin(request);
    if (!siteOrigin) {
      return withCors(request, marketingSiteNotConfigured(), METHODS);
    }

    const input = parsePublicOrderInput(parsed.value);
    assertCheckoutConfigured();
    const order = await createPublicOrder(resolvedId, input);
    const session = await createOrderCheckoutSession({
      orderId: order.id,
      amountCents: order.quote,
      productName: `${order.packageName} · ${input.experienceLabel}`,
      customerEmail: input.contact.email,
      ...bookingReturnUrls(siteOrigin, order.id, order.packageSlug),
    });
    await attachCheckoutSession(resolvedId, order.id, session.id);

    return withCors(
      request,
      NextResponse.json(
        {
          order: { id: order.id, status: order.status, quote: order.quote },
          checkoutUrl: session.url,
        },
        { status: 201 },
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
