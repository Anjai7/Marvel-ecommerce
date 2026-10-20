import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  API_BASE_URL,
  apiFetch,
  getStoredToken,
  setStoredToken,
  onUnauthorized,
} from "./client.js";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

let mockFetch;

beforeEach(() => {
  localStorage.removeItem("marvel_jwt_token");
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("marvel_jwt_token");
});

describe("apiFetch", () => {
  it("resolves the parsed JSON body of a successful GET", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ slides: [{ id: "a" }] }));

    const body = await apiFetch("/content/hero");

    expect(body).toEqual({ slides: [{ id: "a" }] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(API_BASE_URL).toBe("/api");
    expect(url).toBe("/api/content/hero");
    expect(options.method).toBe("GET");
    expect(options.body).toBeUndefined();
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("throws an Error carrying .status and .body on a 500", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Could not load content." }, { status: 500 })
    );

    const error = await apiFetch("/content/hero").catch((thrown) => thrown);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Could not load content.");
    expect(error.status).toBe(500);
    expect(error.body).toEqual({ error: "Could not load content." });
  });

  it("never resolves to [] or null to hide a failure", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Boom" }, { status: 500 }));

    await expect(apiFetch("/categories")).rejects.toThrow("Boom");
  });

  it("sends Authorization: Bearer <token> when a token is stored", async () => {
    localStorage.setItem("marvel_jwt_token", "jwt-123");
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/me");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer jwt-123");
  });

  it("sends no Authorization header when auth is false", async () => {
    localStorage.setItem("marvel_jwt_token", "jwt-123");
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/login", { method: "POST", body: { email: "a@b.c" }, auth: false });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("sends a JSON body with Content-Type: application/json", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }, { status: 201 }));

    await apiFetch("/content/hero", { method: "POST", body: { title: "Slide" } });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ title: "Slide" });
  });

  it("notifies onUnauthorized listeners exactly once for a 401", async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    mockFetch.mockResolvedValue(jsonResponse({ error: "Access denied." }, { status: 401 }));

    await expect(apiFetch("/auth/me")).rejects.toThrow("Access denied.");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(401);

    unsubscribe();
    await expect(apiFetch("/auth/me")).rejects.toThrow("Access denied.");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify onUnauthorized listeners for a non-401 failure", async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    mockFetch.mockResolvedValue(jsonResponse({ error: "Nope" }, { status: 403 }));

    await expect(apiFetch("/menu")).rejects.toThrow("Nope");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("propagates a network rejection", async () => {
    mockFetch.mockRejectedValue(new Error("down"));

    await expect(apiFetch("/content/hero")).rejects.toThrow("down");
  });

  it("does not set Content-Type when the body is FormData", async () => {
    const formData = new FormData();
    formData.append("folder", "marvel_products");
    mockFetch.mockResolvedValue(jsonResponse({ url: "https://example.test/a.jpg" }));

    await apiFetch("/upload", { method: "POST", formData });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBe(formData);
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("does not set Content-Type when a FormData is passed as body", async () => {
    const formData = new FormData();
    mockFetch.mockResolvedValue(jsonResponse({ url: "https://example.test/a.jpg" }));

    await apiFetch("/upload", { method: "POST", body: formData });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("resolves undefined for a 204", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) });

    await expect(apiFetch("/menu/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("falls back to the status message when the error body is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError("not json")),
      text: () => Promise.resolve("<html>Bad gateway</html>"),
    });

    const error = await apiFetch("/content/hero").catch((thrown) => thrown);

    expect(error.message).toBe("Request failed with status 502");
    expect(error.status).toBe(502);
    expect(error.body).toBe("<html>Bad gateway</html>");
  });
});

describe("token storage", () => {
  it("round-trips through localStorage", () => {
    setStoredToken("abc");
    expect(getStoredToken()).toBe("abc");

    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });
});
