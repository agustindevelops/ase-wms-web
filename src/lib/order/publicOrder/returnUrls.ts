/** Where Stripe Checkout sends the customer back on the marketing site. */
export function bookingReturnUrls(
  siteOrigin: string,
  orderId: string,
  packageId: string,
) {
  return {
    successUrl: `${siteOrigin}/at-home-experiences/booked?order=${encodeURIComponent(orderId)}`,
    cancelUrl: `${siteOrigin}/at-home-experiences/${encodeURIComponent(packageId)}`,
  };
}
