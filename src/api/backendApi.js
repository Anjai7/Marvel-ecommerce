// Architecture: Frontend (Browser) -> Express Backend (/api/*) -> Database & Cloudinary
const API_BASE_URL = "/api";
const TOKEN_KEY = "marvel_jwt_token";

/**
 * ----------------------------------------------------
 * JWT TOKEN STORAGE HELPERS
 * ----------------------------------------------------
 */
export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeaders(extraHeaders = {}) {
  const token = getStoredToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * ----------------------------------------------------
 * CLOUDINARY IMAGE UPLOADS
 * ----------------------------------------------------
 */
export async function apiUploadImage(file, folder = "marvel_products") {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to upload image to Cloudinary.");
  }
  return data;
}

/**
 * ----------------------------------------------------
 * AUTHENTICATION & SESSIONS
 * ----------------------------------------------------
 */
export async function apiLogin({ email, password, expectedRole }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, expectedRole })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Login failed on backend server.");
  }

  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function apiSignUp({ email, password, fullName, role = "user", storeName = "" }) {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName, role, storeName })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Registration failed on backend server.");
  }

  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function apiGetMe() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      clearStoredToken();
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error("Session restore error:", err.message);
    return null;
  }
}

/**
 * ----------------------------------------------------
 * DYNAMIC NAVIGATION MENU
 * ----------------------------------------------------
 */
export async function apiFetchMenuItems(userRole = "user") {
  try {
    const res = await fetch(`${API_BASE_URL}/menu?role=${userRole}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch menu.");
    return data;
  } catch (err) {
    console.error("Backend Menu API error:", err.message);
    return [];
  }
}

export async function apiSaveMenuItem(menuItem) {
  const res = await fetch(`${API_BASE_URL}/menu`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(menuItem)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to save menu item.");
  return data.menu;
}

export async function apiDeleteMenuItem(id) {
  const res = await fetch(`${API_BASE_URL}/menu/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete menu item.");
  return data.menu;
}

/**
 * ----------------------------------------------------
 * USERS & ROLE MANAGEMENT
 * ----------------------------------------------------
 */
export async function apiFetchAllUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  } catch (err) {
    console.error("Backend Users API error:", err.message);
    return [];
  }
}

export async function apiUpdateUserRole(userId, newRole) {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ role: newRole })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update role.");
  return data.users;
}

/**
 * ----------------------------------------------------
 * PRODUCT CATALOG (CRUD & Moderation)
 * ----------------------------------------------------
 */
export async function apiFetchProducts(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/products${query ? `?${query}` : ""}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch products.");
    return data;
  } catch (err) {
    console.error("Products API error:", err.message);
    return [];
  }
}

export async function apiFetchProductById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Product not found.");
    return data;
  } catch (err) {
    console.error(`Product API error for id ${id}:`, err.message);
    return null;
  }
}

export async function apiCreateProduct(productData) {
  const res = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(productData)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create product.");
  return data.product;
}

export async function apiUpdateProduct(id, updates) {
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(updates)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update product.");
  return data.product;
}

export async function apiModerateProduct(id, moderationPayload) {
  const res = await fetch(`${API_BASE_URL}/products/${id}/moderation`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(moderationPayload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to moderate product.");
  return data.product;
}

export async function apiDeleteProduct(id) {
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete product.");
  return data;
}

/**
 * ----------------------------------------------------
 * ORDERS & FULFILLMENT
 * ----------------------------------------------------
 */
export async function apiFetchOrders(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/orders${query ? `?${query}` : ""}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch orders.");
    return data;
  } catch (err) {
    console.error("Orders API error:", err.message);
    return [];
  }
}

export async function apiCreateOrder(orderData) {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(orderData)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to place order.");
  return data.order;
}

export async function apiUpdateOrderStatus(id, statusData) {
  const res = await fetch(`${API_BASE_URL}/orders/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(statusData)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update order status.");
  return data.order;
}
