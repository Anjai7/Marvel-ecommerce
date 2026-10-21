import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickViewDialog } from "./QuickViewDialog";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";

function renderDialog(product) {
  return render(
    <ToastProvider>
      <CartProvider>
        <QuickViewDialog product={product} isOpen onClose={vi.fn()} onViewFull={vi.fn()} />
      </CartProvider>
    </ToastProvider>
  );
}

describe("QuickViewDialog", () => {
  it("shows the stored warranty and delivery promises only", () => {
    renderDialog({
      id: "p1",
      title: "Trail Shoe",
      price: "1499.00",
      warranty: "6 months manufacturer warranty",
      delivery_info: { free_shipping: true, return_days: 7 },
    });

    expect(screen.getByText("6 months manufacturer warranty")).toBeInTheDocument();
    expect(screen.getByText("Free shipping")).toBeInTheDocument();
    expect(screen.getByText("7-day returns")).toBeInTheDocument();
    expect(screen.queryByText("Free Express Shipping")).not.toBeInTheDocument();
    expect(screen.queryByText("1 Year Brand Warranty")).not.toBeInTheDocument();
    expect(screen.queryByText("7 Days Easy Return")).not.toBeInTheDocument();
  });

  it("does not claim a stock status the product row does not have", () => {
    renderDialog({ id: "p2", title: "Plain Shoe", price: "999.00" });

    expect(screen.queryByText(/In Stock/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ships Tomorrow/)).not.toBeInTheDocument();
  });

  it("reports the stored stock level without an invented delivery promise", () => {
    renderDialog({ id: "p3", title: "Stocked Shoe", price: "999.00", stock: 3 });

    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.queryByText(/Ships Tomorrow/)).not.toBeInTheDocument();
  });
});
