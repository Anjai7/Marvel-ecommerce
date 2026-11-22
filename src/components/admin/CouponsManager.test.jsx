import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CouponsManager from "./CouponsManager";
import { apiFetchCoupons } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchCoupons: vi.fn(),
  apiFetchCouponUsage: vi.fn().mockResolvedValue({
    summary: {
      activeCoupons: 0,
      totalCoupons: 0,
      redemptions: 0,
      totalDiscount: 0,
      totalRevenue: 0,
      averageDiscount: 0,
    },
    byCoupon: [],
    recent: [],
    available: true,
  }),
  apiCreateCoupon: vi.fn(),
  apiUpdateCoupon: vi.fn(),
  apiDeleteCoupon: vi.fn(),
}));

describe("CouponsManager", () => {
  it("renders the coupon list with its discount label and use count", async () => {
    apiFetchCoupons.mockResolvedValue([
      {
        id: "coupon-1",
        code: "MARVEL20",
        kind: "percent",
        value: 20,
        min_subtotal: 0,
        max_uses: 0,
        used_count: 3,
        is_active: true,
        expires_at: null,
      },
    ]);

    render(<CouponsManager />);

    expect(screen.getByText(/Loading coupons/i)).toBeInTheDocument();

    expect(await screen.findByText("MARVEL20")).toBeInTheDocument();
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByText(/3 \/ ∞/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the empty state when the admin has no coupons yet", async () => {
    apiFetchCoupons.mockResolvedValue([]);

    render(<CouponsManager />);

    expect(await screen.findByText(/No coupons yet/i)).toBeInTheDocument();
  });

  it("shows the error state when the coupon list cannot be loaded", async () => {
    apiFetchCoupons.mockRejectedValue(new Error("Could not load the coupons."));

    render(<CouponsManager />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Could not load the coupons.")).toBeInTheDocument();
  });
});
