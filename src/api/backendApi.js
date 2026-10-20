// Architecture: Frontend (Browser) -> Express Backend (/api/*) -> Database & Cloudinary
// Transport (token, headers, error mapping) lives in client.js. This module owns
// the auth, user, product, order and upload endpoints; site content lives in
// contentApi.js.
import { apiFetch, getStoredToken, setStoredToken } from "./client.js";

export { getStoredToken, setStoredToken };

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

export async function apiFetchProductById(id) {
  return apiFetch(`/products/${encodeURIComponent(id)}`);
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

export async function apiUpdateOrderStatus(id, statusData) {
  const data = await apiFetch(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: statusData,
  });
  return data.order;
}
