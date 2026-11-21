// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../db.js", () => ({ supabase: { from: mockFrom } }));

import app from "../app.js";
import { signUserToken } from "../middleware/auth.js";

/**
 * Chainable Supabase double. The return endpoint reads the order with
 * `maybeSingle()` and writes the return row with `insert().select().single()`.
 */
function makeDb(handlers = {}) {
  const calls = {
    tables: [],
    eq: [],
    insert: [],
    select: [],
    maybeSingle: [],
    single: [],
  };

  mockFrom.mockReset();
  mockFrom.mockImplementation((table) => {
    calls.tables.push(table);
    const state = { table, op: null };
    const query = {
      select(columns) {
        state.op = "select";
        calls.select.push({ table, columns });
        return query;
      },
      eq(column, value) {
        calls.eq.push([table, column, value]);
        return query;
      },
      insert(rows) {
        state.op = "insert";
        calls.insert.push({ table, rows });
        return query;
      },
      maybeSingle() {
        calls.maybeSingle.push(table);
        const result = handlers.maybeSingle
          ? handlers.maybeSingle(state, table, calls)
          : { data: null, error: null };
        return Promise.resolve(result);
      },
      single() {
        calls.single.push(table);
        const result = handlers.single
          ? handlers.single(state, table, calls)
          : { data: null, error: null };
        return Promise.resolve(result);
      },
      then(onFulfilled, onRejected) {
        const result = handlers[state.op]
          ? handlers[state.op](state, table, calls)
          : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return query;
  });

  return calls;
}

const ORDER_ID = "ord-1";
const USER_ID = "t-user-a";

const orderRow = { id: ORDER_ID, user_id: USER_ID, status: "delivered" };

const createdReturn = {
  id: "ret-1",
  order_id: ORDER_ID,
  user_id: USER_ID,
  reason: "damaged",
  notes: "Cracked screen",
  created_at: "2026-11-20T10:00:00.000Z",
};

describe("POST /api/orders/:id/return", () => {
  let server;
  let base;
  let userHeaders;

  beforeAll(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://127.0.0.1:${server.address().port}`;
          userHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${signUserToken({
              id: USER_ID,
              email: "a@test.local",
              role: "user",
            })}`,
          };
          resolve();
        });
      })
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    mockFrom.mockReset();
  });

  const post = (path, body, headers) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("requires auth and never queries the database without a token", async () => {
    const calls = makeDb();

    const res = await post(
      `/api/orders/${ORDER_ID}/return`,
      { reason: "damaged" },
      {
        "Content-Type": "application/json",
      }
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.tables).toEqual([]);
  });

  it("creates the return row scoped to the caller and returns 201 with the row", async () => {
    const calls = makeDb({
      maybeSingle: (state) =>
        state.table === "orders" ? { data: orderRow, error: null } : { data: null, error: null },
      single: () => ({ data: createdReturn, error: null }),
    });

    const res = await post(
      `/api/orders/${ORDER_ID}/return`,
      { reason: "damaged", notes: "Cracked screen" },
      userHeaders
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ return: createdReturn });
    expect(calls.eq).toContainEqual(["orders", "id", ORDER_ID]);
    expect(calls.eq).toContainEqual(["orders", "user_id", USER_ID]);
    expect(calls.insert).toEqual([
      {
        table: "returns",
        rows: [
          { order_id: ORDER_ID, user_id: USER_ID, reason: "damaged", notes: "Cracked screen" },
        ],
      },
    ]);
  });

  it("404s when the order is not the caller's, and never writes", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: null }) });

    const res = await post(`/api/orders/${ORDER_ID}/return`, { reason: "damaged" }, userHeaders);

    expect(res.status).toBe(404);
    expect(calls.insert).toEqual([]);
  });

  it("rejects a missing reason without touching the database", async () => {
    const calls = makeDb();

    const res = await post(`/api/orders/${ORDER_ID}/return`, {}, userHeaders);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.tables).toEqual([]);
  });

  it("rejects a reason that is not one of the four without touching the database", async () => {
    const calls = makeDb();

    const res = await post(`/api/orders/${ORDER_ID}/return`, { reason: "refund" }, userHeaders);

    expect(res.status).toBe(400);
    expect(calls.tables).toEqual([]);
  });

  it("returns 500 when the order lookup errors and never writes", async () => {
    const calls = makeDb({ maybeSingle: () => ({ data: null, error: { message: "boom" } }) });

    const res = await post(`/api/orders/${ORDER_ID}/return`, { reason: "damaged" }, userHeaders);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.insert).toEqual([]);
  });
});

describe("POST /api/orders", () => {
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

  const post = (body) =>
    fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const breakdownOrder = {
    items: [{ id: "p1", title: "Marvel T-Shirt", price: 999, quantity: 2 }],
    totalAmount: 1998,
    subtotal: 1998,
    discountAmount: 0,
    shippingFee: 0,
    couponCode: null,
  };

  it("stores the coupon price breakdown with the order and returns it", async () => {
    const calls = makeDb({
      single: () => ({
        data: {
          id: "ord-1",
          total_amount: 1998,
          subtotal: 1998,
          discount_amount: 0,
          shipping_fee: 0,
          coupon_code: null,
        },
        error: null,
      }),
    });

    const res = await post(breakdownOrder);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.order.subtotal).toBe(1998);
    expect(body.order.discount_amount).toBe(0);
    expect(body.order.shipping_fee).toBe(0);
    expect(body.order.coupon_code).toBeNull();
    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0].rows[0]).toMatchObject({
      subtotal: 1998,
      discount_amount: 0,
      shipping_fee: 0,
      coupon_code: null,
    });
  });

  it("retries the insert without the breakdown when the columns are missing", async () => {
    const calls = makeDb({
      single: () =>
        calls.insert.length === 1
          ? {
              data: null,
              error: {
                message: "Could not find the 'subtotal' column of 'orders' in the schema cache",
              },
            }
          : { data: { id: "ord-1", total_amount: 1998 }, error: null },
    });

    const res = await post(breakdownOrder);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.order.total_amount).toBe(1998);
    expect(calls.insert).toHaveLength(2);
    expect(calls.insert[0].rows[0]).toHaveProperty("subtotal");
    expect(calls.insert[1].rows[0]).not.toHaveProperty("subtotal");
  });

  it("rejects a negative breakdown amount without inserting", async () => {
    const calls = makeDb();

    const res = await post({ ...breakdownOrder, subtotal: -5 });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(calls.insert).toEqual([]);
  });

  it("rejects an over-long coupon code without inserting", async () => {
    const calls = makeDb();

    const res = await post({ ...breakdownOrder, couponCode: "A".repeat(33) });

    expect(res.status).toBe(400);
    expect(calls.insert).toEqual([]);
  });
});
