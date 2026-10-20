// @vitest-environment node
import { describe, it, expect } from "vitest";

import { includesInactive, isValidOrderValue } from "./guards.js";

/** Minimal Express response double: records the status and the JSON body. */
function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    headersSent: false,
    writableEnded: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      this.writableEnded = true;
      return this;
    },
  };
}

const inactiveRequest = () => ({ query: { includeInactive: "1" } });

describe("shared guard helpers", () => {
  it("includesInactive is false when the parameter is absent or off", async () => {
    await expect(includesInactive({ query: {} }, fakeRes(), [])).resolves.toBe(false);
    await expect(
      includesInactive({ query: { includeInactive: "0" } }, fakeRes(), [])
    ).resolves.toBe(false);
    await expect(
      includesInactive({ query: { includeInactive: "false" } }, fakeRes(), [])
    ).resolves.toBe(false);
  });

  it("includesInactive is true when an admin guard passes", async () => {
    const res = fakeRes();
    const guard = (req, guardRes, next) => next();

    await expect(includesInactive(inactiveRequest(), res, [guard])).resolves.toBe(true);
    expect(res.headersSent).toBe(false);
  });

  it("includesInactive fails closed when a guard answers 401", async () => {
    const res = fakeRes();
    const guard = (req, guardRes) => guardRes.status(401).json({ error: "Unauthorized" });

    await expect(includesInactive(inactiveRequest(), res, [guard])).resolves.toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("includesInactive fails closed when a guard calls next(error), never including inactive rows", async () => {
    const res = fakeRes();
    const erroringGuard = (req, guardRes, next) => next(new Error("guard exploded"));

    await expect(includesInactive(inactiveRequest(), res, [erroringGuard])).resolves.toBe(false);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "guard exploded" });
  });

  it("isValidOrderValue accepts integers and canonical strings only", () => {
    expect(isValidOrderValue(0)).toBe(true);
    expect(isValidOrderValue(12)).toBe(true);
    expect(isValidOrderValue("0")).toBe(true);
    expect(isValidOrderValue("12")).toBe(true);
    expect(isValidOrderValue("01")).toBe(false);
    expect(isValidOrderValue("1.5")).toBe(false);
    expect(isValidOrderValue("1e3")).toBe(false);
    expect(isValidOrderValue(null)).toBe(false);
    expect(isValidOrderValue(undefined)).toBe(false);
    expect(isValidOrderValue("")).toBe(false);
  });
});
