// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

const ACTIVE_COUPON = {
  id: "coupon-1",
  code: "MARVEL20",
  kind: "percent",
  value: 20,
  min_subtotal: 0,
  max_uses: 0,
  used_count: 0,
  is_active: true,
  expires_at: null,
  created_at: "2026-11-01T00:00:00.000Z",
};

function makeCouponsQuery() {
  const query = {
    select: () => query,
    order: () => query,
    then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
  };
  return query;
}

describe("coupons API", () => {
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

  beforeEach(() => {
    mockFrom.mockReset();
  });

  const send = (method, path, body, headers = JSON_HEADERS) =>
    fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const adminAuthHeaders = () => ({
    ...JSON_HEADERS,
    Authorization: `Bearer ${signUserToken({
      id: "t-coupons-admin",
      email: "admin@test.local",
      role: "admin",
    })}`,
  });

  const userAuthHeaders = () => ({
    ...JSON_HEADERS,
    Authorization: `Bearer ${signUserToken({
      id: "t-coupons-user",
      email: "customer@test.local",
      role: "user",
    })}`,
  });

  it("GET /api/coupons is admin-only", async () => {
    const query = makeCouponsQuery();
    mockFrom.mockImplementation(() => query);

    const res = await send("GET", "/api/coupons");

    expect(res.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("GET /api/coupons with a customer token is forbidden", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => makeCouponsQuery());

    const res = await send("GET", "/api/coupons", undefined, userAuthHeaders());

    expect(res.status).toBe(403);
  });

  it("GET /api/coupons with an admin token lists the coupons", async () => {
    mockFrom.mockReset();
    const query = makeCouponsQuery();
    mockFrom.mockImplementation(() => query);

    const res = await send("GET", "/api/coupons", undefined, adminAuthHeaders());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ coupons: [] });
  });

  it("POST /api/coupons validates the payload before writing", async () => {
    mockFrom.mockReset();

    const res = await send(
      "POST",
      "/api/coupons",
      { code: "BAD", kind: "colour", value: 20 },
      adminAuthHeaders()
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Coupon kind must be one of: percent, flat, free_shipping.",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("POST /api/coupons creates an active coupon", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: ACTIVE_COUPON, error: null }),
        }),
      }),
    }));

    const res = await send(
      "POST",
      "/api/coupons",
      { code: "marvel20", kind: "percent", value: 20, min_subtotal: 500, max_uses: 100 },
      adminAuthHeaders()
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.coupon.code).toBe("MARVEL20");
    expect(body.coupon.kind).toBe("percent");
  });

  it("PATCH /api/coupons/:id updates a coupon", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: { ...ACTIVE_COUPON, is_active: false }, error: null }),
          }),
        }),
      }),
    }));

    const res = await send(
      "PATCH",
      "/api/coupons/coupon-1",
      { is_active: false },
      adminAuthHeaders()
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupon.is_active).toBe(false);
  });

  it("DELETE /api/coupons/:id deletes a coupon", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      delete: () => ({
        eq: () => ({
          then: (onFulfilled) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
        }),
      }),
    }));

    const res = await send("DELETE", "/api/coupons/coupon-1", undefined, adminAuthHeaders());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Coupon deleted.");
  });

  it("POST /api/coupons/validate answers 200 with a reason for an unknown code", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }));

    const res = await send("POST", "/api/coupons/validate", { code: "NOPE", subtotal: 100 });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: false, reason: "Unknown code" });
  });

  it("POST /api/coupons/validate computes the discount for an active coupon", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: ACTIVE_COUPON, error: null }),
          }),
        }),
      }),
    }));

    const res = await send("POST", "/api/coupons/validate", { code: "marvel20", subtotal: 100 });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.code).toBe("MARVEL20");
    expect(body.kind).toBe("percent");
    expect(body.value).toBe(20);
    expect(body.discount).toBe(20);
    expect(body.subtotal).toBe(100);
    expect(body.total).toBe(80);
  });

  it("POST /api/coupons/validate answers the minimum-order reason when the subtotal is short", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { ...ACTIVE_COUPON, min_subtotal: 500 }, error: null }),
          }),
        }),
      }),
    }));

    const res = await send("POST", "/api/coupons/validate", { code: "MARVEL20", subtotal: 100 });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: false, reason: "Minimum order of ₹500 required" });
  });

  it("POST /api/coupons/redeem does not count an unknown code", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }));

    const res = await send("POST", "/api/coupons/redeem", { code: "NOPE" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: false, reason: "Unknown code" });
  });

  it("POST /api/coupons/redeem increments used_count once the code is valid", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { ...ACTIVE_COUPON, max_uses: 1 }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { ...ACTIVE_COUPON, used_count: 1 }, error: null }),
            }),
          }),
        }),
      }),
    }));

    const res = await send("POST", "/api/coupons/redeem", { code: "MARVEL20" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.used_count).toBe(1);
  });
});

describe("coupon discovery and reporting", () => {
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
  beforeEach(() => mockFrom.mockReset());

  const chain = (result) => {
    const query = {
      select: () => query,
      eq: () => query,
      not: () => query,
      order: () => query,
      limit: () => query,
      then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return query;
  };

  it("GET /api/coupons/active advertises only usable codes", async () => {
    mockFrom.mockImplementation(() =>
      chain({
        data: [
          {
            code: "GOOD5",
            kind: "percent",
            value: 5,
            min_subtotal: 0,
            expires_at: null,
            max_uses: 0,
            used_count: 2,
          },
          {
            code: "OLD5",
            kind: "percent",
            value: 5,
            min_subtotal: 0,
            expires_at: "2020-01-01",
            max_uses: 0,
            used_count: 0,
          },
          {
            code: "DONE5",
            kind: "percent",
            value: 5,
            min_subtotal: 0,
            expires_at: null,
            max_uses: 2,
            used_count: 2,
          },
        ],
        error: null,
      })
    );

    const res = await fetch(`${base}/api/coupons/active`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupons.map((coupon) => coupon.code)).toEqual(["GOOD5"]);
    expect(body.coupons[0]).toEqual({
      code: "GOOD5",
      kind: "percent",
      value: 5,
      min_subtotal: 0,
    });
  });

  it("GET /api/coupons/usage aggregates redemptions and discounts", async () => {
    mockFrom.mockImplementation((table) =>
      chain(
        table === "coupons"
          ? { data: [{ ...ACTIVE_COUPON, code: "MARVEL20", used_count: 3 }], error: null }
          : {
              data: [
                {
                  id: "order-1",
                  coupon_code: "MARVEL20",
                  discount_amount: 100,
                  total_amount: 900,
                  customer_name: "Test Buyer",
                  created_at: "2026-11-01T00:00:00.000Z",
                },
                {
                  id: "order-2",
                  coupon_code: "MARVEL20",
                  discount_amount: 50,
                  total_amount: 450,
                  customer_name: "Other Buyer",
                  created_at: "2026-11-02T00:00:00.000Z",
                },
              ],
              error: null,
            }
      )
    );
    const token = signUserToken({ id: "admin-1", role: "admin", email: "admin@marvel.com" });

    const res = await fetch(`${base}/api/coupons/usage`, {
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.summary.redemptions).toBe(2);
    expect(body.summary.totalDiscount).toBe(150);
    expect(body.byCoupon[0]).toMatchObject({ code: "MARVEL20", uses: 2, discount: 150 });
    expect(body.recent).toHaveLength(2);
  });

  it("GET /api/coupons/usage requires an admin token", async () => {
    const res = await fetch(`${base}/api/coupons/usage`);
    expect(res.status).toBe(401);
  });
});
