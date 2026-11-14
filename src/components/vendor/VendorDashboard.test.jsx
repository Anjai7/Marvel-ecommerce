import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import VendorDashboard from "./VendorDashboard";
import { apiFetchOrders, apiFetchProducts } from "../../api/backendApi";
import { apiFetchCategoryTree } from "../../api/contentApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
  apiFetchOrders: vi.fn(),
  apiCreateProduct: vi.fn(),
  apiUpdateProduct: vi.fn(),
  apiDeleteProduct: vi.fn(),
  apiUpdateOrderStatus: vi.fn(),
}));

vi.mock("../../api/contentApi", () => ({
  apiFetchCategoryTree: vi.fn(),
}));

const vendor = {
  id: "usr-002",
  full_name: "Alex Vendor",
  email: "vendor@example.com",
  store_name: "TechGear Flagship Store",
};

const speakerWithOptions = {
  id: "p1",
  title: "Aurora Wireless Speaker",
  quantity: 1,
  price: 1499,
  sku: "SPK-BLUE",
  options: [
    { kind: "color", label: "Blue", value: "#2563eb" },
    { kind: "size", label: "M", value: "M" },
  ],
};

const legacyMug = {
  id: "p2",
  title: "Legacy Avengers Mug",
  quantity: 2,
  price: 499,
};

function makeOrder(items) {
  return {
    id: "ord-001",
    status: "processing",
    customer_name: "Jane",
    customer_email: "jane@example.com",
    shipping_address: "1 Marvel Way, Mumbai",
    carrier: "FedEx Express",
    tracking_number: "TRK-9849201",
    total_amount: 1499,
    items,
  };
}

async function renderDashboard(orders) {
  apiFetchProducts.mockResolvedValue([]);
  apiFetchOrders.mockResolvedValue(orders);
  apiFetchCategoryTree.mockResolvedValue({ categories: [] });
  const view = render(<VendorDashboard currentUser={vendor} onNavigateHome={vi.fn()} />);
  await waitFor(() => expect(apiFetchOrders).toHaveBeenCalled());
  await waitFor(() =>
    expect(view.container.querySelector(".vendor-order-card__meta")).not.toBeNull()
  );
  return view;
}

describe("VendorDashboard — the options on an ordered item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the chosen options of every item under the order details", async () => {
    await renderDashboard([makeOrder([speakerWithOptions, legacyMug])]);

    expect(screen.getByText(/Customer: Jane • 2 item\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("Blue / M")).toBeInTheDocument();
  });

  it("leaves an order without options exactly as it was", async () => {
    const { container } = await renderDashboard([makeOrder([legacyMug])]);

    expect(screen.getByText(/Customer: Jane • 1 item\(s\)/)).toBeInTheDocument();
    expect(container.querySelector(".vendor-item-options")).toBeNull();
  });

  it("lists the chosen options under the customer of a shipment", async () => {
    const user = userEvent.setup();
    const { container } = await renderDashboard([makeOrder([speakerWithOptions])]);

    await user.click(screen.getByRole("button", { name: /Order Fulfillment/ }));

    await waitFor(() => expect(container.querySelector(".vendor-shipment__meta")).not.toBeNull());
    expect(container.querySelector(".vendor-item-options__line").textContent).toBe("Blue / M");
  });

  it("survives an item whose options are empty, missing or unreadable", async () => {
    const { container } = await renderDashboard([
      makeOrder([
        { id: "p3", title: "Empty Options Mug", quantity: 1, price: 499, options: [] },
        { id: "p4", title: "No Options Kettle", quantity: 1, price: 899 },
        {
          id: "p5",
          title: "Broken Options Teapot",
          quantity: 1,
          price: 999,
          options: [{ kind: "size" }, null, "nonsense"],
        },
      ]),
    ]);

    expect(screen.getByText(/Customer: Jane • 3 item\(s\)/)).toBeInTheDocument();
    expect(container.querySelector(".vendor-item-options")).toBeNull();
  });
});
