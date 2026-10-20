// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
});

vi.mock("./db.js", () => ({ supabase: { from: vi.fn() } }));

import app, { apiErrorHandler } from "./app.js";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;

let server;
let base;

beforeAll(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

afterAll(() => new Promise((resolve) => server.close(resolve)));

afterEach(() => {
  if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  process.env.NODE_ENV = originalNodeEnv;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  vi.restoreAllMocks();
});

async function getWithOrigin(origin) {
  const res = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
  return { status: res.status, allowOrigin: res.headers.get("access-control-allow-origin") };
}

describe("CORS allowlist", () => {
  it("allows the local dev origins by default when ALLOWED_ORIGINS is unset", async () => {
    delete process.env.ALLOWED_ORIGINS;

    const vite = await getWithOrigin("http://localhost:5173");
    const loopback = await getWithOrigin("http://127.0.0.1:5173");
    const foreign = await getWithOrigin("https://evil.example.com");

    expect(vite.status).toBe(200);
    expect(vite.allowOrigin).toBe("http://localhost:5173");
    expect(loopback.allowOrigin).toBe("http://127.0.0.1:5173");
    expect(foreign.allowOrigin).toBeNull();
  });

  it("uses a comma-separated ALLOWED_ORIGINS allowlist when set", async () => {
    process.env.ALLOWED_ORIGINS = "https://admin.example.com, https://shop.example.com";

    const shop = await getWithOrigin("https://shop.example.com");
    const localhost = await getWithOrigin("http://localhost:5173");
    const wildcard = await getWithOrigin("*");

    expect(shop.allowOrigin).toBe("https://shop.example.com");
    expect(localhost.allowOrigin).toBeNull();
    expect(wildcard.allowOrigin).toBeNull();
  });
});

describe("ALLOWED_ORIGINS startup warning", () => {
  it("warns once when ALLOWED_ORIGINS is unset in a deployed context", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
    delete process.env.ALLOWED_ORIGINS;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();

    await import("./app.js");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/ALLOWED_ORIGINS/);
  });

  it("stays quiet in local development, where the localhost default is expected", async () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
    delete process.env.ALLOWED_ORIGINS;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();

    await import("./app.js");

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("terminal error handler", () => {
  it("leaves an already-started response alone and delegates", () => {
    const err = new Error("late failure");
    const next = vi.fn();
    const res = {
      headersSent: true,
      status: vi.fn(() => res),
      json: vi.fn(),
    };

    apiErrorHandler(err, {}, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("answers with JSON and the error status when nothing was sent yet", () => {
    const err = new Error("boom");
    err.status = 400;
    const next = vi.fn();
    const res = {
      headersSent: false,
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    apiErrorHandler(err, {}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "boom" });
  });
});
