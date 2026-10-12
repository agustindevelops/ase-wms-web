/** Where Stripe Checkout sends the customer back on the marketing site. */
export function bookingReturnUrls(
  siteOrigin: string,
  orderId: string,
  packageSlug: string,
) {
  return {
    // Stripe fills in {CHECKOUT_SESSION_ID}; it must stay unencoded.
    successUrl: `${siteOrigin}/intimate-celebrations/booked?order=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${siteOrigin}/intimate-celebrations/${encodeURIComponent(packageSlug)}`,
  };
}
