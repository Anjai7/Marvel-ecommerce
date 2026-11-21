import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartDrawer from "./CartDrawer";

const items = [
  {
    lineId: "p1::",
    id: "p1",
    title: "Alpha Headphones",
    image: "https://example.com/a.png",
    price: 1000,
    quantity: 2,
  },
];

function renderDrawer(overrides = {}) {
  const onClose = vi.fn();
  const onViewCart = vi.fn();
  const onCheckout = vi.fn();
  render(
    <CartDrawer
      open
      onClose={onClose}
      items={items}
      cartCount={2}
      subtotal={2000}
      savings={100}
      isLoggedIn
      onViewCart={onViewCart}
      onCheckout={onCheckout}
      {...overrides}
    />
  );
  return { onClose, onViewCart, onCheckout };
}

describe("CartDrawer", () => {
  it("shows the cart lines and the order summary", () => {
    renderDrawer();
    expect(screen.getByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
    expect(screen.getByText("Alpha Headphones")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Order summary" })).toBeInTheDocument();
    expect(screen.getByText("Proceed to checkout")).toBeInTheDocument();
  });

  it("asks a guest to sign in instead of checking out", () => {
    renderDrawer({ isLoggedIn: false });
    expect(screen.getByText("Sign in to checkout")).toBeInTheDocument();
  });

  it("closes from the X button and with Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(screen.getByRole("button", { name: "Close cart" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows an empty state with no summary when the cart is empty", () => {
    renderDrawer({ items: [], cartCount: 0, subtotal: 0, savings: 0 });
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Order summary" })).not.toBeInTheDocument();
  });
});
