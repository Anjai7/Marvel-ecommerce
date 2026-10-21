import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FrequentlyVisited from "./FrequentlyVisited";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";
import { apiFetchProducts } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
}));

function renderStrip(props = {}) {
  return render(
    <ToastProvider>
      <CartProvider>
        <FrequentlyVisited onView={vi.fn()} {...props} />
      </CartProvider>
    </ToastProvider>
  );
}

describe("FrequentlyVisited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not claim view-tracking behaviour it does not have", async () => {
    apiFetchProducts.mockResolvedValue([{ id: "p2", title: "Second Shoe", price: "999.00" }]);

    renderStrip();

    expect(await screen.findByText("More From the Store")).toBeInTheDocument();
    expect(screen.queryByText(/Frequently Visited Together/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Customers who viewed this item/)).not.toBeInTheDocument();
  });

  it("lists other catalogue products and skips the one on screen", async () => {
    apiFetchProducts.mockResolvedValue([
      { id: "p1", title: "Current Shoe", price: "1499.00" },
      { id: "p2", title: "Second Shoe", price: "999.00" },
    ]);

    renderStrip({ excludeId: "p1" });

    expect(await screen.findByText("Second Shoe")).toBeInTheDocument();
    expect(screen.queryByText("Current Shoe")).not.toBeInTheDocument();
  });

  it("renders no placeholder rating, image or count", async () => {
    apiFetchProducts.mockResolvedValue([{ id: "p3", title: "Bare Product" }]);

    const { container } = renderStrip();

    expect(await screen.findByText("Bare Product")).toBeInTheDocument();
    expect(container.querySelector(".fv-rating-row")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toMatch(/unsplash/i);

    await waitFor(() => expect(apiFetchProducts).toHaveBeenCalled());
  });
});
