import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SectionListEditor from "./SectionListEditor";

/**
 * The section builder: the generated form and the ordered list.
 *
 * The form is derived from the catalogue, so these tests read the catalogue
 * too — a new section type must never need a change here.
 */

const HERO = {
  uid: "s1",
  id: "s1",
  type: "hero",
  enabled: true,
  data: {
    heading: "Diwali Sale",
    eyebrow: "",
    subheading: "",
    image_url: "",
    image_alt: "",
    cta_label: "Shop now",
    cta_href: "#/",
    theme: "light",
  },
  style: {
    background: "none",
    padding_top: "md",
    padding_bottom: "md",
    max_width: "content",
    align: "left",
  },
};

const RICHTEXT = {
  uid: "s2",
  id: "s2",
  type: "richtext",
  enabled: true,
  data: { body: "The festive sale is here.", align: "left" },
  style: {
    background: "none",
    padding_top: "md",
    padding_bottom: "md",
    max_width: "content",
    align: "left",
  },
};

/** A controlled host, so the list can be reordered the way the editor does. */
function Harness({ initial, onChange }) {
  const [sections, setSections] = useState(initial);
  return (
    <SectionListEditor
      sections={sections}
      onChange={(next) => {
        setSections(next);
        onChange?.(next);
      }}
    />
  );
}

const renderList = (initial = [HERO, RICHTEXT], onChange) =>
  render(<Harness initial={initial} onChange={onChange} />);

describe("SectionListEditor", () => {
  it("renders one card per section, in order", () => {
    renderList();

    const cards = screen.getAllByTestId(/^section-card-/);
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Hero banner")).toBeVisible();
    expect(within(cards[0]).getByText("Position 1 of 2")).toBeVisible();
    expect(within(cards[1]).getByText("Rich text")).toBeVisible();
    expect(within(cards[1]).getByText("Position 2 of 2")).toBeVisible();
  });

  it("generates the form controls from the catalogue and derives their labels", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("button", { name: "Edit Hero banner 1" }));

    const dialog = await screen.findByRole("dialog");
    // The labels come from the field names: cta_label → "CTA Label".
    expect(within(dialog).getByLabelText("Heading *")).toBeVisible();
    expect(within(dialog).getByLabelText("Eyebrow")).toBeVisible();
    expect(within(dialog).getByLabelText("CTA Label")).toBeVisible();
    expect(within(dialog).getByLabelText("CTA Href")).toBeVisible();
    expect(within(dialog).getByLabelText("Theme")).toBeVisible();
    // The shared layout block is generated from the shared style rules.
    expect(within(dialog).getByLabelText("Background")).toBeVisible();
    expect(within(dialog).getByLabelText("Padding Top")).toBeVisible();
  });

  it("reports a field the catalogue does not know about", async () => {
    const user = userEvent.setup();
    renderList([{ ...HERO, data: { ...HERO.data, mystery: "x" } }]);

    await user.click(screen.getByRole("button", { name: "Edit Hero banner 1" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "hero.mystery is not a known field."
    );
  });

  it("lists every catalogue type in the add-section picker", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("button", { name: "Add section" }));

    const dialog = await screen.findByRole("dialog");
    for (const label of [
      "Hero banner",
      "Rich text",
      "Image",
      "Image gallery",
      "Product grid",
      "Category grid",
      "Promotional banner",
      "Call to action",
      "FAQ",
      "Video",
      "Category product listing",
      "Spacer",
    ]) {
      expect(within(dialog).getByRole("button", { name: label })).toBeVisible();
    }
  });

  it("moves the focus to the moved card and announces the move", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderList([HERO, RICHTEXT], onChange);

    await user.click(screen.getByRole("button", { name: "Move down Hero banner 1" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((section) => section.uid)).toEqual(["s2", "s1"]);

    // The announcement is polite, atomic and already in the markup.
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Hero banner moved to position 2 of 2.");

    // The focus follows the moved card, so a keyboard user keeps their place.
    await waitFor(() => expect(screen.getByTestId("section-card-s1")).toHaveFocus());
  });

  it("appends a new section with the defaults of its type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderList([HERO], onChange);

    await user.click(screen.getByRole("button", { name: "Add section" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Spacer" }));

    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(2);
    expect(next[1].type).toBe("spacer");
    expect(next[1].id).toBeNull();
    expect(next[1].data.height).toBe(48);
  });
});
