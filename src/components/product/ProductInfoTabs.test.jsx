import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProductInfoTabs from "./ProductInfoTabs";
import { ToastProvider } from "../ui";
import { apiFetchActiveCoupons } from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchActiveCoupons: vi.fn(),
}));

const product = { offers: { emi: [], bank: [], coupon: [] }, title: "Test" };

function renderTabs() {
  return render(
    <ToastProvider>
      <ProductInfoTabs product={product} />
    </ToastProvider>
  );
}

describe("ProductInfoTabs promo codes", () => {
  it("advertises real coupons from the catalogue with an honest description", async () => {
    apiFetchActiveCoupons.mockResolvedValue([
      { code: "ACCESS5", kind: "percent", value: 5, min_subtotal: 0 },
      { code: "FLAT500", kind: "flat", value: 500, min_subtotal: 2999 },
      { code: "FREESHIP", kind: "free_shipping", value: 0, min_subtotal: 999 },
    ]);

    renderTabs();

    expect((await screen.findAllByText("ACCESS5")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("5% off at checkout")).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText("₹500 off at checkout on orders over ₹2,999")).length
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText("Free delivery at checkout on orders over ₹999")).length
    ).toBeGreaterThan(0);
  });

  it("shows no promo block when there are no usable coupons", async () => {
    apiFetchActiveCoupons.mockResolvedValue([]);
    renderTabs();
    await waitFor(() => expect(apiFetchActiveCoupons).toHaveBeenCalled());
    expect(screen.queryByText("Promo Codes")).not.toBeInTheDocument();
  });
});
