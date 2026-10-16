import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

// Chain builders mimicking the supabase-js query interface used by menu.js:
// upsert: from().upsert().select() ; delete: from().delete().eq() ;
// lookup: from().select().eq().single()
function upsertChain({ error = null, throws = null } = {}) {
  return {
    upsert: vi.fn(() => ({
      select: vi.fn(async () => {
        if (throws) throw throws;
        return { data: [], error };
      }),
    })),
  };
}

function deleteChain({ error = null, throws = null } = {}) {
  return {
    delete: vi.fn(() => ({
      eq: vi.fn(async () => {
        if (throws) throw throws;
        return { data: null, error };
      }),
    })),
  };
}

describe("menu write error surfacing", () => {
  let server;
  let base;
  let adminHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          const token = signUserToken({
            id: "t-menu-admin",
            email: "admin@test.local",
            role: "admin",
          });
          adminHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          };
          resolve();
        });
      })
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("POST /api/menu surfaces a thrown exception as 500", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("db connection reset");
    });
    const res = await fetch(`${base}/api/menu`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Boom Item", path: "/boom" }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db connection reset/);
  });

  it("POST /api/menu still degrades to in-memory on a returned error", async () => {
    mockFrom.mockReturnValue(upsertChain({ error: { message: "table missing" } }));
    const res = await fetch(`${base}/api/menu`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Fallback Item", path: "/fallback" }),
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()).menu.find((m) => m.title === "Fallback Item");
    expect(saved).toBeDefined();
  });

  it("DELETE /api/menu/:id surfaces a Supabase delete error as 500", async () => {
    mockFrom.mockReturnValue(deleteChain({ error: { message: "db delete boom" } }));
    const res = await fetch(`${base}/api/menu/ghost-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db delete boom/);
  });

  it("DELETE /api/menu/:id surfaces a thrown exception as 500", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("db connection reset");
    });
    const res = await fetch(`${base}/api/menu/ghost-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db connection reset/);
  });

  it("DELETE /api/menu/:id succeeds when the delete succeeds", async () => {
    mockFrom.mockReturnValue(deleteChain({ error: null }));
    const res = await fetch(`${base}/api/menu/ghost-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/deleted/);
  });
});
