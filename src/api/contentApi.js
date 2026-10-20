// Thin transport for the content API. Task 10 owns the full client; this
// module currently exposes the one read the CategoryPicker needs.
const API_BASE_URL = "/api";
const TOKEN_KEY = "marvel_jwt_token";

/**
 * `GET /api/categories/tree` → `{ categories: CategoryNode[] }`.
 * `includeInactive` needs an admin token; the caller passes it only for editors.
 */
export async function apiFetchCategoryTree(opts = {}) {
  const params = new URLSearchParams();
  if (opts.includeInactive) params.set("includeInactive", "1");
  const query = params.toString();

  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE_URL}/categories/tree${query ? `?${query}` : ""}`, {
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch categories.");
  return { categories: data.categories || [] };
}
