import { describe, expect, it } from "vitest";
import {
  CURRENCY,
  CURRENCY_LOCALE,
  CURRENCY_SYMBOL,
  formatAmount,
  formatCurrency,
} from "./currency";

describe("formatCurrency", () => {
  it("uses the rupee symbol", () => {
    expect(CURRENCY_SYMBOL).toBe("₹");
    expect(CURRENCY).toBe("INR");
    expect(CURRENCY_LOCALE).toBe("en-IN");
    expect(formatCurrency(100)).toBe("₹100");
  });

  it("groups thousands the Indian way", () => {
    expect(formatCurrency(123456.75)).toBe("₹1,23,456.75");
    expect(formatCurrency(1234.5)).toBe("₹1,234.5");
  });

  it("keeps at most two decimals and never pads them", () => {
    expect(formatCurrency(2499)).toBe("₹2,499");
    expect(formatCurrency(2499.5)).toBe("₹2,499.5");
    expect(formatCurrency(2499.567)).toBe("₹2,499.57");
  });

  it("can drop the decimals for tight spaces such as chart axes", () => {
    expect(formatCurrency(2499.5, { decimals: 0 })).toBe("₹2,500");
    expect(formatCurrency(1234567, { decimals: 0 })).toBe("₹12,34,567");
  });

  it("never renders NaN, undefined or an empty amount", () => {
    expect(formatCurrency(null)).toBe("₹0");
    expect(formatCurrency(undefined)).toBe("₹0");
    expect(formatCurrency("not a number")).toBe("₹0");
    expect(formatCurrency(NaN)).toBe("₹0");
  });

  it("accepts the numeric string a database column carries", () => {
    expect(formatCurrency("4531610.11")).toBe("₹45,31,610.11");
  });
});

describe("formatAmount", () => {
  it("formats the same amount without the symbol", () => {
    expect(formatAmount(123456.75)).toBe("1,23,456.75");
    expect(formatAmount("4531610.11")).toBe("45,31,610.11");
  });

  it("never renders NaN or undefined", () => {
    expect(formatAmount(null)).toBe("0");
    expect(formatAmount("not a number")).toBe("0");
  });
});
