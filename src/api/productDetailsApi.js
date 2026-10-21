// Product detail endpoint only — transport lives in client.js, which already
// prefixes `/api`, so paths here are relative to it.
import { apiFetch } from "./client.js";

/**
 * `{ product, offers, reviews, variants, media }` for one product id.
 * Throws with `.status === 404` when the product does not exist.
 */
export const apiFetchProductDetails = (id) =>
  apiFetch(`/products/${encodeURIComponent(id)}/details`);
