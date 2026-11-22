// Architecture: Frontend (Browser) -> Express Backend (/api/*) -> Database & Cloudinary
// Transport (token, headers, error mapping) lives in client.js. This module owns
// the auth, user, product, order and upload endpoints; site content lives in
// contentApi.js.
import { apiFetch, getStoredToken, setStoredToken } from "./client.js";

export function clearStoredToken() {
  setStoredToken(null);
}

/* -------------------------------------------------------------------------- */
/* Cloudinary image uploads                                                   */
/* -------------------------------------------------------------------------- */
export async function apiUploadImage(file, folder = "marvel_products") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);
  return apiFetch("/upload", { method: "POST", formData });
}

/* -------------------------------------------------------------------------- */
/* Authentication & sessions                                                  */
/* -------------------------------------------------------------------------- */
export async function apiLogin({ email, password, expectedRole }) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: { email, password, expectedRole },
    auth: false,
  });
  if (data.token) setStoredToken(data.token);
  return data;
}

export async function apiSignUp({ email, password, fullName, role = "user", storeName = "" }) {
  const data = await apiFetch("/auth/signup", {
    method: "POST",
    body: { email, password, fullName, role, storeName },
    auth: false,
  });
  if (data.token) setStoredToken(data.token);
  return data;
}

/** Restore the session user, or `null` when there is no token to check. */
export async function apiGetMe() {
  if (!getStoredToken()) return null;
  const data = await apiFetch("/auth/me");
  return data.user;
}

/* -------------------------------------------------------------------------- */
/* Users & role management                                                    */
/* -------------------------------------------------------------------------- */
export async function apiFetchAllUsers() {
  return apiFetch("/users");
}

export async function apiAdminCreateUser(userData) {
  const data = await apiFetch("/users/admin-create", { method: "POST", body: userData });
  return data.user;
}

export async function apiUpdateUserRole(userId, newRole) {
  const data = await apiFetch(`/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: { role: newRole },
  });
  return data.users;
}

export async function apiUpdateUserDetails(userId, userData) {
  const data = await apiFetch(`/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: userData,
  });
  return data.user;
}

export async function apiUpdateUserStatus(userId, status) {
  return apiFetch(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PUT",
    body: { status },
  });
}

export async function apiResetUserPassword(userId, newPassword) {
  return apiFetch(`/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    body: { newPassword },
  });
}

export async function apiDeleteUser(userId) {
  return apiFetch(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function apiRequestPasswordReset(email) {
  return apiFetch("/auth/request-reset", { method: "POST", body: { email }, auth: false });
}

export async function apiResetPassword(token, newPassword) {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    auth: false,
  });
}

/* -------------------------------------------------------------------------- */
/* Product catalog                                                            */
/* -------------------------------------------------------------------------- */
export async function apiFetchProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/products${query ? `?${query}` : ""}`);
}

/**
 * The category listing: one page of products for a category path, sorted and
 * filtered. `pageSize` 0 (the default) returns every product, like the plain
 * product list. Resolves `{ items, total, page, pageSize, hasMore }`.
 */
export async function apiFetchCategoryProducts(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return apiFetch(`/categories/products${query ? `?${query}` : ""}`);
}

export async function apiFetchProductById(id) {
  return apiFetch(`/products/${encodeURIComponent(id)}`);
}

/**
 * The whole product detail payload — `{ product, offers, reviews, variants,
 * combinations, media }` — for one product id.
 *
 * `variants.options` carries the product's option values and `combinations`
 * its sellable variants, so the admin console can show what is already
 * stored before it writes anything back.
 */
export async function apiFetchProductDetails(id) {
  return apiFetch(`/products/${encodeURIComponent(id)}/details`);
}

export async function apiCreateProduct(productData) {
  const data = await apiFetch("/products", { method: "POST", body: productData });
  return data.product;
}

export async function apiUpdateProduct(id, updates) {
  const data = await apiFetch(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: updates,
  });
  return data.product;
}

export async function apiModerateProduct(id, moderationPayload) {
  const data = await apiFetch(`/products/${encodeURIComponent(id)}/moderation`, {
    method: "PATCH",
    body: moderationPayload,
  });
  return data.product;
}

export async function apiDeleteProduct(id) {
  return apiFetch(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/* Orders & fulfillment                                                       */
/* -------------------------------------------------------------------------- */
export async function apiFetchOrders(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/orders${query ? `?${query}` : ""}`);
}

export async function apiCreateOrder(orderData) {
  const data = await apiFetch("/orders", { method: "POST", body: orderData });
  return data.order;
}

/** One order, for the confirmation screen after checkout. */
export async function apiFetchOrderById(id) {
  return apiFetch(`/orders/${encodeURIComponent(id)}`);
}

export async function apiUpdateOrderStatus(id, statusData) {
  const data = await apiFetch(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: statusData,
  });
  return data.order;
}

/* -------------------------------------------------------------------------- */
/* Admin operations: stock adjustments, audit log, coupons                   */
/* -------------------------------------------------------------------------- */

/**
 * Set one product's stock. Returns the formatted product the write produced.
 */
export async function apiUpdateProductStock(id, stockPayload) {
  const data = await apiFetch(`/products/${encodeURIComponent(id)}/stock`, {
    method: "PATCH",
    body: stockPayload,
  });
  return data?.product;
}

/**
 * Apply one stock adjustment to many products. Returns the per-row results.
 */
export async function apiUpdateProductStockBulk(adjustments) {
  const data = await apiFetch("/products/stock", { method: "PATCH", body: adjustments });
  return data;
}

/**
 * The admin audit log, newest first. Admin-only on the server.
 */
export async function apiFetchAdminAudit(limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) }).toString();
  return apiFetch(`/admin/audit?${query}`);
}

/**
 * The coupon list. Admin-only on the server.
 */
export async function apiFetchCoupons() {
  const data = await apiFetch("/coupons");
  return data?.coupons ?? [];
}

/** Public, minimal list the product page may advertise. */
export async function apiFetchActiveCoupons() {
  const data = await apiFetch("/coupons/active", { auth: false });
  return data?.coupons ?? [];
}

/** Admin-only redemptions, savings and per-code breakdown. */
export async function apiFetchCouponUsage() {
  return apiFetch("/coupons/usage");
}

export async function apiCreateCoupon(coupon) {
  const data = await apiFetch("/coupons", { method: "POST", body: coupon });
  return data.coupon;
}

export async function apiUpdateCoupon(id, coupon) {
  const data = await apiFetch(`/coupons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: coupon,
  });
  return data.coupon;
}

export async function apiDeleteCoupon(id) {
  const data = await apiFetch(`/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
  return data;
}

/**
 * Pre-check a coupon against a subtotal. Public: an unknown or unusable code
 * answers `{ valid: false, reason }` with a 200, so the storefront can show the
 * reason instead of catching an error.
 */
export async function apiValidateCoupon({ code, subtotal }) {
  return apiFetch("/coupons/validate", { method: "POST", body: { code, subtotal }, auth: false });
}

/**
 * Count a coupon use after the order that consumes it was created. Public: the
 * checkout calls this once per placed order.
 */
export async function apiRedeemCoupon({ code }) {
  return apiFetch("/coupons/redeem", { method: "POST", body: { code }, auth: false });
}

/**
 * POST /api/orders/:id/return — `{ reason, notes }`: the customer's request
 * to return a delivered order. The backend stores it and returns the row.
 */
export async function apiRequestReturn(orderId, payload = {}) {
  const data = await apiFetch(`/orders/${encodeURIComponent(orderId)}/return`, {
    method: "POST",
    body: {
      reason: payload.reason,
      notes: typeof payload.notes === "string" ? payload.notes : "",
    },
  });
  return data?.return;
}

/* -------------------------------------------------------------------------- */
/* Cart persistence                                                           */
/* -------------------------------------------------------------------------- */
/**
 * A signed-in customer's cart lives in the backend too, so it survives a
 * browser change. The localStorage copy stays authoritative while a write is
 * in flight; a failure here must never stop someone shopping.
 */
export async function apiFetchCart(userId) {
  const data = await apiFetch(`/cart?userId=${encodeURIComponent(userId)}`);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function apiSaveCart(userId, items) {
  return apiFetch("/cart", { method: "PUT", body: { userId, items } });
}

export async function apiClearCart(userId) {
  return apiFetch("/cart", { method: "DELETE", body: { userId } });
}
