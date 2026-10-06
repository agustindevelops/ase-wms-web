import { NextResponse } from "next/server";
import { markOrderPaymentProcessed } from "@/lib/order/intakeService";
import { verifyStripeEvent } from "@/lib/payment/stripeWebhook";
import { getPublicOrganizationId } from "@/lib/public/publicApi";

export const runtime = "nodejs";

const PAID_SESSION_STATUSES = ["paid", "no_payment_required"];

/**
 * POST /api/stripe/webhook
 * Server-to-server from Stripe, verified with STRIPE_WEBHOOK_SECRET.
 * checkout.session.completed (paid) and checkout.session.async_payment_succeeded
 * move metadata.orderId from PAYMENT_PENDING to PAYMENT_PROCESSED. Everything
 * else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED", message: "Webhook is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const event = verifyStripeEvent(
    rawBody,
    request.headers.get("stripe-signature"),
    secret,
  );
  if (!event) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid Stripe signature" },
      { status: 400 },
    );
  }

  const session = event.data?.object ?? {};
  const paid =
    event.type === "checkout.session.async_payment_succeeded" ||
    (event.type === "checkout.session.completed" &&
      PAID_SESSION_STATUSES.includes(String(session.payment_status)));
  if (!paid) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const orderId = typeof metadata.orderId === "string" ? metadata.orderId : "";
  const sessionId = typeof session.id === "string" ? session.id : "";
  if (!orderId || !sessionId) {
    console.warn("[stripe] checkout session without metadata.orderId", event.id);
    return NextResponse.json({ received: true, ignored: "missing orderId" });
  }

  try {
    const organizationId = await getPublicOrganizationId();
    if (!organizationId) {
      throw new Error("Public organization is not configured");
    }
    const { updated } = await markOrderPaymentProcessed(
      organizationId,
      orderId,
      sessionId,
    );
    return NextResponse.json({ received: true, updated });
  } catch (error) {
    console.error("[stripe] failed to process", event.id, error);
    return NextResponse.json(
      { error: "WEBHOOK_ERROR", message: "Could not process event" },
      { status: 500 },
    );
  }
}
