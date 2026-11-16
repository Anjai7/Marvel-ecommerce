// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  OPTION_KIND_LABELS,
  OPTION_KINDS,
  formatOptionChoices,
  formatOptionValues,
  isOptionKind,
} from "./productOptions";
import {
  OPTION_KIND_LABELS as SERVER_OPTION_KIND_LABELS,
  OPTION_KINDS as SERVER_OPTION_KINDS,
  isOptionKind as serverIsOptionKind,
} from "../../server/lib/productOptions";

/**
 * The admin form and the API must agree on the option kinds.
 *
 * The two lists live in separate files because the browser bundle must not
 * import from `server/`, so nothing but this test keeps them in step: a kind
 * added to one copy and forgotten in the other is a kind the admin can offer
 * and the API rejects (or worse, one the API accepts and the admin cannot
 * build).
 */
describe("option kinds", () => {
  it("the admin list and the server list are identical, in the same order", () => {
    expect(OPTION_KINDS).toEqual(SERVER_OPTION_KINDS);
    expect(OPTION_KINDS).toStrictEqual(SERVER_OPTION_KINDS);
  });

  it("the admin label map and the server label map are identical", () => {
    expect(OPTION_KIND_LABELS).toEqual(SERVER_OPTION_KIND_LABELS);
  });

  it("the kinds are the eight the contract lists", () => {
    expect(OPTION_KINDS).toEqual([
      "color",
      "size",
      "capacity",
      "storage",
      "material",
      "style",
      "weight",
      "flavour",
    ]);
  });

  it("every kind has a label", () => {
    for (const kind of OPTION_KINDS) {
      expect(OPTION_KIND_LABELS[kind]).toBeTruthy();
    }
    expect(Object.keys(OPTION_KIND_LABELS).sort()).toEqual([...OPTION_KINDS].sort());
  });

  it("both copies answer the same question about a kind", () => {
    for (const kind of OPTION_KINDS) {
      expect(isOptionKind(kind)).toBe(true);
      expect(serverIsOptionKind(kind)).toBe(true);
    }
    for (const kind of ["colour", "Size", "", null, undefined, "other"]) {
      expect(isOptionKind(kind)).toBe(false);
      expect(serverIsOptionKind(kind)).toBe(false);
    }
  });
});

describe("the customer's choice", () => {
  it("reads as one line: the axis and the choice", () => {
    expect(
      formatOptionChoices([
        { kind: "color", label: "Blue", value: "#2563eb" },
        { kind: "size", label: "M", value: "M" },
      ])
    ).toBe("Colour: Blue · Size: M");
  });

  it("drops a hex colour and falls back to the value when there is no label", () => {
    expect(formatOptionChoices([{ kind: "color", label: "Blue", value: "#2563eb" }])).toBe(
      "Colour: Blue"
    );
    expect(formatOptionChoices([{ kind: "color", value: "#2563eb" }])).toBe("");
    expect(formatOptionChoices([{ kind: "size", value: "UK 9" }])).toBe("Size: UK 9");
  });

  it("reads as a short line when the axis is not needed", () => {
    expect(
      formatOptionValues([
        { kind: "color", label: "Blue", value: "#2563eb" },
        { kind: "size", label: "M", value: "M" },
      ])
    ).toBe("Blue / M");
  });

  it("says nothing when there is nothing to say", () => {
    expect(formatOptionChoices([])).toBe("");
    expect(formatOptionChoices(undefined)).toBe("");
    expect(formatOptionValues(null)).toBe("");
    expect(formatOptionChoices([{ kind: "color", value: "#2563eb" }])).toBe("");
  });
});
