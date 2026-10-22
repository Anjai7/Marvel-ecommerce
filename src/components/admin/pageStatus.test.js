import { describe, expect, it } from "vitest";
import { pageStatusLabel } from "./pageStatus";

describe("pageStatusLabel", () => {
  const baseTime = new Date("2026-10-22T12:00:00Z");

  it("returns Draft when status is draft", () => {
    expect(pageStatusLabel({ status: "draft" }, baseTime)).toBe("Draft");
  });

  it("returns Archived when status is archived", () => {
    expect(pageStatusLabel({ status: "archived" }, baseTime)).toBe("Archived");
  });

  it("returns Scheduled when status is published and scheduled_at is in the future", () => {
    expect(
      pageStatusLabel({ status: "published", scheduled_at: "2026-10-22T13:00:00Z" }, baseTime)
    ).toBe("Scheduled");
  });

  it("returns Expired when status is published and expired_at is in the past", () => {
    expect(
      pageStatusLabel({ status: "published", expired_at: "2026-10-22T11:00:00Z" }, baseTime)
    ).toBe("Expired");
  });

  it("returns Published when status is published without future schedule or past expiry", () => {
    expect(
      pageStatusLabel({ status: "published", published_at: "2026-10-22T10:00:00Z" }, baseTime)
    ).toBe("Published");
  });

  it("falls through to Published for unknown non-draft non-archived status", () => {
    expect(pageStatusLabel({ status: "other" }, baseTime)).toBe("Published");
  });
});
