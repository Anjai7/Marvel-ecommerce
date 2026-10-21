// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  buildMedia,
  buildOffers,
  buildProductContent,
  buildRatings,
  buildReviews,
  buildVariants,
  profileFor,
} from "./seed_backend_content.js";

const headphone = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Aurora Headphones",
  category: "Headphones",
  price: "2499.00",
  image_url: "https://images.example.com/headphones.jpg",
};

const laptop = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Nova Laptop",
  category: "Laptops",
  price: "72999.00",
  image_url: "https://images.example.com/laptop.jpg",
};

describe("seed_backend_content builders", () => {
  it("derives category-specific content and fills every content column", () => {
    expect(profileFor("Headphones")).not.toBe(profileFor("Laptops"));

    const audio = buildProductContent(headphone);
    const computer = buildProductContent(laptop);

    expect(audio.brand).toBe("Marvel Audio");
    expect(computer.brand).toBe("Marvel Computing");
    expect(audio.sku).not.toBe(computer.sku);
    expect(audio.sku).toMatch(/^MRV-/);
    expect(audio.highlights.join(" ")).toMatch(/noise cancellation/i);
    expect(computer.highlights.join(" ")).toMatch(/processor/i);
    expect(JSON.stringify(audio.specifications)).toMatch(/Driver/);
    expect(JSON.stringify(computer.specifications)).toMatch(/Storage/);
    expect(audio.specifications).not.toEqual(computer.specifications);

    for (const key of [
      "brand",
      "sku",
      "offer_text",
      "warranty",
      "highlights",
      "specifications",
      "dimensions",
      "materials",
      "care_instructions",
      "certifications",
      "in_box",
      "delivery_info",
      "user_guide",
    ]) {
      expect(audio).toHaveProperty(key);
    }
    expect(audio.specifications[0].items[0]).toEqual({
      label: "Model",
      value: "Aurora Headphones",
    });
  });

  it("is deterministic: the same product produces identical rows on every run", () => {
    expect(buildProductContent(headphone)).toEqual(buildProductContent(headphone));
    expect(buildOffers(headphone)).toEqual(buildOffers(headphone));
    expect(buildReviews(headphone)).toEqual(buildReviews(headphone));
    expect(buildVariants(headphone)).toEqual(buildVariants(headphone));
    expect(buildMedia(headphone)).toEqual(buildMedia(headphone));
  });

  it("computes EMI amounts from the product's own price", () => {
    const audio = buildOffers(headphone);
    const computer = buildOffers(laptop);

    const emi = audio.filter((row) => row.kind === "emi");
    expect(emi).toHaveLength(4);
    expect(emi.map((row) => row.months)).toEqual([3, 6, 9, 12]);
    // 2499 / 6, rounded to two decimals, for the no-cost plan.
    expect(emi.find((row) => row.months === 6).amount).toBe(416.5);
    expect(emi.find((row) => row.months === 6).amount).not.toBe(
      computer.find((row) => row.kind === "emi" && row.months === 6).amount
    );

    expect(audio.filter((row) => row.kind === "bank")).toHaveLength(1);
    expect(audio.filter((row) => row.kind === "coupon")).toHaveLength(1);
    expect(audio.filter((row) => row.kind === "bank")[0].code).toMatch(/10$/);
  });

  it("creates a real rating spread and a per-product average", () => {
    const audio = buildRatings(headphone.id);
    const computer = buildRatings(laptop.id);

    expect(audio.length).toBeGreaterThanOrEqual(4);
    expect(new Set(audio).size).toBeGreaterThan(1);
    expect(audio.every((rating) => rating >= 1 && rating <= 5)).toBe(true);

    const average = (ratings) =>
      Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
    expect(average(audio)).not.toBe(average(computer));
  });

  it("creates reviews whose aggregate matches the rating rows", () => {
    const reviews = buildReviews(headphone);
    const ratings = buildRatings(headphone.id);

    expect(reviews).toHaveLength(ratings.length);
    expect(reviews.map((review) => review.rating)).toEqual(ratings);
    expect(reviews.every((review) => review.body.includes("Aurora Headphones"))).toBe(true);
    expect(new Set(reviews.map((review) => review.id)).size).toBe(reviews.length);
  });

  it("derives colours and sizes per category", () => {
    const audio = buildVariants(headphone);
    const computer = buildVariants(laptop);

    expect(audio.filter((row) => row.kind === "color").length).toBeGreaterThan(0);
    expect(audio.filter((row) => row.kind === "size").length).toBeGreaterThan(0);
    expect(audio.map((row) => row.label)).not.toEqual(computer.map((row) => row.label));
    expect(new Set(audio.map((row) => row.id)).size).toBe(audio.length);
    expect(audio.every((row) => row.is_active)).toBe(true);
  });

  it("seeds only the product's own image as hero media", () => {
    const media = buildMedia(headphone);

    expect(media).toEqual([
      {
        id: expect.any(String),
        product_id: headphone.id,
        url: headphone.image_url,
        kind: "hero",
        position: 0,
        is_active: true,
      },
    ]);
    expect(media.some((row) => row.url !== headphone.image_url)).toBe(false);
    expect(buildMedia({ ...headphone, image_url: null })).toEqual([]);
  });
});
