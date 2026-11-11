import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  it("reports the typed term", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <SearchInput
        value=""
        onValueChange={onValueChange}
        placeholder="Search catalog by title, category, or SKU..."
        ariaLabel="Search the product catalog"
      />
    );

    await user.type(screen.getByRole("searchbox", { name: "Search the product catalog" }), "a");
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("offers a clear button only while there is a term", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    const { rerender } = render(
      <SearchInput value="" onValueChange={onValueChange} ariaLabel="Search users" />
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    rerender(<SearchInput value="tes" onValueChange={onValueChange} ariaLabel="Search users" />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("names the clear button after what it clears", () => {
    render(
      <SearchInput
        value="tes"
        onValueChange={() => {}}
        ariaLabel="Search users"
        clearLabel="Clear user search"
      />
    );

    expect(screen.getByRole("button", { name: "Clear user search" })).toBeVisible();
  });
});
