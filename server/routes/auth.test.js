// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Set the test secret before auth.js/app.js are imported; .env is never relied on.
vi.hoisted(() => {
  process.env.JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";
});

const { mockFrom, mockUpdateUserById } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpdateUserById: vi.fn(),
}));

vi.mock("../db.js", () => ({
  supabase: {
    from: mockFrom,
    auth: { admin: { updateUserById: mockUpdateUserById } },
  },
}));

import app from "../app.js";

const RESET_REQUEST_MESSAGE = "If this email is registered, a reset link has been sent.";
const INVALID_TOKEN_MESSAGE = "Invalid or expired reset token.";

let server;
let base;
let dbOptions;

/**
 * Supabase double: every from(table) returns a chainable builder whose awaited
 * result depends on the table and the operation, so a test can script the
 * profile lookup, the reset-token lookup and the writes independently.
 */
function installDb() {
  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    const state = { op: null, filters: [] };

    const result = () => {
      if (table === "profiles") {
        return { data: dbOptions.profile ?? null, error: dbOptions.profileError ?? null };
      }
      if (state.op === "select") {
        return { data: dbOptions.resetToken ?? null, error: dbOptions.resetTokenError ?? null };
      }
      return { data: null, error: dbOptions.writeError ?? null };
    };

    const chain = {
      select() {
        if (state.op === null) state.op = "select";
        return chain;
      },
      insert(row) {
        state.op = "insert";
        dbOptions.log.inserts.push({ table, row });
        return chain;
      },
      update(row) {
        state.op = "update";
        dbOptions.log.updates.push({ table, row, filters: state.filters });
        return chain;
      },
      eq(column, value) {
        state.filters.push([column, value]);
        return chain;
      },
      neq(column, value) {
        state.filters.push([column, value]);
        return chain;
      },
      is(column, value) {
        state.filters.push([column, value]);
        return chain;
      },
      maybeSingle() {
        return Promise.resolve(result());
      },
      single() {
        return Promise.resolve(result());
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(result()).then(onFulfilled, onRejected);
      },
    };

    return chain;
  });
}

async function post(path, body) {
  const res = await fetch(`${base}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

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

beforeEach(() => {
  dbOptions = { profile: null, resetToken: null, log: { inserts: [], updates: [] } };
  installDb();
  mockUpdateUserById.mockReset();
  mockUpdateUserById.mockResolvedValue({ data: { id: "user-1" }, error: null });
});

describe("POST /api/auth/request-reset", () => {
  it("answers identically for a known email and an unknown email, without leaking the userId", async () => {
    dbOptions.profile = { id: "user-1" };
    const known = await post("/request-reset", { email: "Known@Example.com" });
    const knownInsert = dbOptions.log.inserts[0];

    dbOptions.log.inserts.length = 0;
    dbOptions.profile = null;
    const unknown = await post("/request-reset", { email: "nobody@example.com" });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual({ message: RESET_REQUEST_MESSAGE });
    expect(unknown.body).toEqual(known.body);
    expect(known.body.userId).toBeUndefined();
    expect(known.body.email).toBeUndefined();

    expect(knownInsert.table).toBe("password_reset_tokens");
    expect(knownInsert.row).toMatchObject({ user_id: "user-1" });
    expect(knownInsert.row.token).toMatch(/^[0-9a-f]{64}$/);
    const ttl = new Date(knownInsert.row.expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(dbOptions.log.inserts).toHaveLength(0);
  });

  it("requires an email", async () => {
    const res = await post("/request-reset", {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Email is required." });
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rejects an unknown token without touching the auth password", async () => {
    const res = await post("/reset-password", { token: "nope", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: INVALID_TOKEN_MESSAGE });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    expect(dbOptions.log.updates).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    dbOptions.resetToken = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      used_at: null,
    };

    const res = await post("/reset-password", { token: "expired", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: INVALID_TOKEN_MESSAGE });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("rejects an already-used token", async () => {
    dbOptions.resetToken = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: new Date(Date.now() - 60_000).toISOString(),
    };

    const res = await post("/reset-password", { token: "used", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: INVALID_TOKEN_MESSAGE });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("rejects a token row without a usable expiry", async () => {
    dbOptions.resetToken = { id: "token-1", user_id: "user-1", expires_at: null, used_at: null };

    const res = await post("/reset-password", { token: "no-expiry", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: INVALID_TOKEN_MESSAGE });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("resets the password with a valid token, consumes it and invalidates the other tokens", async () => {
    dbOptions.resetToken = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    };

    const res = await post("/reset-password", { token: "good-token", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/successfully updated/i);
    expect(mockUpdateUserById).toHaveBeenCalledWith("user-1", { password: "newpass123" });

    const tokenUpdates = dbOptions.log.updates.filter((u) => u.table === "password_reset_tokens");
    expect(tokenUpdates).toHaveLength(2);
    expect(tokenUpdates[0].row.used_at).toBeTruthy();
    expect(tokenUpdates[0].filters).toContainEqual(["id", "token-1"]);
    expect(tokenUpdates[1].row.used_at).toBeTruthy();
    expect(tokenUpdates[1].filters).toContainEqual(["user_id", "user-1"]);
    expect(tokenUpdates[1].filters).toContainEqual(["id", "token-1"]);
  });

  it("does not accept the legacy { email, newPassword } body", async () => {
    dbOptions.profile = { id: "user-1" };

    const res = await post("/reset-password", {
      email: "admin@example.com",
      newPassword: "newpass123",
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: INVALID_TOKEN_MESSAGE });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("keeps the six-character minimum", async () => {
    dbOptions.resetToken = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    };

    const res = await post("/reset-password", { token: "good-token", newPassword: "12345" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Password must be at least 6 characters." });
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("surfaces an auth update failure as 500", async () => {
    dbOptions.resetToken = {
      id: "token-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    };
    mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "auth boom" } });

    const res = await post("/reset-password", { token: "good-token", newPassword: "newpass123" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "auth boom" });
  });
});

describe("removed legacy reset route", () => {
  it("no longer serves POST /api/auth/forgot-password", async () => {
    const res = await post("/forgot-password", { email: "admin@example.com" });
    expect(res.status).toBe(404);
  });
});
