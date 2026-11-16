import { describe, expect, it } from "vitest";
import { generateProductCode } from "./productCode";

describe("generateProductCode", () => {
  it("generates LAP001 for laptop products", () => {
    expect(generateProductCode("Pro Gaming Laptop", "Electronics", 1)).toBe("LAP001");
    expect(generateProductCode("MacBook Air", "Computers", "p-102")).toBe("LAP102");
  });

  it("generates PHO001 for phone products", () => {
    expect(generateProductCode("iPhone 16 Pro", "Mobile Phones", 1)).toBe("PHO001");
  });

  it("generates AUD001 for audio products", () => {
    expect(generateProductCode("Noise-Canceling Headphones", "Audio", 5)).toBe("AUD005");
  });

  it("generates WAT001 for watch products", () => {
    expect(generateProductCode("Smart Watch Series 9", "Wearables", 12)).toBe("WAT012");
  });

  it("falls back to category-based prefix for other products", () => {
    const code = generateProductCode("Modern Sofa", "Furniture", 1);
    expect(code).toBe("FUR001");
  });
});
