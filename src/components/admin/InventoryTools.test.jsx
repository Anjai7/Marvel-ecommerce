import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InventoryTools from "./InventoryTools";

const aurora = { id: "prod-1", title: "Aurora Phone", stock: 2, price: 49999, image_url: "" };

describe("InventoryTools", () => {
  it("renders the low-stock and out-of-stock watchlists from the loaded catalogue", () => {
    render(
      <InventoryTools products={[aurora]} onAdjustStock={vi.fn()} onBulkAdjustStock={vi.fn()} />
    );

    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Aurora Phone")).toBeInTheDocument();
    expect(screen.getByText("2 in stock")).toBeInTheDocument();
  });

  it("renders the empty state when no product needs a stock write", () => {
    render(<InventoryTools products={[{ id: "prod-2", title: "Healthy Toy", stock: 40 }]} />);

    expect(screen.getByText(/No products need a stock write right now/i)).toBeInTheDocument();
  });

  it("adjusts a single product's stock through the write handler", async () => {
    const user = userEvent.setup();
    const onAdjustStock = vi.fn().mockResolvedValue(undefined);

    render(<InventoryTools products={[aurora]} onAdjustStock={onAdjustStock} />);

    const stockInput = screen.getByLabelText("New stock for Aurora Phone");
    await user.clear(stockInput);
    await user.type(stockInput, "7");
    await user.click(screen.getByRole("button", { name: /Adjust/i }));

    await vi.waitFor(() =>
      expect(onAdjustStock).toHaveBeenCalledWith("prod-1", { stock: 7, reason: null })
    );
  });

  it("applies a bulk adjustment to the selected watchlist rows", async () => {
    const user = userEvent.setup();
    const onBulkAdjustStock = vi.fn().mockResolvedValue({ results: [] });

    render(<InventoryTools products={[aurora]} onBulkAdjustStock={onBulkAdjustStock} />);

    await user.click(screen.getByLabelText(/Select Aurora Phone for a bulk stock adjustment/i));
    const bulkInput = screen.getByLabelText("Bulk stock adjustment");
    await user.clear(bulkInput);
    await user.type(bulkInput, "3");
    await user.click(screen.getByRole("button", { name: /Apply to Selected/i }));

    await vi.waitFor(() =>
      expect(onBulkAdjustStock).toHaveBeenCalledWith([{ id: "prod-1", stock: 3 }])
    );
  });
});
