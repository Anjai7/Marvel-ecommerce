import { describe, expect, it } from "vitest";
import { LOW_STOCK_THRESHOLD, ORDER_STATUSES } from "./adminConstants";
import {
  aggregateBestSellers,
  computeRepeatCustomers,
  customerStats,
  lastNDayBuckets,
  revenueGrowth,
  salesWindows,
  summarizeInventory,
  summarizeStatuses,
} from "./reportUtils";

const NOW = new Date("2026-10-14T12:00:00Z");
const isoDaysAgo = (n, h = 10) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
};

const ORDERS = [
  {
    id: "a1",
    customer_name: "Asha",
    customer_email: "asha@x.com",
    total_amount: 100,
    status: "delivered",
    created_at: isoDaysAgo(0),
    items: [{ title: "Headphones", price: 100, quantity: 1, image: "img-h" }],
  },
  {
    id: "a2",
    customer_name: "Asha",
    customer_email: "asha@x.com",
    total_amount: 200,
    status: "shipped",
    created_at: isoDaysAgo(1),
    items: [{ title: "Watch", price: 100, quantity: 2 }],
  },
  {
    id: "b1",
    customer_name: "Ben",
    customer_email: "ben@x.com",
    total_amount: "50.5",
    status: "processing",
    created_at: isoDaysAgo(2),
    items: [{ title: "Headphones", price: 50.5, quantity: 1 }],
  },
  {
    id: "c1",
    customer_name: "Cid",
    customer_email: "",
    total_amount: 75,
    status: "pending",
    created_at: isoDaysAgo(9),
    items: [],
  },
  {
    id: "d1",
    customer_name: "Dee",
    total_amount: null,
    status: "cancelled",
    created_at: null,
    items: null,
  },
];

describe("lastNDayBuckets", () => {
  it("buckets real revenue per day with honest zeros", () => {
    const buckets = lastNDayBuckets(ORDERS, 3, NOW);
    expect(buckets).toHaveLength(3);
    const totals = buckets.map((b) => b.revenue);
    expect(totals.reduce((a, b) => a + b, 0)).toBeCloseTo(350.5, 5);
    expect(buckets[buckets.length - 1].ordersCount).toBe(1);
    for (const b of buckets) {
      expect(b.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof b.label).toBe("string");
      expect(typeof b.day).toBe("string");
    }
    // en-IN orders day before month: "14 Oct", not "Oct 14".
    expect(buckets[buckets.length - 1].label).toMatch(/^\d{1,2} \w{3}$/);
  });

  it("returns empty buckets for no orders", () => {
    const buckets = lastNDayBuckets([], 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.revenue === 0 && b.ordersCount === 0)).toBe(true);
  });
});

describe("salesWindows", () => {
  it("splits today / yesterday / this month / last month", () => {
    const w = salesWindows(ORDERS, NOW);
    expect(w.today.revenue).toBeCloseTo(100, 5);
    expect(w.today.orders).toBe(1);
    expect(w.yesterday.revenue).toBeCloseTo(200, 5);
    expect(w.thisMonth.orders).toBeGreaterThanOrEqual(3);
    expect(w.lastMonth.orders).toBeGreaterThanOrEqual(0);
  });
});

describe("revenueGrowth", () => {
  it("compares last 7 days against the prior 7 days", () => {
    const g = revenueGrowth(ORDERS, NOW);
    expect(g.previous).toBeCloseTo(75, 5);
    expect(g.current).toBeCloseTo(350.5, 5);
    expect(g.percent).toBeCloseTo(((350.5 - 75) / 75) * 100, 5);
  });

  it("returns null percent when there is no prior revenue", () => {
    const g = revenueGrowth([ORDERS[0]], NOW);
    expect(g.percent).toBeNull();
  });
});

describe("summarizeStatuses", () => {
  it("counts every pipeline stage", () => {
    const s = summarizeStatuses(ORDERS);
    expect(s).toMatchObject({
      total: 5,
      delivered: 1,
      shipped: 1,
      processing: 1,
      pending: 1,
      cancelled: 1,
      inFlight: 2,
    });
  });

  it("reports exactly the database order_status enum and nothing more", () => {
    const summary = summarizeStatuses(ORDERS);
    const stages = Object.keys(summary)
      .filter((key) => key !== "total" && key !== "inFlight")
      .sort();
    expect(stages).toEqual([...ORDER_STATUSES].sort());
    expect(summary).not.toHaveProperty("completed");
  });

  it("does not report an order with no status as a stage", () => {
    const summary = summarizeStatuses([{ id: "x1", total_amount: 10 }]);
    expect(summary.total).toBe(1);
    expect(ORDER_STATUSES.every((stage) => summary[stage] === 0)).toBe(true);
  });
});

describe("computeRepeatCustomers", () => {
  it("groups by email and ranks repeat buyers by spend", () => {
    const r = computeRepeatCustomers(ORDERS);
    expect(r.totalCustomers).toBe(4); // asha, ben, guest-cid, guest-dee
    expect(r.repeatCustomers).toBe(1);
    expect(r.repeatRate).toBeCloseTo(25, 5);
    expect(r.top[0]).toMatchObject({ email: "asha@x.com", orders: 2, spent: 300 });
  });

  it("falls back to user_id when email is missing", () => {
    const r = computeRepeatCustomers([
      { id: "1", user_id: "u9", total_amount: 10, created_at: isoDaysAgo(0), items: [] },
      { id: "2", user_id: "u9", total_amount: 20, created_at: isoDaysAgo(0), items: [] },
    ]);
    expect(r.repeatCustomers).toBe(1);
    expect(r.top[0].key).toBe("u9");
  });

  it("keys a signed-in buyer by user_id, not by their email", () => {
    const r = computeRepeatCustomers([
      { id: "1", user_id: "u1", customer_email: "old@x.com", total_amount: 10 },
      { id: "2", user_id: "u1", customer_email: "new@x.com", total_amount: 20 },
    ]);
    expect(r.totalCustomers).toBe(1);
    expect(r.repeatCustomers).toBe(1);
    expect(r.top[0]).toMatchObject({ key: "u1", orders: 2, spent: 30 });
  });

  it("never special-cases an email address", () => {
    const r = computeRepeatCustomers([
      { id: "1", customer_email: "user@marvel.com", total_amount: 10 },
      { id: "2", customer_email: "user@marvel.com", total_amount: 20 },
    ]);
    expect(r.totalCustomers).toBe(1);
    expect(r.repeatCustomers).toBe(1);
    expect(r.top[0]).toMatchObject({ email: "user@marvel.com", orders: 2, spent: 30 });
  });

  it("leaves a missing customer name null instead of inventing one", () => {
    const r = computeRepeatCustomers([
      { id: "1", customer_email: "x@y.z", total_amount: 5 },
      { id: "2", customer_email: "x@y.z", total_amount: 5 },
    ]);
    expect(r.top[0].name).toBeNull();
  });
});

describe("aggregateBestSellers", () => {
  it("aggregates quantity and revenue per title", () => {
    const top = aggregateBestSellers(ORDERS, 5);
    expect(top[0]).toMatchObject({ title: "Watch", qty: 2, revenue: 200 });
    expect(top.find((t) => t.title === "Headphones")).toMatchObject({ qty: 2, revenue: 150.5 });
    expect(top.every((t) => typeof t.title === "string")).toBe(true);
  });

  it("does not invent a product name for an untitled line item", () => {
    const top = aggregateBestSellers([
      {
        id: "o1",
        items: [
          { price: 100, quantity: 1 },
          { title: "Watch", price: 50, quantity: 1 },
        ],
      },
    ]);
    expect(top).toHaveLength(1);
    expect(top[0].title).toBe("Watch");
  });
});

describe("summarizeInventory", () => {
  it("splits stock bands and values inventory", () => {
    const s = summarizeInventory([
      { id: 1, price: 100, stock: 10 },
      { id: 2, price: 50, stock: 3 },
      { id: 3, price: 20, stock: 0 },
      { id: 4, price: "9.99", stock: "7" },
    ]);
    expect(s).toMatchObject({ total: 4, inStock: 3, lowStock: 1, outOfStock: 1 });
    expect(s.value).toBeCloseTo(100 * 10 + 50 * 3 + 9.99 * 7, 2);
  });

  it("bands low stock on the one shared threshold", () => {
    expect(summarizeInventory([{ price: 1, stock: LOW_STOCK_THRESHOLD }]).lowStock).toBe(1);
    expect(summarizeInventory([{ price: 1, stock: LOW_STOCK_THRESHOLD + 1 }]).lowStock).toBe(0);
  });
});

describe("customerStats", () => {
  it("joins registered customers with their order history", () => {
    const users = [
      { id: "u1", full_name: "Asha", email: "asha@x.com", role: "user", status: "active" },
      { id: "u2", full_name: "Ben", email: "ben@x.com", role: "user", status: "active" },
      { id: "u3", full_name: "Vee", email: "vee@x.com", role: "vendor", status: "active" },
    ];
    const stats = customerStats(users, ORDERS);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ name: "Asha", orders: 2, spent: 300, repeat: true });
    expect(stats[1]).toMatchObject({ name: "Ben", orders: 1, spent: 50.5, repeat: false });
  });

  it("leaves a missing name and status empty instead of inventing them", () => {
    const stats = customerStats([{ id: "u4", email: "nameless@x.com", role: "user" }], []);
    expect(stats[0]).toMatchObject({ name: null, status: "", orders: 0, spent: 0 });
  });

  it("keeps the real customer segment rule (role === user only)", () => {
    const stats = customerStats(
      [
        { id: "a", email: "a@x.com", role: "user" },
        { id: "b", email: "b@x.com", role: "admin" },
        { id: "c", email: "c@x.com", role: "vendor" },
      ],
      []
    );
    expect(stats.map((s) => s.id)).toEqual(["a"]);
  });
});
