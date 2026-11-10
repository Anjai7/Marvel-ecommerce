import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Switch from "./Switch";

describe("Switch", () => {
  it("exposes the switch role and the checked state", () => {
    render(<Switch checked onChange={() => {}} slotProps={{ input: { "aria-label": "X" } }} />);

    const toggle = screen.getByRole("switch", { name: "X" });
    expect(toggle).toBeChecked();
  });

  it("reports the new state when it is toggled", async () => {
    const user = userEvent.setup();
    const seen = [];
    const onChange = vi.fn((event) => seen.push(event.target.checked));

    render(
      <Switch
        checked={false}
        onChange={onChange}
        slotProps={{ input: { "aria-label": "Electronics" } }}
      />
    );

    await user.click(screen.getByRole("switch", { name: "Electronics" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true]);
  });

  it("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Switch
        checked={false}
        onChange={onChange}
        slotProps={{ input: { "aria-label": "Electronics" } }}
      />
    );

    await user.tab();
    expect(screen.getByRole("switch", { name: "Electronics" })).toHaveFocus();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not fire while it is disabled", async () => {
    // A disabled Material switch sets `pointer-events: none` on the input,
    // so the pointer-events guard is switched off for this check.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();

    render(
      <Switch
        checked={false}
        disabled
        onChange={onChange}
        slotProps={{ input: { "aria-label": "Electronics" } }}
      />
    );

    const toggle = screen.getByRole("switch", { name: "Electronics" });
    expect(toggle).toBeDisabled();

    await user.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
