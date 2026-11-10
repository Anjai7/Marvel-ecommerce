import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminInlinePanel from "./AdminInlinePanel";

describe("AdminInlinePanel", () => {
  it("renders its title, subtitle and body in the page flow", () => {
    render(
      <AdminInlinePanel title="Edit Banner" subtitle="Fields save to the banners API">
        <p>The form lives here.</p>
      </AdminInlinePanel>
    );

    const panel = screen.getByRole("region", { name: "Edit Banner" });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("admin-inline-panel");
    expect(screen.getByText("Fields save to the banners API")).toBeVisible();
    expect(screen.getByText("The form lives here.")).toBeVisible();
  });

  it("renders nothing when it is closed", () => {
    const { container } = render(
      <AdminInlinePanel open={false} title="Edit Banner">
        <p>The form lives here.</p>
      </AdminInlinePanel>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("calls onClose from the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AdminInlinePanel title="Edit Banner" onClose={onClose}>
        <p>The form lives here.</p>
      </AdminInlinePanel>
    );

    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves the focus to the panel when it opens", () => {
    render(
      <AdminInlinePanel title="Edit Banner">
        <p>The form lives here.</p>
      </AdminInlinePanel>
    );

    // A keyboard user lands in the form instead of at the top of the page.
    expect(screen.getByRole("region", { name: "Edit Banner" })).toHaveFocus();
  });
});
