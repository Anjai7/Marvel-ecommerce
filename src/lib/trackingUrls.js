/**
 * The tracking URLs of the carriers the storefront ships with.
 *
 * Only carriers with a public, stable tracking page are listed — each entry is
 * the carrier's own official page for a number. Anything not listed returns
 * `null`, and the portal then shows the number with a note instead of
 * inventing a link: a made-up URL is worse than none, because a customer who
 * clicks through gets a dead end or worse.
 */

const TRACKING_URLS = {
  "DHL Worldwide": (number) =>
    `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(number)}`,
  "FedEx Express": (number) =>
    `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`,
  UPS: (number) => `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(number)}`,
  USPS: (number) =>
    `https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=${encodeURIComponent(number)}`,
};

/**
 * The carrier's official tracking URL for a tracking number, or `null` when
 * the carrier has none listed or there is no number.
 */
export function carrierTrackingUrl(carrier, trackingNumber) {
  const key = typeof carrier === "string" ? carrier.trim() : "";
  const number = typeof trackingNumber === "string" ? trackingNumber.trim() : "";
  if (!key || !number) return null;
  const build = TRACKING_URLS[key];
  return build ? build(number) : null;
}
