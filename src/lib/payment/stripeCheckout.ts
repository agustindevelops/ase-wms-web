import "server-only";

import Stripe from "stripe";
import { OrderServiceError } from "@/lib/order/errors";

const INTEGRATION_IDENTIFIER = "ase_dinner_experience_qhvtrmzk";
/** Stripe rejects USD charges under $0.50. */
const STRIPE_MIN_CHARGE_CENTS = 50;

let client: Stripe | null = null;

function testPaymentsEnabled(): boolean {
  const value = process.env.TEST_PAYMENTS?.trim().toLowerCase();
  return value === "true" || value === "1";
}

/**
 * With TEST_PAYMENTS on, charge 1% of the quote, floored to whole cents and
 * raised to Stripe's minimum, so live payments can be tested cheaply.
 */
function chargeAmountCents(quoteCents: number): number {
  if (!testPaymentsEnabled()) return quoteCents;
  return Math.max(Math.floor(quoteCents / 100), STRIPE_MIN_CHARGE_CENTS);
}

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new OrderServiceError(
      "PAYMENTS_NOT_CONFIGURED",
      "Online payment is not configured yet",
      503,
    );
  }
  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}

/** Fail before creating an order when Checkout cannot be opened. */
export function assertCheckoutConfigured() {
  getStripeClient();
}

/**
 * Hosted Checkout for one order. Amount is the server-calculated quote (scaled
 * down when TEST_PAYMENTS is on); the webhook moves the order to
 * PAYMENT_PROCESSED using metadata.orderId.
 */
export async function createOrderCheckoutSession(input: {
  orderId: string;
  amountCents: number;
  productName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const stripe = getStripeClient();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: INTEGRATION_IDENTIFIER,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: chargeAmountCents(input.amountCents),
            product_data: {
              name: testPaymentsEnabled()
                ? `${input.productName} (test payment)`
                : input.productName,
            },
          },
        },
      ],
      customer_email: input.customerEmail,
      client_reference_id: input.orderId,
      metadata: { orderId: input.orderId },
      payment_intent_data: { metadata: { orderId: input.orderId } },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
  } catch (error) {
    console.error("[stripe] checkout session failed", input.orderId, error);
    throw new OrderServiceError(
      "CHECKOUT_ERROR",
      "Could not start checkout. Please try again.",
      502,
    );
  }
  if (!session.url) {
    throw new OrderServiceError(
      "CHECKOUT_ERROR",
      "Stripe did not return a checkout URL",
      502,
    );
  }
  return { id: session.id, url: session.url };
}

/**
 * Whether Stripe reports the Checkout Session as paid. Lets the customer's
 * booked page confirm payment when it loads before the webhook arrives.
 */
export async function isCheckoutSessionPaid(sessionId: string): Promise<boolean> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
}
