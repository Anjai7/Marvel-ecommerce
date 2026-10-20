// Transport for the whole client: one token lookup, one header builder, one
// error mapping. Endpoint knowledge belongs in contentApi.js / backendApi.js.
export const API_BASE_URL = "/api";

const TOKEN_KEY = "marvel_jwt_token";
const unauthorizedListeners = new Set();

/**
 * The JWT lives in localStorage. Returns `null` when there is no token (or no
 * storage, as in a server render).
 */
export function getStoredToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setStoredToken(token) {
  if (typeof localStorage === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Register the global 401 handler. Returns the unsubscribe function so an
 * effect can clean up. Each response notifies a listener at most once.
 */
export function onUnauthorized(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("onUnauthorized expects a function.");
  }
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(status) {
  for (const listener of [...unauthorizedListeners]) {
    try {
      listener(status);
    } catch {
      // A broken listener must not mask the request error being thrown.
    }
  }
}

/** Parse a response body as JSON, falling back to text, then undefined. */
async function readBody(res) {
  if (typeof res.text === "function") {
    try {
      const text = await res.text();
      if (text === "") return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      // Fall through to json() — a stub or stream may only expose that.
    }
  }

  if (typeof res.json === "function") {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/** The server's `{ error }` string, or a status-based fallback. */
function errorMessage(body, status) {
  if (body && typeof body === "object" && typeof body.error === "string" && body.error) {
    return body.error;
  }
  return `Request failed with status ${status}`;
}

/**
 * Fetch `path` under `/api` and resolve the parsed body.
 *
 * Non-2xx responses throw an Error with `.status` and `.body` attached; this
 * function never resolves `[]` or `null` to hide a failure. A `401` also
 * notifies every `onUnauthorized` listener exactly once.
 */
export async function apiFetch(path, options = {}) {
  const { method = "GET", body, formData, auth = true } = options;

  const headers = {};
  if (auth !== false) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const hasFormData =
    (typeof FormData !== "undefined" && body instanceof FormData) || formData !== undefined;
  const payload = formData !== undefined ? formData : body;
  const hasBody = payload !== undefined && payload !== null;

  // The browser sets multipart's Content-Type (with the boundary) itself.
  if (hasBody && !hasFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(hasBody ? { body: hasFormData ? payload : JSON.stringify(payload) } : {}),
  });

  if (res.status === 401) notifyUnauthorized(401);

  if (!res.ok) {
    const errorBody = await readBody(res);
    const error = new Error(errorMessage(errorBody, res.status));
    error.status = res.status;
    error.body = errorBody;
    throw error;
  }

  if (res.status === 204) return undefined;
  return readBody(res);
}
