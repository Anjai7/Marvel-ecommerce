import { describe, expect, it } from "vitest";
import { buildAlerts } from "./adminAlerts";

const NOW = new Date("2026-10-21T12:00:00.000Z");

const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("buildAlerts", () => {
  it("raises nothing when there is nothing to act on", () => {
    expect(
      buildAlerts({
        orders: [{ status: "delivered" }],
        products: [{ stock: 40, moderation_status: "approved" }],
        users: [{ role: "user", created_at: daysAgo(40) }],
        now: NOW,
      })
    ).toEqual([]);
  });

  it("counts pending orders and sends the admin to the orders tab", () => {
    const alerts = buildAlerts({
      orders: [{ status: "pending" }, { status: "pending" }, { status: "delivered" }],
      products: [],
      users: [],
      now: NOW,
    });

    const pending = alerts.find((alert) => alert.id === "orders-pending");
    expect(pending).toBeDefined();
    expect(pending.title).toContain("2 orders");
    expect(pending.tab).toBe("orders");
  });

  it("counts orders in flight", () => {
    const alerts = buildAlerts({
      orders: [{ status: "processing" }, { status: "shipped" }],
      products: [],
      users: [],
      now: NOW,
    });

    expect(alerts.find((alert) => alert.id === "orders-inflight")?.title).toContain("2 orders");
  });

  it("counts products awaiting moderation and low on stock", () => {
    const alerts = buildAlerts({
      orders: [],
      products: [
        { stock: 2, moderation_status: "pending" },
        { stock: 1, moderation_status: "approved" },
        { stock: 500, moderation_status: "approved" },
      ],
      users: [],
      now: NOW,
    });

    expect(alerts.find((alert) => alert.id === "products-moderation")?.title).toContain(
      "1 product"
    );
    expect(alerts.find((alert) => alert.id === "products-low-stock")?.title).toContain(
      "2 products"
    );
  });

  it("counts only customers registered in the last seven days", () => {
    const alerts = buildAlerts({
      orders: [],
      products: [],
      users: [
        { role: "user", created_at: daysAgo(1) },
        { role: "user", created_at: daysAgo(3) },
        { role: "user", created_at: daysAgo(30) },
        { role: "vendor", created_at: daysAgo(1) },
      ],
      now: NOW,
    });

    expect(alerts.find((alert) => alert.id === "customers-new")?.title).toContain(
      "2 new customers"
    );
  });

  it("never invents an alert from a missing row", () => {
    const alerts = buildAlerts({
      orders: [null, undefined, { status: null }],
      products: [null, { stock: null, moderation_status: null }],
      users: [null, { role: "user", created_at: null }],
      now: NOW,
    });

    expect(alerts).toEqual([]);
  });
});
