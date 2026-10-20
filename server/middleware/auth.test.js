// @vitest-environment node
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";

// A deterministic test secret, set before the module under test is imported.
// dotenv.config() inside auth.js does not override an existing env var, so the
// tests never depend on whatever value is in .env.
const TEST_SECRET = "unit-test-jwt-secret-0123456789abcdef";
vi.hoisted(() => {
  process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
});

import { assertJwtSecret, requireRole, signUserToken, verifyToken } from "./auth.js";

const originalSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function makeReq(headers = {}) {
  return { headers };
}

describe("verifyToken", () => {
  it("accepts a Bearer token and attaches the decoded user", () => {
    const token = signUserToken({
      id: "user-1",
      email: "user@test.local",
      role: "admin",
      full_name: "Test Admin",
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(req.user).toMatchObject({
      id: "user-1",
      email: "user@test.local",
      role: "admin",
      full_name: "Test Admin",
    });
  });

  it("rejects a raw token without the Bearer scheme", () => {
    const token = signUserToken({ id: "user-1", email: "user@test.local", role: "user" });
    const req = makeReq({ authorization: token });
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid authorization header." });
  });

  it.each(["Basic abc123", "bearer lower-case", "Bearer", "Token abc"])(
    "rejects non-Bearer schemes (%s) with Invalid authorization header",
    (header) => {
      const req = makeReq({ authorization: header });
      const res = makeRes();
      const next = vi.fn();

      verifyToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Invalid authorization header." });
    }
  );

  it("rejects a missing header with 401 and an error body", () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(typeof res.body?.error).toBe("string");
  });

  it("rejects a forged token signed with a different secret", () => {
    const forged = jwt.sign({ id: "attacker", role: "super_admin" }, "x".repeat(40));
    const req = makeReq({ authorization: `Bearer ${forged}` });
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid authentication token signature." });
  });

  it("rejects an expired token with 401", () => {
    const expired = jwt.sign({ id: "user-1", role: "user" }, TEST_SECRET, { expiresIn: -60 });
    const req = makeReq({ authorization: `Bearer ${expired}` });
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });
});

describe("requireRole", () => {
  it("rejects a user-role token from an admin-only route with 403", () => {
    const req = { user: { id: "user-1", role: "user" } };
    const res = makeRes();
    const next = vi.fn();

    requireRole(["admin"])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });

  it("allows an admin through", () => {
    const req = { user: { id: "admin-1", role: "admin" } };
    const res = makeRes();
    const next = vi.fn();

    requireRole(["admin", "super_admin"])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 when no user was attached", () => {
    const req = {};
    const res = makeRes();
    const next = vi.fn();

    requireRole(["admin"])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe("assertJwtSecret", () => {
  it("throws in production when JWT_SECRET is empty", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    expect(() => assertJwtSecret()).toThrow(/JWT_SECRET is required/);
  });

  it("throws in production when JWT_SECRET is shorter than 32 characters", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "short-secret";

    expect(() => assertJwtSecret()).toThrow(/JWT_SECRET is required/);
  });

  it("accepts a production secret of at least 32 characters", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = TEST_SECRET;

    expect(() => assertJwtSecret()).not.toThrow();
  });

  it("does not hard-block development without a secret, but still signs and verifies", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_SECRET;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => assertJwtSecret()).not.toThrow();
    expect(warn).toHaveBeenCalled();

    const token = signUserToken({ id: "dev-1", email: "dev@test.local", role: "admin" });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe("dev-1");
  });
});
