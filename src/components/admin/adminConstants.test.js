import { describe, expect, it } from "vitest";
import {
  EMPTY,
  LOW_STOCK_THRESHOLD,
  ORDER_STATUSES,
  displayInitial,
  displayValue,
  formatAdminDate,
  isLowStock,
} from "./adminConstants";

describe("displayValue", () => {
  it("uses the neutral dash only when the API has no value", () => {
    expect(displayValue(null)).toBe(EMPTY);
    expect(displayValue(undefined)).toBe(EMPTY);
    expect(displayValue("")).toBe(EMPTY);
    expect(displayValue("   ")).toBe(EMPTY);
    expect(EMPTY).toBe("—");
  });

  it("keeps real values, including zero and false", () => {
    expect(displayValue(0)).toBe(0);
    expect(displayValue(false)).toBe(false);
    expect(displayValue("Asha")).toBe("Asha");
    expect(displayValue(42)).toBe(42);
  });
});

describe("displayInitial", () => {
  it("abbreviates a real name", () => {
    expect(displayInitial("asha")).toBe("A");
    expect(displayInitial("  ben")).toBe("B");
  });

  it("never invents a person to abbreviate", () => {
    expect(displayInitial(null)).toBe(EMPTY);
    expect(displayInitial("")).toBe(EMPTY);
    expect(displayInitial(undefined)).toBe(EMPTY);
  });
});

describe("order statuses", () => {
  it("mirror the postgres order_status enum exactly", () => {
    expect(ORDER_STATUSES).toEqual(["pending", "processing", "shipped", "delivered", "cancelled"]);
    expect(ORDER_STATUSES).not.toContain("completed");
  });
});

describe("low stock threshold", () => {
  it("is one shared positive number", () => {
    expect(Number.isInteger(LOW_STOCK_THRESHOLD)).toBe(true);
    expect(LOW_STOCK_THRESHOLD).toBeGreaterThan(0);
  });

  it("bands real stock around the threshold", () => {
    expect(isLowStock(LOW_STOCK_THRESHOLD)).toBe(true);
    expect(isLowStock(LOW_STOCK_THRESHOLD + 1)).toBe(false);
    expect(isLowStock(1)).toBe(true);
    expect(isLowStock(0)).toBe(false);
    expect(isLowStock(null)).toBe(false);
    expect(isLowStock("3")).toBe(true);
  });
});

describe("formatAdminDate", () => {
  it("formats in the platform locale", () => {
    expect(formatAdminDate("2026-10-14T12:00:00Z")).toBe("14 Oct 2026");
  });

  it("never invents a date", () => {
    expect(formatAdminDate(null)).toBe(EMPTY);
    expect(formatAdminDate("")).toBe(EMPTY);
    expect(formatAdminDate("not-a-date")).toBe(EMPTY);
  });
});
