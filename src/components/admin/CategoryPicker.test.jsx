import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CategoryPicker from "./CategoryPicker";
import { apiFetchCategoryTree } from "../../api/contentApi";

vi.mock("../../api/contentApi", () => ({
  apiFetchCategoryTree: vi.fn(),
}));

const TREE = [
  {
    id: "c-electronics",
    name: "Electronics",
    level: 1,
    children: [
      {
        id: "c-mobiles",
        name: "Mobiles",
        level: 2,
        children: [{ id: "c-smartphones", name: "Smartphones", level: 3, children: [] }],
      },
      { id: "c-accessories", name: "Accessories", level: 2, children: [] },
    ],
  },
  {
    id: "c-fashion",
    name: "Fashion",
    level: 1,
    children: [{ id: "c-mens", name: "Men's Fashion", level: 2, children: [] }],
  },
];

const renderPicker = (props = {}) =>
  render(<CategoryPicker value={null} onChange={vi.fn()} {...props} />);

describe("CategoryPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchCategoryTree.mockResolvedValue({ categories: TREE });
  });

  it("groups options under their level-1 category and indents deeper levels", async () => {
    const { container } = renderPicker();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    await waitFor(() => expect(container.querySelectorAll("optgroup")).toHaveLength(2));

    const groups = [...container.querySelectorAll("optgroup")];
    expect(groups.map((group) => group.getAttribute("label"))).toEqual(["Electronics", "Fashion"]);

    const valuesOf = (group) => [...group.querySelectorAll("option")].map((o) => o.value);
    expect(valuesOf(groups[0])).toEqual(["c-mobiles", "c-smartphones", "c-accessories"]);
    expect(valuesOf(groups[1])).toEqual(["c-mens"]);

    // Level 3 is indented further than level 2.
    const levelTwo = groups[0].querySelector('option[value="c-mobiles"]');
    const levelThree = groups[0].querySelector('option[value="c-smartphones"]');
    expect(levelThree.textContent.length).toBeGreaterThan(levelTwo.textContent.length);
    expect(levelThree.textContent).toContain("Smartphones");

    const uncategorised = container.querySelector('option[value=""]');
    expect(uncategorised).toHaveTextContent("Uncategorised");
  });

  it("calls onChange with the selected category id and name", async () => {
    const onChange = vi.fn();
    renderPicker({ onChange });
    const select = await screen.findByRole("combobox");
    await screen.findByRole("option", { name: /Smartphones/ });

    fireEvent.change(select, { target: { value: "c-smartphones" } });

    expect(onChange).toHaveBeenCalledWith("c-smartphones", "Smartphones");
  });

  it("calls onChange(null, null) for the Uncategorised option", async () => {
    const onChange = vi.fn();
    renderPicker({ onChange });
    const select = await screen.findByRole("combobox");
    await screen.findByRole("option", { name: /Smartphones/ });

    fireEvent.change(select, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it("renders a disabled select and the error text when the tree fetch rejects", async () => {
    apiFetchCategoryTree.mockRejectedValueOnce(new Error("tree fetch boom"));

    renderPicker();

    const select = await screen.findByRole("combobox");
    await waitFor(() => expect(select).toBeDisabled());
    expect(screen.getByRole("alert")).toHaveTextContent("tree fetch boom");
  });
});
