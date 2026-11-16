import { describe, expect, it } from "vitest";

import { OFFER_BADGE_MAX_LENGTH, offerBadgeLabel } from "./offers";

describe("the offer label", () => {
  it("keeps an offer that is already short", () => {
    expect(offerBadgeLabel("50% OFF")).toBe("50% OFF");
    expect(offerBadgeLabel("Limited time deal")).toBe("Limited time deal");
    expect(offerBadgeLabel("Save ₹500")).toBe("Save ₹500");
  });

  it("drops the figure a sentence starts from", () => {
    expect(offerBadgeLabel("No Cost EMI from ₹24,249.65/Month")).toBe("No Cost EMI");
    expect(offerBadgeLabel("No Cost EMI from ₹24,249.65")).toBe("No Cost EMI");
    expect(offerBadgeLabel("Free delivery onwards")).toBe("Free delivery");
  });

  it("says nothing when there is no offer", () => {
    expect(offerBadgeLabel("")).toBe("");
    expect(offerBadgeLabel("   ")).toBe("");
    expect(offerBadgeLabel(null)).toBe("");
    expect(offerBadgeLabel(undefined)).toBe("");
  });

  it("shortens an offer that is too long for a label", () => {
    const label = offerBadgeLabel("A very long offer that nobody could read in a corner");
    expect(label.length).toBeLessThanOrEqual(OFFER_BADGE_MAX_LENGTH);
    expect(label.endsWith("…")).toBe(true);
  });
});
