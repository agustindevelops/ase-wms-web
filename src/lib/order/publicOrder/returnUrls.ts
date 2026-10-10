/** Where Stripe Checkout sends the customer back on the marketing site. */
export function bookingReturnUrls(
  siteOrigin: string,
  orderId: string,
  packageSlug: string,
) {
  return {
    successUrl: `${siteOrigin}/intimate-celebrations/booked?order=${encodeURIComponent(orderId)}`,
    cancelUrl: `${siteOrigin}/intimate-celebrations/${encodeURIComponent(packageSlug)}`,
  };
}
