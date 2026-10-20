// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

// Chain builders mimicking the supabase-js query interface used by content.js:
// reads: from().select().eq().order() ; upserts: from().upsert() ;
// deletes: from().delete().eq()
function selectChain({ data = [], error = null } = {}) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(async () => ({ data, error })),
  };
  return chain;
}

function writeChain({ error = null } = {}) {
  const chain = {
    upsert: vi.fn(async () => ({ data: null, error })),
    delete: vi.fn(() => chain),
    eq: vi.fn(async () => ({ data: null, error })),
  };
  return chain;
}

describe("content write error surfacing", () => {
  let server;
  let base;
  let adminHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          const token = signUserToken({
            id: "t-content-admin",
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

  it("POST /api/content/hero surfaces a Supabase write error as 500", async () => {
    mockFrom.mockReturnValue(writeChain({ error: { message: "db write boom" } }));
    const res = await fetch(`${base}/api/content/hero`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Sale", order_index: 0 }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db write boom/);
  });

  it("POST /api/content/hero succeeds only when the write succeeds", async () => {
    mockFrom.mockReturnValue(writeChain({ error: null }));
    const res = await fetch(`${base}/api/content/hero`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Sale", order_index: 0 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/saved successfully/);
  });

  it("DELETE /api/content/hero/:id surfaces a Supabase delete error as 500", async () => {
    mockFrom.mockReturnValue(writeChain({ error: { message: "db delete boom" } }));
    const res = await fetch(`${base}/api/content/hero/some-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db delete boom/);
  });

  it("POST /api/content/categories surfaces a Supabase write error as 500", async () => {
    mockFrom.mockReturnValue(writeChain({ error: { message: "db category boom" } }));
    const res = await fetch(`${base}/api/content/categories`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ name: "Mobiles", order_index: 1 }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db category boom/);
  });

  it("DELETE /api/content/categories/:id surfaces a Supabase delete error as 500", async () => {
    mockFrom.mockReturnValue(writeChain({ error: { message: "db category delete boom" } }));
    const res = await fetch(`${base}/api/content/categories/some-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/db category delete boom/);
  });

  it("public GETs still degrade to empty arrays when reads fail", async () => {
    mockFrom.mockReturnValue(selectChain({ data: null, error: { message: "missing table" } }));
    const hero = await (await fetch(`${base}/api/content/hero`)).json();
    expect(hero).toEqual({ slides: [] });
    const cats = await (await fetch(`${base}/api/content/categories`)).json();
    expect(cats).toEqual({ categories: [] });
  });

  it("POST /api/content/hero surfaces a thrown exception as 500", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("connection reset");
    });
    const res = await fetch(`${base}/api/content/hero`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Sale", order_index: 0 }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/connection reset/);
  });

  it("POST /api/content/categories surfaces a thrown exception as 500", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("connection reset");
    });
    const res = await fetch(`${base}/api/content/categories`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ name: "Mobiles", order_index: 1 }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/connection reset/);
  });

  it("DELETE /api/content/hero/:id surfaces a thrown exception as 500", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("connection reset");
    });
    const res = await fetch(`${base}/api/content/hero/some-id`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/connection reset/);
  });
});
