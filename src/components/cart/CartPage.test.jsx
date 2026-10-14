import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CartPage from "./CartPage";

const mockUseCart = vi.fn();
const mockAddToast = vi.fn();

vi.mock("../../context/CartContext.jsx", () => ({
  useCart: () => mockUseCart(),
}));

vi.mock("../ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
  };
});

const sampleItems = [
  {
    id: "p1",
    title: "Marvel T-Shirt",
    price: 999,
    originalPrice: 1499,
    image: "https://example.com/img1.jpg",
    category: "Apparel",
    quantity: 2,
  },
  {
    id: "p2",
    title: "Avengers Mug",
    price: 499,
    originalPrice: 499,
    image: "https://example.com/img2.jpg",
    category: "Collectibles",
    quantity: 1,
  },
];

function setupCart(overrides = {}) {
  const cart = {
    items: [],
    cartCount: 0,
    subtotal: 0,
    savings: 0,
    total: 0,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    ...overrides,
  };
  mockUseCart.mockReturnValue(cart);
  return cart;
}

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state and Continue Shopping calls onNavigateHome", async () => {
    const user = userEvent.setup();
    setupCart();
    const onNavigateHome = vi.fn();

    render(<CartPage onNavigateHome={onNavigateHome} />);

    expect(screen.getByText("Your cart is empty")).toBeVisible();
    const btn = screen.getByRole("button", { name: "Continue Shopping" });
    await user.click(btn);
    expect(onNavigateHome).toHaveBeenCalledOnce();
  });

  it("renders items with title, qty and line total", () => {
    setupCart({
      items: sampleItems,
      cartCount: 3,
      subtotal: 2497,
      savings: 1000,
      total: 2497,
    });

    render(<CartPage onNavigateHome={vi.fn()} />);

    expect(screen.getByText("Marvel T-Shirt")).toBeVisible();
    expect(screen.getByText("Avengers Mug")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    // line total for p1 = 999*2 = 1998
    expect(screen.getByText("₹1,998")).toBeVisible();
  });

  it("+ button calls updateQuantity(id, qty+1)", async () => {
    const user = userEvent.setup();
    const cart = setupCart({
      items: [sampleItems[0]],
      cartCount: 2,
      subtotal: 1998,
      savings: 1000,
      total: 1998,
    });

    render(<CartPage onNavigateHome={vi.fn()} />);

    const inc = screen.getByRole("button", {
      name: "Increase quantity for Marvel T-Shirt",
    });
    await user.click(inc);
    expect(cart.updateQuantity).toHaveBeenCalledWith("p1", 3);
  });

  it("Remove calls removeItem", async () => {
    const user = userEvent.setup();
    const cart = setupCart({
      items: [sampleItems[0]],
      cartCount: 2,
      subtotal: 1998,
      savings: 1000,
      total: 1998,
    });

    render(<CartPage onNavigateHome={vi.fn()} />);

    const removeBtn = screen.getByRole("button", {
      name: "Remove Marvel T-Shirt from cart",
    });
    await user.click(removeBtn);
    expect(cart.removeItem).toHaveBeenCalledWith("p1");
  });

  it("displays subtotal, savings and total", () => {
    setupCart({
      items: sampleItems,
      cartCount: 3,
      subtotal: 2497,
      savings: 1000,
      total: 2497,
    });

    render(<CartPage onNavigateHome={vi.fn()} />);

    expect(screen.getByText("Subtotal")).toBeVisible();
    expect(screen.getAllByText("₹2,497").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Savings")).toBeVisible();
    expect(screen.getByText("Total")).toBeVisible();
  });
});
