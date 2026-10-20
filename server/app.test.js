// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
});

vi.mock("./db.js", () => ({ supabase: { from: vi.fn() } }));

import app from "./app.js";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

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
