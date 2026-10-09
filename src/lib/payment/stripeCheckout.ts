import "server-only";

import Stripe from "stripe";
import { OrderServiceError } from "@/lib/order/errors";

const INTEGRATION_IDENTIFIER = "ase_dinner_experience_qhvtrmzk";

let client: Stripe | null = null;

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
 * Hosted Checkout for one order. Amount is the server-calculated quote; the
 * webhook moves the order to PAYMENT_PROCESSED using metadata.orderId.
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
            unit_amount: input.amountCents,
            product_data: { name: input.productName },
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
