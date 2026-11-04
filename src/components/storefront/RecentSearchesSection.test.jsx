import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import RecentSearchesSection, {
  loadRecentSearches,
  saveRecentSearches,
} from "./RecentSearchesSection";

describe("RecentSearchesSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders nothing when there are no recent searches (graceful empty handling)", () => {
    const { container } = render(<RecentSearchesSection />);
    expect(container.firstChild).toBeNull();
  });

  it("renders recent searches chips when history exists", () => {
    saveRecentSearches(["Avengers Helmet", "Iron Man Suit", "Spiderman Mask"]);
    render(<RecentSearchesSection />);

    expect(screen.getByText("Your Recent Searches")).toBeVisible();
    expect(screen.getByText("Avengers Helmet")).toBeVisible();
    expect(screen.getByText("Iron Man Suit")).toBeVisible();
    expect(screen.getByText("Spiderman Mask")).toBeVisible();
  });

  it("handles clicking on a search chip to trigger navigation/selection", async () => {
    const user = userEvent.setup();
    const handleSearchSelect = vi.fn();
    saveRecentSearches(["Captain America Shield"]);

    render(<RecentSearchesSection onSearchSelect={handleSearchSelect} />);
    const chip = screen.getByText("Captain America Shield");
    await user.click(chip);

    expect(handleSearchSelect).toHaveBeenCalledWith("Captain America Shield");
  });

  it("removes a single item when the X icon is clicked", async () => {
    const user = userEvent.setup();
    saveRecentSearches(["Thor Hammer", "Hulk Gloves"]);

    render(<RecentSearchesSection />);
    expect(screen.getByText("Thor Hammer")).toBeVisible();
    expect(screen.getByText("Hulk Gloves")).toBeVisible();

    const removeBtn = screen.getByRole("button", { name: "Remove Thor Hammer" });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Thor Hammer")).not.toBeInTheDocument();
      expect(screen.getByText("Hulk Gloves")).toBeVisible();
    });
    expect(loadRecentSearches()).toEqual(["Hulk Gloves"]);
  });

  it("clears all searches when 'Clear all' is clicked", async () => {
    const user = userEvent.setup();
    saveRecentSearches(["Item 1", "Item 2"]);

    const { container } = render(<RecentSearchesSection />);
    const clearBtn = screen.getByRole("button", { name: "Clear search history" });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    expect(loadRecentSearches()).toEqual([]);
  });
});
