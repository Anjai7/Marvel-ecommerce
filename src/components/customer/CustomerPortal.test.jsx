import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CustomerPortal from "./CustomerPortal";
import { apiFetchOrders } from "../../api/backendApi";
import { apiFetchWishlist } from "../../api/wishlistApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchOrders: vi.fn(),
}));

vi.mock("../../api/wishlistApi", () => ({
  apiFetchWishlist: vi.fn(),
  apiAddToWishlist: vi.fn(),
  apiRemoveFromWishlist: vi.fn(),
}));

vi.mock("../../context/CartContext", () => ({
  useCart: () => ({ addItem: vi.fn() }),
}));

const customer = {
  id: "usr-001",
  full_name: "Jane Doe",
  email: "jane@example.com",
};

function makeOrder(items) {
  return {
    id: "ord-001",
    created_at: "2026-01-15T10:00:00.000Z",
    status: "shipped",
    carrier: "Express Courier",
    tracking_number: "TRK-9849201",
    shipping_address: "1 Marvel Way, Mumbai",
    total_amount: 1499,
    items,
  };
}

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

async function renderPortal(orders) {
  apiFetchOrders.mockResolvedValue(orders);
  const view = render(<CustomerPortal currentUser={customer} onNavigateHome={vi.fn()} />);
  await waitFor(() => expect(apiFetchOrders).toHaveBeenCalled());
  await waitFor(() => expect(view.container.querySelector(".customer-order-items")).not.toBeNull());
  return view;
}

describe("CustomerPortal — the options on an ordered item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchWishlist.mockResolvedValue({ items: [] });
  });

  it("reads the chosen options and the SKU of the variant", async () => {
    await renderPortal([makeOrder([speakerWithOptions])]);

    expect(screen.getByText("Colour: Blue · Size: M · SKU: SPK-BLUE")).toBeInTheDocument();
  });

  it("shows the options of every item that carries a choice", async () => {
    await renderPortal([
      makeOrder([
        speakerWithOptions,
        {
          id: "p3",
          title: "Titan Backpack",
          quantity: 1,
          price: 2499,
          sku: "BAG-32-BLK",
          options: [{ kind: "capacity", label: "32 L", value: "32 L" }],
        },
      ]),
    ]);

    expect(screen.getByText("Colour: Blue · Size: M · SKU: SPK-BLUE")).toBeInTheDocument();
    expect(screen.getByText("Capacity: 32 L · SKU: BAG-32-BLK")).toBeInTheDocument();
  });

  it("leaves an order without options exactly as it was", async () => {
    const { container } = await renderPortal([makeOrder([legacyMug])]);

    expect(screen.getByText("Legacy Avengers Mug")).toBeInTheDocument();
    expect(container.querySelector(".customer-order-item__options")).toBeNull();
  });

  it("survives an item whose options are empty, missing or unreadable", async () => {
    const { container } = await renderPortal([
      makeOrder([
        { id: "p4", title: "Empty Options Mug", quantity: 1, price: 499, options: [] },
        { id: "p5", title: "No Options Kettle", quantity: 1, price: 899 },
        {
          id: "p6",
          title: "Broken Options Teapot",
          quantity: 1,
          price: 999,
          options: [{ kind: "size" }, null, "nonsense"],
        },
      ]),
    ]);

    expect(screen.getByText("Empty Options Mug")).toBeInTheDocument();
    expect(container.querySelector(".customer-order-item__options")).toBeNull();
  });
});
