import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OperationsHub from "./OperationsHub";

describe("OperationsHub", () => {
  const defaultMetrics = {
    totalRevenue: 50000,
    totalOrders: 15,
    processingOrders: 3,
    lowStockProducts: 4,
    customersCount: 12,
  };

  const defaultSalesReport = {
    statuses: { pending: 2, processing: 3, shipped: 5, delivered: 5, cancelled: 0 },
    repeat: { totalCustomers: 12, repeatCustomers: 5 },
  };

  it("renders operations hub header, welcome message, and action cards", () => {
    render(
      <OperationsHub
        metrics={defaultMetrics}
        salesReport={defaultSalesReport}
        onNavigateTab={vi.fn()}
        onOpenAddProduct={vi.fn()}
        userName="Bruce Wayne"
      />
    );

    expect(screen.getByText("Store Operations Overview")).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Bruce Wayne/)).toBeInTheDocument();
    expect(screen.getByText("Orders Awaiting Shipping")).toBeInTheDocument();
    expect(screen.getByText("Low Stock Inventory")).toBeInTheDocument();
    expect(screen.getByText("Customer Accounts")).toBeInTheDocument();
    expect(screen.getByText("Homepage Slides & Banners")).toBeInTheDocument();
    // Sum of processing (3) and pending (2) is 5
    expect(screen.getByText("5")).toBeInTheDocument();
    // Low stock count is 4
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onOpenAddProduct when '+ Add New Product' button is clicked", () => {
    const handleAddProduct = vi.fn();
    render(
      <OperationsHub
        metrics={defaultMetrics}
        salesReport={defaultSalesReport}
        onNavigateTab={vi.fn()}
        onOpenAddProduct={handleAddProduct}
      />
    );

    const addBtn = screen.getByRole("button", { name: /Add New Product/i });
    fireEvent.click(addBtn);
    expect(handleAddProduct).toHaveBeenCalledTimes(1);
  });

  it("navigates to orders processing when orders card is clicked", () => {
    const handleNavigate = vi.fn();
    render(
      <OperationsHub
        metrics={defaultMetrics}
        salesReport={defaultSalesReport}
        onNavigateTab={handleNavigate}
        onOpenAddProduct={vi.fn()}
      />
    );

    const ordersCard = screen.getByText("Orders Awaiting Shipping").closest(".hub-card");
    fireEvent.click(ordersCard);
    expect(handleNavigate).toHaveBeenCalledWith("orders", "processing");
  });

  it("navigates to products list when low stock card is clicked", () => {
    const handleNavigate = vi.fn();
    render(
      <OperationsHub
        metrics={defaultMetrics}
        salesReport={defaultSalesReport}
        onNavigateTab={handleNavigate}
        onOpenAddProduct={vi.fn()}
      />
    );

    const lowStockCard = screen.getByText("Low Stock Inventory").closest(".hub-card");
    fireEvent.click(lowStockCard);
    expect(handleNavigate).toHaveBeenCalledWith("products", "list");
  });

  it("renders live store link pointing to storefront route", () => {
    render(
      <OperationsHub
        metrics={defaultMetrics}
        salesReport={defaultSalesReport}
        onNavigateTab={vi.fn()}
        onOpenAddProduct={vi.fn()}
      />
    );

    const storeLink = screen.getByRole("link", { name: /View Live Store/i });
    expect(storeLink).toHaveAttribute("href", "#/");
  });
});
