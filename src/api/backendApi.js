// Architecture: Frontend (Browser) -> Express Backend (/api/*) -> Database & Cloudinary
// Transport (token, headers, error mapping) lives in client.js. This module owns
// the auth, user, product, order, menu and legacy-content endpoints.
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
/* Dynamic navigation menu                                                    */
/* -------------------------------------------------------------------------- */
export async function apiFetchMenuItems(userRole = "user") {
  const query = new URLSearchParams({ role: userRole }).toString();
  return apiFetch(`/menu?${query}`);
}

export async function apiSaveMenuItem(menuItem) {
  const data = await apiFetch("/menu", { method: "POST", body: menuItem });
  return data.item;
}

export async function apiDeleteMenuItem(id) {
  return apiFetch(`/menu/${encodeURIComponent(id)}`, { method: "DELETE" });
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

/* -------------------------------------------------------------------------- */
/* Legacy site content — hero slides & the temporary category alias           */
/*                                                                             */
/* These keep their old exported names and return shapes for the components    */
/* that still import them; the storefront migrates to contentApi.js. They now  */
/* resolve arrays instead of swallowing failures: a 5xx throws.                */
/* -------------------------------------------------------------------------- */
export async function apiFetchHeroSlides() {
  const data = await apiFetch("/content/hero");
  return data.slides;
}

export async function apiSaveHeroSlide(slide) {
  const payload = {
    ...slide,
    order_index: slide.order_index != null ? Number(slide.order_index) : 0,
  };
  return apiFetch("/content/hero", { method: "POST", body: payload });
}

export async function apiDeleteHeroSlide(id) {
  return apiFetch(`/content/hero/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function apiFetchSiteCategories() {
  const data = await apiFetch("/content/categories");
  return data.categories;
}

export async function apiSaveSiteCategory(category) {
  const payload = {
    ...category,
    order_index: category.order_index != null ? Number(category.order_index) : 0,
  };
  return apiFetch("/content/categories", { method: "POST", body: payload });
}

export async function apiDeleteSiteCategory(id) {
  return apiFetch(`/content/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}
