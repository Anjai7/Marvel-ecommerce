// Product detail endpoint only — transport lives in client.js, which already
// prefixes `/api`, so paths here are relative to it.
import { apiFetch } from "./client.js";

/**
 * `{ product, offers, reviews, variants, media }` for one product id.
 * Throws with `.status === 404` when the product does not exist.
 */
export const apiFetchProductDetails = (id) =>
  apiFetch(`/products/${encodeURIComponent(id)}/details`);

/**
 * `POST /api/products/:id/reviews` — the stored review in the same shape the
 * details payload's `items` carry. A rejected payload throws with `.status`
 * 400 and the server's message; 404 means the product is gone.
 *
 * Public on purpose: the storefront has no auth flow, so no token is sent.
 */
export const apiCreateReview = (productId, payload) =>
  apiFetch(`/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    body: payload,
    auth: false,
  });
