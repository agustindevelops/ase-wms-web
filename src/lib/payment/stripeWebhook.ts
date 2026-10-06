import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Verify a `Stripe-Signature` header against the raw request body
 * (HMAC-SHA256 of `${t}.${body}` with the endpoint secret, 5 minute tolerance).
 * Returns the parsed event, or null when the signature is missing or invalid.
 */
export function verifyStripeEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): StripeEvent | null {
  if (!signatureHeader) {
    return null;
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      timestamp = Number(value);
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }
  if (
    timestamp === null ||
    !Number.isFinite(timestamp) ||
    signatures.length === 0 ||
    Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS
  ) {
    return null;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  const matches = signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return (
      candidate.length === expected.length && timingSafeEqual(candidate, expected)
    );
  });
  if (!matches) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}
