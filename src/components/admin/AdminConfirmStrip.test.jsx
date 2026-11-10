import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminConfirmStrip from "./AdminConfirmStrip";

describe("AdminConfirmStrip", () => {
  it("states the question and the consequence before anything is written", () => {
    render(
      <AdminConfirmStrip
        open
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText("Delete 'Shop'?")).toBeVisible();
    expect(screen.getByText("This will remove the item.")).toBeVisible();
  });

  it("renders nothing when it is closed", () => {
    const { container } = render(
      <AdminConfirmStrip
        open={false}
        title="Delete?"
        message="..."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("calls onConfirm exactly once on Delete click", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AdminConfirmStrip
        open
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("gives the confirm button the danger styling when it is destructive", () => {
    render(
      <AdminConfirmStrip
        open
        destructive
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole("alertdialog")).toHaveClass("danger");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("chart-pill-btn-danger");
  });

  it("calls onCancel (not onConfirm) on Escape", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AdminConfirmStrip
        open
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables both buttons while the write it confirms is in flight", async () => {
    const user = userEvent.setup();

    render(
      <AdminConfirmStrip
        open
        pending
        title="Delete 'Shop'?"
        message="This will remove the item."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    const confirm = screen.getByRole("button", { name: "Deleting..." });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await waitFor(() => expect(confirm).toBeDisabled());
  });
});
