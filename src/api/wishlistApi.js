// Wishlist endpoints only — transport lives in client.js, which already
// prefixes `/api`, so paths here are relative to it. Every call requires a
// stored token; the server scopes the rows to that token's user.
import { apiFetch } from "./client.js";

const WISHLIST = "/account/wishlist";

/** `{ items: [{ id, product_id, created_at, product }] }`, newest first. */
export const apiFetchWishlist = () => apiFetch(WISHLIST);

/**
 * Idempotent add. Resolves `{ item }`; the server returns 201 for a new row and
 * 200 when the product is already in the caller's wishlist.
 */
export const apiAddToWishlist = (productId) =>
  apiFetch(WISHLIST, { method: "POST", body: { product_id: productId } });

/** Removes the caller's row for `productId`. Resolves `undefined` (204). */
export const apiRemoveFromWishlist = (productId) =>
  apiFetch(`${WISHLIST}/${encodeURIComponent(productId)}`, { method: "DELETE" });
