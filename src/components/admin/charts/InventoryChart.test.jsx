import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import InventoryChart from "./InventoryChart";

describe("InventoryChart", () => {
  const sampleData = {
    total: 100,
    inStock: 90,
    lowStock: 15,
    outOfStock: 10,
    value: 500000,
  };

  it("renders empty state when data is not provided", () => {
    render(<InventoryChart data={null} />);
    expect(screen.getByText("No products yet")).toBeInTheDocument();
  });

  it("renders total asset value, health rate, and legend cards", () => {
    render(<InventoryChart data={sampleData} />);

    // Healthy = inStock (90) - lowStock (15) = 75
    // Total items = 75 + 15 + 10 = 100
    // Health rate = 75%
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("75 items")).toBeInTheDocument();
    expect(screen.getByText("15 items")).toBeInTheDocument();
    expect(screen.getByText("10 items")).toBeInTheDocument();
  });

  it("triggers onSelectFilter when a legend card is clicked", async () => {
    const user = userEvent.setup();
    const handleFilter = vi.fn();

    render(<InventoryChart data={sampleData} onSelectFilter={handleFilter} />);

    const healthyCard = screen.getByRole("button", { name: /Healthy Stock/i });
    await user.click(healthyCard);
    expect(handleFilter).toHaveBeenCalledWith("healthy");

    const lowCard = screen.getByRole("button", { name: /Low Stock/i });
    await user.click(lowCard);
    expect(handleFilter).toHaveBeenCalledWith("low");

    const outCard = screen.getByRole("button", { name: /Out of Stock/i });
    await user.click(outCard);
    expect(handleFilter).toHaveBeenCalledWith("out");
  });
});
