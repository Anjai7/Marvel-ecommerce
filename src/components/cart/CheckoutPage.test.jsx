import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CheckoutPage from "./CheckoutPage";

const mockUseCart = vi.fn();
const mockUseAuth = vi.fn();
const mockAddToast = vi.fn();
const mockValidateCoupon = vi.fn();
const mockCreateOrder = vi.fn();
const mockRedeemCoupon = vi.fn();
const mockNavigateToPath = vi.fn();

vi.mock("../../context/CartContext.jsx", () => ({
  useCart: () => mockUseCart(),
}));

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
  };
});

vi.mock("../../api/backendApi", () => ({
  apiCreateOrder: (...args) => mockCreateOrder(...args),
  apiValidateCoupon: (...args) => mockValidateCoupon(...args),
  apiRedeemCoupon: (...args) => mockRedeemCoupon(...args),
}));

vi.mock("../../lib/routes", () => ({
  navigateToPath: (...args) => mockNavigateToPath(...args),
}));

const sampleItems = [
  {
    id: "p1",
    title: "Marvel T-Shirt",
    price: 999,
    quantity: 2,
    lineId: "p1::",
  },
];

function setupCart(overrides = {}) {
  const cart = {
    items: sampleItems,
    cartCount: 2,
    subtotal: 1998,
    savings: 0,
    total: 1998,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    ...overrides,
  };
  mockUseCart.mockReturnValue(cart);
  return cart;
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    mockUseAuth.mockReturnValue({ user: { id: "u-1", email: "a@test.local" }, isLoggedIn: true });
  });

  const applySavedCoupon = async (user) => {
    await user.click(screen.getByRole("button", { name: /Have a coupon/i }));
    await user.type(screen.getByPlaceholderText("Enter code"), "SAVE10");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    const checkbox = await screen.findByLabelText(/Apply this coupon to my order/i);
    expect(checkbox).toBeChecked();
    return checkbox;
  };

  it("checks the apply-coupon checkbox automatically once the code validates", async () => {
    const user = userEvent.setup();
    mockValidateCoupon.mockResolvedValue({
      valid: true,
      code: "SAVE10",
      discount: 100,
      subtotal: 1998,
    });

    setupCart();
    render(<CheckoutPage />);

    expect(screen.queryByLabelText(/Apply this coupon to my order/i)).not.toBeInTheDocument();
    await applySavedCoupon(user);

    expect(mockValidateCoupon).toHaveBeenCalledWith({ code: "SAVE10", subtotal: 1998 });
    expect(screen.getByText(/SAVE10 applied/i)).toBeInTheDocument();
  });

  it("unchecking the coupon removes the discount and checking re-applies the last code", async () => {
    const user = userEvent.setup();
    mockValidateCoupon.mockResolvedValue({
      valid: true,
      code: "SAVE10",
      discount: 100,
      subtotal: 1998,
    });

    setupCart();
    render(<CheckoutPage />);

    const checkbox = await applySavedCoupon(user);

    // Untick: the discount leaves the totals, the applied line goes away.
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByText(/SAVE10 applied/i)).not.toBeInTheDocument();

    // Re-tick: the last validated code is applied again.
    await user.click(checkbox);
    await waitFor(() => expect(mockValidateCoupon).toHaveBeenCalledTimes(2));
    expect(mockValidateCoupon).toHaveBeenLastCalledWith({ code: "SAVE10", subtotal: 1998 });
    expect(await screen.findByText(/SAVE10 applied/i)).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("keeps the checkbox unchecked and shows the reason when the code is invalid", async () => {
    const user = userEvent.setup();
    mockValidateCoupon.mockResolvedValue({ valid: false, reason: "Unknown code" });

    setupCart();
    render(<CheckoutPage />);

    await user.click(screen.getByRole("button", { name: /Have a coupon/i }));
    await user.type(screen.getByPlaceholderText("Enter code"), "NOPE123");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Unknown code")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Apply this coupon to my order/i)).toBeNull();
  });

  it("animates the applied-coupon line and box highlight only when a coupon lands", async () => {
    const user = userEvent.setup();
    mockValidateCoupon.mockResolvedValue({
      valid: true,
      code: "SAVE10",
      discount: 100,
      subtotal: 1998,
    });

    setupCart();
    render(<CheckoutPage />);

    expect(document.querySelector(".checkout-coupon--applied")).not.toBeInTheDocument();
    expect(document.querySelector(".checkout-coupon-applied")).not.toBeInTheDocument();

    await applySavedCoupon(user);

    expect(await screen.findByText(/SAVE10 applied/i)).toBeInTheDocument();
    expect(document.querySelector(".checkout-coupon--applied")).toBeInTheDocument();
    expect(document.querySelector(".checkout-coupon-applied")).toBeInTheDocument();
  });

  it("sends the price breakdown with the order and keeps the sessionStorage fallback", async () => {
    const user = userEvent.setup();
    const cart = setupCart();
    mockCreateOrder.mockResolvedValue({ id: "ord-1" });
    mockRedeemCoupon.mockResolvedValue({});
    mockValidateCoupon.mockResolvedValue({
      valid: true,
      code: "SAVE10",
      discount: 100,
      subtotal: 1998,
    });

    render(<CheckoutPage />);
    await user.type(screen.getByLabelText(/Full name/), "Test User");
    await user.type(screen.getByLabelText(/Phone number/), "9876543210");
    await user.type(screen.getByLabelText(/Street address/), "12 Main Street");
    await user.type(screen.getByLabelText(/City/), "Mumbai");
    await user.type(screen.getByLabelText(/State/), "MH");
    await user.type(screen.getByLabelText(/PIN code/), "400001");

    await applySavedCoupon(user);
    await user.click(screen.getByRole("button", { name: /Place order/i }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(1));
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 1898,
        subtotal: 1998,
        discountAmount: 100,
        shippingFee: 0,
        couponCode: "SAVE10",
        items: cart.items,
      })
    );
    expect(sessionStorage.getItem("marvel_last_order_ord-1")).toContain("SAVE10");
  });
});
