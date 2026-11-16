/**
 * The offer a product carries, in the few words a badge can hold.
 *
 * The store's offers are written as sentences — "No Cost EMI from
 * ₹24,249.65/Month" — because a sentence is what a person reads on the
 * product page. A badge is not a sentence: it is a label at the corner
 * of a photo, and a sentence there is clipped into nonsense.
 *
 * So the badge takes the offer's *name* and leaves the figures to the
 * price row, where they belong. Nothing is invented: the words come
 * from the stored offer, only the trailing amount is dropped.
 */

/** The words a badge can show before it needs to be shortened. */
export const OFFER_BADGE_MAX_LENGTH = 28;

/**
 * The short label for an offer, or "" when there is no offer.
 *
 * "No Cost EMI from ₹24,249.65/Month" → "No Cost EMI"
 * "Save ₹500 on orders over ₹2,999"   → "Save ₹500"
 * "50% OFF"                          → "50% OFF"
 */
export function offerBadgeLabel(offerText) {
  const text = typeof offerText === "string" ? offerText.trim() : "";
  if (!text) return "";

  // The offer's name is everything before the figure it starts from, and a
  // trailing "onwards" is part of that sentence, not of the name.
  const name = text
    .replace(/\s+onwards$/i, "")
    .split(/\s+(?:from|starting at)\s+/i)[0]
    .trim();
  const label = name || text;

  return label.length > OFFER_BADGE_MAX_LENGTH
    ? `${label.slice(0, OFFER_BADGE_MAX_LENGTH - 1).trimEnd()}…`
    : label;
}
