import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductVariantsEditor from "./ProductVariantsEditor";
import { apiFetch } from "../../api/client";

vi.mock("../../api/client", () => ({
  apiFetch: vi.fn(),
  getStoredToken: vi.fn(() => null),
  setStoredToken: vi.fn(),
  API_BASE_URL: "/api",
}));

/** Two kinds, two values each — the smallest matrix worth testing. */
const TWO_OPTIONS = {
  variants: [
    { kind: "color", label: "Black", value: "#000000", option_value_id: null },
    { kind: "color", label: "White", value: "#ffffff", option_value_id: null },
    { kind: "size", label: "M", value: "M", option_value_id: null },
    { kind: "size", label: "L", value: "L", option_value_id: null },
  ],
  combinations: [
    {
      sku: "BLACK-M",
      price: 4999,
      stock: 25,
      image_url: "",
      options: [
        { kind: "color", label: "Black", value: "#000000" },
        { kind: "size", label: "M", value: "M" },
      ],
    },
    {
      sku: "WHITE-L",
      price: 4999,
      stock: 25,
      image_url: "",
      options: [
        { kind: "color", label: "White", value: "#ffffff" },
        { kind: "size", label: "L", value: "L" },
      ],
    },
  ],
};

/**
 * The editor is controlled, so the test drives it the way the console does:
 * the harness holds the state and hands the next state back to the component.
 */
function Harness({ initialValue, onChange, ...rest }) {
  const [state, setState] = useState(initialValue);
  return (
    <ProductVariantsEditor
      value={state}
      onChange={(next) => {
        setState(next);
        onChange(next);
      }}
      {...rest}
    />
  );
}

const lastCall = (onChange) => onChange.mock.calls.at(-1)[0];

/** Pick an option type from the dropdown — its block then offers a value input. */
async function addOptionKind(user, kind) {
  await user.selectOptions(screen.getByTestId("product-variants-add-kind-select"), kind);
  await user.click(screen.getByTestId("product-variants-add-kind-button"));
}

/** Let the catalogue request settle inside act(), so no state update escapes. */
async function flushCatalogue() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ values: [] });
});

describe("ProductVariantsEditor", () => {
  it("renders the options it is given, with their values as chips", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initialValue={TWO_OPTIONS}
        onChange={onChange}
        category="Electronics"
        productPrice={4999}
        productStock={25}
      />
    );

    expect(screen.getByTestId("product-variants-option-color")).toBeInTheDocument();
    expect(screen.getByTestId("product-variants-option-size")).toBeInTheDocument();
    expect(screen.getByTestId("product-variants-chip-color-Black")).toHaveTextContent("Black");
    expect(screen.getByTestId("product-variants-chip-color-White")).toHaveTextContent("White");
    expect(screen.getByTestId("product-variants-chip-size-M")).toHaveTextContent("M");
    expect(screen.getByTestId("product-variants-chip-size-L")).toHaveTextContent("L");
  });

  it("says so when the product has no options", () => {
    const onChange = vi.fn();
    render(<Harness initialValue={{ variants: [], combinations: [] }} onChange={onChange} />);

    expect(screen.getByTestId("product-variants-empty")).toHaveTextContent(
      "This product has no options"
    );
    expect(screen.queryByTestId("product-variants-generate")).not.toBeInTheDocument();
  });

  it("adds a value when the admin types one and presses Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initialValue={TWO_OPTIONS}
        onChange={onChange}
        category="Electronics"
        productPrice={4999}
        productStock={25}
      />
    );

    await user.type(screen.getByTestId("product-variants-value-input-size"), "XL{Enter}");

    const next = lastCall(onChange);
    expect(next.variants).toContainEqual({
      kind: "size",
      label: "XL",
      value: "XL",
      option_value_id: null,
    });
    expect(screen.getByTestId("product-variants-chip-size-XL")).toBeInTheDocument();
  });

  it("keeps the hex a colour value was given", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue={{ variants: [], combinations: [] }} onChange={onChange} />);
    await addOptionKind(user, "color");

    await user.type(screen.getByTestId("product-variants-value-input-color"), "Blue");
    await user.type(screen.getByTestId("product-variants-hex-input-color"), "#2563eb");
    await user.click(screen.getByTestId("product-variants-add-value-color"));

    expect(lastCall(onChange).variants).toContainEqual({
      kind: "color",
      label: "Blue",
      value: "#2563eb",
      option_value_id: null,
    });
  });

  it("removes a value and leaves it out of the next value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue={TWO_OPTIONS} onChange={onChange} />);

    await user.click(screen.getByTestId("product-variants-remove-value-size-M"));

    const next = lastCall(onChange);
    expect(next.variants.some((entry) => entry.label === "M")).toBe(false);
    expect(next.variants.some((entry) => entry.label === "L")).toBe(true);
  });

  it("generates every combination of the chosen values, priced like the product", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initialValue={{ variants: TWO_OPTIONS.variants, combinations: [] }}
        onChange={onChange}
        category="Electronics"
        productPrice={4999}
        productStock={25}
      />
    );

    await user.click(screen.getByTestId("product-variants-generate"));

    const next = lastCall(onChange);
    expect(next.combinations).toHaveLength(4);
    expect(
      next.combinations.map((combo) => combo.options.map((option) => option.label).join("/"))
    ).toEqual(["Black/M", "Black/L", "White/M", "White/L"]);
    for (const combo of next.combinations) {
      expect(combo.price).toBe(4999);
      expect(combo.stock).toBe(25);
      expect(combo.sku).toBe("");
      expect(combo.image_url).toBe("");
      expect(combo.options).toHaveLength(2);
    }
  });

  it("edits the price of a combination", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initialValue={TWO_OPTIONS}
        onChange={onChange}
        category="Electronics"
        productPrice={4999}
        productStock={25}
      />
    );

    await user.clear(screen.getByTestId("product-variants-price-0"));
    await user.type(screen.getByTestId("product-variants-price-0"), "1999");

    expect(lastCall(onChange).combinations[0].price).toBe(1999);
  });

  it("writes null, not zero, for an emptied price", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue={TWO_OPTIONS} onChange={onChange} />);

    await user.clear(screen.getByTestId("product-variants-price-0"));

    expect(lastCall(onChange).combinations[0].price).toBeNull();
  });

  it("removes the combinations that used a removed option value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue={TWO_OPTIONS} onChange={onChange} />);

    await user.click(screen.getByTestId("product-variants-remove-value-color-Black"));

    const next = lastCall(onChange);
    expect(next.combinations).toHaveLength(1);
    expect(next.combinations[0].options.every((option) => option.label !== "Black")).toBe(true);
  });

  it("removes an option type together with its values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue={TWO_OPTIONS} onChange={onChange} />);

    await user.click(screen.getByTestId("product-variants-remove-option-size"));

    const next = lastCall(onChange);
    expect(next.variants.every((entry) => entry.kind !== "size")).toBe(true);
    expect(next.combinations).toHaveLength(0);
  });

  it("offers the suggestions of the category and adds what they promise", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        initialValue={{ variants: [], combinations: [] }}
        onChange={onChange}
        category="Electronics"
        productPrice={4999}
        productStock={25}
      />
    );

    const suggestion = screen.getByTestId("product-variants-suggestion-storage");
    expect(suggestion).toHaveTextContent("Add suggested:");
    expect(suggestion).toHaveTextContent("64GB");

    await user.click(suggestion);

    const next = lastCall(onChange);
    expect(next.variants.every((entry) => entry.kind === "storage")).toBe(true);
    expect(next.variants.map((entry) => entry.label)).toEqual(["64GB", "128GB", "256GB", "512GB"]);
    // The kind is used now, so it is not offered a second time.
    expect(screen.queryByTestId("product-variants-suggestion-storage")).not.toBeInTheDocument();
  });

  it("links a value the store already knows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    apiFetch.mockResolvedValue({
      values: [{ id: "ov-1", kind: "color", label: "Blue", value: "#2563eb" }],
    });

    render(<Harness initialValue={{ variants: [], combinations: [] }} onChange={onChange} />);
    await flushCatalogue();
    await addOptionKind(user, "color");

    await user.type(screen.getByTestId("product-variants-value-input-color"), "Blue{Enter}");

    expect(lastCall(onChange).variants).toContainEqual({
      kind: "color",
      label: "Blue",
      value: "#2563eb",
      option_value_id: "ov-1",
    });
  });

  it("carries on when the catalogue endpoint is missing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    apiFetch.mockRejectedValue(new Error("Request failed with status 404"));

    render(<Harness initialValue={{ variants: [], combinations: [] }} onChange={onChange} />);
    await flushCatalogue();

    expect(screen.getByTestId("product-variants-empty")).toBeInTheDocument();

    await addOptionKind(user, "size");
    await user.type(screen.getByTestId("product-variants-value-input-size"), "XL{Enter}");

    expect(lastCall(onChange).variants).toContainEqual({
      kind: "size",
      label: "XL",
      value: "XL",
      option_value_id: null,
    });
  });
});
