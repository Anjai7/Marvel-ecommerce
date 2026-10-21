import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductViewPage from "./ProductViewPage";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";
import { apiFetchProductDetails } from "../../api/productDetailsApi";
import { apiFetchProducts } from "../../api/backendApi";

vi.mock("../../api/productDetailsApi", () => ({
  apiFetchProductDetails: vi.fn(),
}));

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
}));

function renderPage(props) {
  return render(
    <ToastProvider>
      <CartProvider>
        <ProductViewPage {...props} />
      </CartProvider>
    </ToastProvider>
  );
}

const emptyReviews = { overall: null, total: 0, breakdown: {}, items: [] };

const MINIMAL_PAYLOAD = {
  product: { id: "p1", title: "Plain Canvas Shoe", price: "1499.00" },
  offers: [],
  reviews: emptyReviews,
  variants: { colors: [], sizes: [] },
  media: [],
};

const FULL_PAYLOAD = {
  product: {
    id: "p2",
    title: "Road Runner 2",
    brand: "Strider",
    sku: "STR-001",
    category: "Running",
    description: "Lightweight daily trainer.",
    price: "2499.00",
    original_price: "2999.00",
    stock: 4,
    warranty: "6 months manufacturer warranty",
    highlights: ["Breathable mesh"],
    delivery_info: { free_shipping: true, estimated_days: "2-4 business days" },
    offer_ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  offers: [
    { kind: "emi", title: "No cost EMI", months: 6, amount: 416.5, interest: "No Cost" },
    { kind: "bank", bank: "Example Bank", description: "10% instant discount", code: "EX10" },
    { kind: "coupon", code: "RUN50", description: "₹50 off your order" },
  ],
  reviews: {
    overall: 5,
    total: 1,
    breakdown: { 5: 1 },
    items: [
      {
        id: "r1",
        author_name: "Asha Rao",
        rating: 5,
        title: "Great fit",
        body: "Comfortable on long runs.",
        is_verified: true,
        created_at: "2026-10-01T10:00:00.000Z",
      },
    ],
  },
  variants: {
    colors: [{ id: "c1", label: "Ink", value: "#0f172a" }],
    sizes: [{ id: "s1", label: "UK 8", value: "8" }],
  },
  media: [{ id: "m1", url: "https://cdn.example.com/shoe.jpg", kind: "gallery" }],
};

describe("ProductViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchProducts.mockResolvedValue([]);
  });

  it("renders an explicit error state when the details endpoint rejects", async () => {
    const error = Object.assign(new Error("Not found"), { status: 404 });
    apiFetchProductDetails.mockRejectedValue(error);

    renderPage({ productId: "missing", onBack: vi.fn() });

    expect(await screen.findByText("Product Unavailable")).toBeInTheDocument();
    expect(screen.getByText("This product is no longer available.")).toBeInTheDocument();
    expect(screen.queryByText(/Add to Cart/)).not.toBeInTheDocument();
  });

  it("renders an explicit error when no product id is available", async () => {
    renderPage({ onBack: vi.fn() });

    expect(await screen.findByText("Product Unavailable")).toBeInTheDocument();
    expect(screen.getByText("No product was requested.")).toBeInTheDocument();
    expect(apiFetchProductDetails).not.toHaveBeenCalled();
  });

  it("renders only the stored product, with no offers, countdown or reviews invented", async () => {
    apiFetchProductDetails.mockResolvedValue(MINIMAL_PAYLOAD);

    renderPage({ productId: "p1", onBack: vi.fn() });

    expect(await screen.findByRole("heading", { name: "Plain Canvas Shoe" })).toBeInTheDocument();
    expect(screen.getByText("₹1,499")).toBeInTheDocument();

    // No fabricated commerce surfaces.
    expect(screen.queryByText(/Deal ends in/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available Offers & Coupons/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment Options/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HDFC|CHASE5|AMEX25|MARVEL10|FIRSTBUY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alex Rivera|Sarah Jenkins|David Chen/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Midnight Black|Silver Frost|Ocean Navy|Titanium Gold/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Verified Marvel Seller/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sony WH-1000XM5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bajaj Finserv/)).not.toBeInTheDocument();

    // No gallery frame and no review summary are invented either.
    expect(screen.getByText("No images have been published for this product.")).toBeInTheDocument();
    expect(
      screen.getByText("No reviews have been published for this product yet.")
    ).toBeInTheDocument();
  });

  it("renders the countdown, offers, variants, media and reviews the API supplies", async () => {
    apiFetchProductDetails.mockResolvedValue(FULL_PAYLOAD);

    const { container } = renderPage({ productId: "p2", onBack: vi.fn() });

    expect(await screen.findByRole("heading", { name: "Road Runner 2" })).toBeInTheDocument();

    // Countdown exists because offer_ends_at is in the future.
    expect(screen.getByText(/Deal ends in/)).toBeInTheDocument();

    // Offers come from the payload.
    expect(screen.getAllByText(/Example Bank/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RUN50/).length).toBeGreaterThan(0);

    // Variants come from the payload.
    expect(screen.getAllByText("Ink").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UK 8").length).toBeGreaterThan(0);

    // Media drives the gallery.
    const mainImage = container.querySelector(".pvg-main-img");
    expect(mainImage).toHaveAttribute("src", "https://cdn.example.com/shoe.jpg");

    // Reviews come from the payload.
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Great fit")).toBeInTheDocument();

    // Warranty and delivery copy are the stored ones.
    expect(screen.getAllByText(/6 months manufacturer warranty/).length).toBeGreaterThan(0);
    expect(screen.getByText("Free shipping")).toBeInTheDocument();

    await waitFor(() => expect(apiFetchProductDetails).toHaveBeenCalledWith("p2"));
  });

  it("does not render the countdown when offer_ends_at has passed", async () => {
    apiFetchProductDetails.mockResolvedValue({
      ...MINIMAL_PAYLOAD,
      product: {
        ...MINIMAL_PAYLOAD.product,
        offer_ends_at: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    });

    renderPage({ productId: "p1", onBack: vi.fn() });

    expect(await screen.findByRole("heading", { name: "Plain Canvas Shoe" })).toBeInTheDocument();
    expect(screen.queryByText(/Deal ends in/)).not.toBeInTheDocument();
  });
});
