import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import UnifiedAdminConsole from "./UnifiedAdminConsole";
import { ORDER_STATUSES } from "./adminConstants";
import {
  apiAdminCreateUser,
  apiFetchAllUsers,
  apiFetchOrders,
  apiFetchProducts,
  apiUpdateUserDetails,
} from "../../api/backendApi";

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn().mockResolvedValue([]),
  apiFetchOrders: vi.fn().mockResolvedValue([]),
  apiFetchAllUsers: vi.fn().mockResolvedValue([]),
  apiAdminCreateUser: vi.fn(),
  apiUpdateUserDetails: vi.fn(),
  apiUpdateUserRole: vi.fn(),
  apiUpdateUserStatus: vi.fn(),
  apiResetUserPassword: vi.fn(),
  apiDeleteUser: vi.fn(),
  apiCreateProduct: vi.fn(),
  apiUpdateProduct: vi.fn(),
  apiDeleteProduct: vi.fn(),
  apiModerateProduct: vi.fn(),
  apiUpdateOrderStatus: vi.fn(),
  apiUploadImage: vi.fn(),
}));

vi.mock("../../api/contentApi", () => ({
  apiFetchMenuItems: vi.fn().mockResolvedValue([]),
  apiSaveMenuItem: vi.fn(),
  apiUpdateMenuItem: vi.fn(),
  apiDeleteMenuItem: vi.fn(),
  apiReorderMenuItems: vi.fn(),
  apiFetchCategoryTree: vi.fn().mockResolvedValue({ categories: [] }),
  apiFetchHeroSlides: vi.fn().mockResolvedValue({ slides: [] }),
  apiSaveHeroSlide: vi.fn(),
  apiUpdateHeroSlide: vi.fn(),
  apiDeleteHeroSlide: vi.fn(),
  apiReorderHeroSlides: vi.fn(),
  apiFetchBanners: vi.fn().mockResolvedValue({ banners: [] }),
  apiSaveBanner: vi.fn(),
  apiUpdateBanner: vi.fn(),
  apiDeleteBanner: vi.fn(),
  apiReorderBanners: vi.fn(),
  apiFetchFooter: vi.fn().mockResolvedValue({ sections: [], links: [] }),
  apiSaveFooterSection: vi.fn(),
  apiUpdateFooterSection: vi.fn(),
  apiDeleteFooterSection: vi.fn(),
  apiReorderFooterSections: vi.fn(),
  apiSaveFooterLink: vi.fn(),
  apiUpdateFooterLink: vi.fn(),
  apiDeleteFooterLink: vi.fn(),
  apiReorderFooterLinks: vi.fn(),
  apiUploadImage: vi.fn(),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { full_name: "Admin User", email: "admin@example.com" },
    logout: vi.fn(),
    role: "admin",
  }),
}));

const STATUS_LABELS = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

beforeEach(() => {
  for (const fetchMock of [apiFetchAllUsers, apiFetchOrders, apiFetchProducts]) {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue([]);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UnifiedAdminConsole", () => {
  it("does not expose an initial status selector when adding a user", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Users Accounts/ }));
    await user.click(within(nav).getByRole("button", { name: "Add User" }));

    expect(screen.getByRole("heading", { name: "Create User Account" })).toBeVisible();
    expect(screen.queryByText("Initial Status")).not.toBeInTheDocument();
  });

  it("exposes catalog menus with submenus and an add-product flow", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Products Catalog/ }));
    await user.click(within(nav).getByRole("button", { name: "Add Product" }));

    const main = screen.getByRole("main");
    await expect(within(main).getByRole("button", { name: "Publish Product" })).toBeVisible();
  });

  it("shows the sales report with real-data sections", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    await screen.findByRole("navigation");
    await user.click(screen.getByRole("button", { name: "Sales Report" }));

    await expect(screen.getByText("Today Orders")).toBeVisible();
    await expect(screen.getByText("Orders & Revenue")).toBeVisible();
    await expect(screen.getByText("Inventory Snapshot")).toBeVisible();
  });

  it("renders a neutral dash for every order value the API did not supply", async () => {
    apiFetchOrders.mockResolvedValueOnce([
      { id: "order-12345678", total_amount: 199, status: null, created_at: null, items: null },
    ]);
    render(<UnifiedAdminConsole />);

    const idCell = await screen.findByText("#12345678");
    const row = idCell.closest("tr");

    expect(screen.queryByText("Marvel Shopper")).toBeNull();
    expect(screen.queryByText("user@marvel.com")).toBeNull();
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.queryByText("Processing")).toBeNull();
    // customer name, customer email, item count, status and date are all unknown
    expect(within(row).getAllByText("—")).toHaveLength(5);
    expect(within(row).getByText(/199/)).toBeVisible();
  });

  it("does not fabricate a SKU or a category on the product catalog", async () => {
    const user = userEvent.setup();
    apiFetchProducts.mockResolvedValueOnce([
      { id: "prod-1", title: "Aurora Speaker", price: 999, stock: 2 },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Products Catalog/ }));

    const row = (await screen.findByText("Aurora Speaker")).closest("tr");
    // No SKU on the row and no SKU guessed from the id; no category invented.
    expect(screen.queryByText(/prod-1/)).toBeNull();
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("starts the product form empty instead of inventing a category or stock", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Products Catalog/ }));
    await user.click(within(nav).getByRole("button", { name: "Add Product" }));

    // An empty number input reports null through toHaveValue; the point is it is
    // not a fabricated "15".
    const stockField = screen.getByPlaceholderText("e.g. 25");
    expect(stockField.value).toBe("");
    expect(stockField).toHaveValue(null);
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.queryByText("Electronics")).toBeNull();
  });

  it("does not fabricate a name, plan or billing method for a user", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      { id: "u1", email: "asha@x.com", full_name: "", role: "user", status: "active" },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Users Accounts/ }));

    const row = (await screen.findByText("asha@x.com")).closest("tr");
    expect(within(row).queryByText("Unnamed User")).toBeNull();
    expect(within(row).queryByText("Basic")).toBeNull();
    expect(within(row).queryByText("Enterprise")).toBeNull();
    // avatar initial + name + plan
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the server's plan and billing without offering an override", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      {
        id: "u1",
        email: "asha@x.com",
        full_name: "Asha",
        role: "vendor",
        status: "active",
        store_name: "Asha Store",
        plan: "Team",
        billing: "Manual - Paypal",
      },
    ]);
    apiUpdateUserDetails.mockResolvedValue({
      id: "u1",
      email: "asha@x.com",
      full_name: "Asha",
      role: "vendor",
      status: "active",
      store_name: "Asha Store",
    });
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Users Accounts/ }));
    await screen.findByText("Asha");
    await user.click(screen.getByTitle("Edit User Details"));

    const plan = screen.getByLabelText("Plan Tier");
    const billing = screen.getByLabelText("Billing Method");
    expect(plan).toBeDisabled();
    expect(plan).toHaveValue("Team");
    expect(billing).toBeDisabled();
    expect(billing).toHaveValue("Manual - Paypal");
    expect(within(plan).queryByRole("option", { name: "Basic" })).toBeNull();
    expect(within(billing).queryByRole("option", { name: "Manual - Cash" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Save Changes/ }));
    await waitFor(() => expect(apiUpdateUserDetails).toHaveBeenCalledTimes(1));
    const payload = apiUpdateUserDetails.mock.calls[0][1];
    expect(payload).not.toHaveProperty("plan");
    expect(payload).not.toHaveProperty("billing");
    expect(payload).toMatchObject({ full_name: "Asha", role: "vendor", status: "active" });
  });

  it("creates users without forcing a plan or billing method", async () => {
    const user = userEvent.setup();
    apiAdminCreateUser.mockResolvedValue({
      id: "u2",
      full_name: "New Person",
      email: "new@x.com",
      role: "user",
      status: "active",
    });
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Users Accounts/ }));
    await user.click(within(nav).getByRole("button", { name: "Add User" }));

    await user.type(screen.getByPlaceholderText("e.g. Alex Morgan"), "New Person");
    await user.type(screen.getByPlaceholderText("alex@marvel.com"), "new@x.com");
    await user.type(screen.getByPlaceholderText("Minimum 6 characters"), "secret123");
    await user.click(screen.getByRole("button", { name: /Create User Account/ }));

    await waitFor(() => expect(apiAdminCreateUser).toHaveBeenCalledTimes(1));
    const payload = apiAdminCreateUser.mock.calls[0][0];
    expect(payload).not.toHaveProperty("plan");
    expect(payload).not.toHaveProperty("billing");
    expect(payload).toMatchObject({ fullName: "New Person", email: "new@x.com" });
  });

  it("lists exactly the database order statuses in the sidebar and the pills", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Orders Pipeline/ }));

    for (const label of STATUS_LABELS) {
      expect(within(nav).getByRole("button", { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    expect(within(nav).queryByRole("button", { name: /^Completed/ })).toBeNull();

    await user.click(within(nav).getByRole("button", { name: /^Cancelled/ }));

    const main = screen.getByRole("main");
    for (const label of STATUS_LABELS) {
      expect(within(main).getByRole("button", { name: `${label} (0)` })).toBeVisible();
    }
    expect(within(main).queryByRole("button", { name: /^Completed/ })).toBeNull();
    expect(ORDER_STATUSES).toHaveLength(STATUS_LABELS.length);
  });

  it("shows an explicit failure state when no records can be loaded", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    apiFetchOrders.mockRejectedValueOnce(new Error("Network down"));

    render(<UnifiedAdminConsole />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Live data unavailable")).toBeVisible();
    expect(within(alert).getByText(/nothing is cached/i)).toBeVisible();
    expect(within(alert).getByText("Network down")).toBeVisible();
    // No plausible-looking dashboard of zeros, and no claim of a cache.
    expect(screen.queryByText("TOTAL PLATFORM REVENUE")).toBeNull();
    expect(screen.queryByText(/Showing cached records/i)).toBeNull();

    errorSpy.mockRestore();
  });

  /** The "Showing N of M customers" counter, whose digits are separate <strong>s. */
  const customerCount = () =>
    screen.getByText((_content, element) => element?.classList?.contains("results-count"));

  const openCustomersTab = async (user, nav) => {
    await user.click(within(nav).getByRole("button", { name: /Customers Insights/ }));
    await screen.findByRole("main");
  };

  /** The "Showing N of M order records" counter, whose digits are separate <strong>s. */
  const orderCount = () =>
    screen.getByText((_content, element) => element?.classList?.contains("results-count"));

  const CUSTOMER_SEARCH = "Search customers by name, email, or store...";

  it("filters customers by name and email and updates the visible count", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      { id: "c1", full_name: "Asha Rao", email: "asha@marvel.com", role: "user", status: "active" },
      { id: "c2", full_name: "Ben Ito", email: "ben@marvel.com", role: "user", status: "active" },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await openCustomersTab(user, nav);
    await screen.findByText("Asha Rao");
    expect(customerCount()).toHaveTextContent("Showing 2 of 2 customers");

    const search = screen.getByPlaceholderText(CUSTOMER_SEARCH);
    await user.type(search, "asha");
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Ben Ito")).toBeNull();
    expect(customerCount()).toHaveTextContent("Showing 1 of 2 customers");

    await user.clear(search);
    await user.type(search, "ben@marvel");
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.getByText("Ben Ito")).toBeVisible();
    expect(customerCount()).toHaveTextContent("Showing 1 of 2 customers");
  });

  it("matches a customer's store name", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      {
        id: "c1",
        full_name: "Asha Rao",
        email: "asha@marvel.com",
        role: "user",
        status: "active",
        store_name: "Asha Textiles",
      },
      { id: "c2", full_name: "Ben Ito", email: "ben@marvel.com", role: "user", status: "active" },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await openCustomersTab(user, nav);
    await screen.findByText("Asha Rao");

    await user.type(screen.getByPlaceholderText(CUSTOMER_SEARCH), "textiles");
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Ben Ito")).toBeNull();
    expect(customerCount()).toHaveTextContent("Showing 1 of 2 customers");
  });

  it("shows the empty state when no customer matches the search", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      { id: "c1", full_name: "Asha Rao", email: "asha@marvel.com", role: "user", status: "active" },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await openCustomersTab(user, nav);
    await screen.findByText("Asha Rao");

    await user.type(screen.getByPlaceholderText(CUSTOMER_SEARCH), "nobody-here");
    expect(screen.getByText("No customers match your search.")).toBeVisible();
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(customerCount()).toHaveTextContent("Showing 0 of 1 customers");
  });

  it("filters the repeat-buyer segment, not just all customers", async () => {
    const user = userEvent.setup();
    apiFetchAllUsers.mockResolvedValueOnce([
      { id: "c1", full_name: "Asha Rao", email: "asha@marvel.com", role: "user", status: "active" },
      { id: "c2", full_name: "Ben Ito", email: "ben@marvel.com", role: "user", status: "active" },
    ]);
    apiFetchOrders.mockResolvedValueOnce([
      {
        id: "o1",
        user_id: "c1",
        customer_email: "asha@marvel.com",
        total_amount: 100,
        status: "delivered",
        created_at: "2026-10-01T10:00:00Z",
      },
      {
        id: "o2",
        user_id: "c1",
        customer_email: "asha@marvel.com",
        total_amount: 50,
        status: "delivered",
        created_at: "2026-10-02T10:00:00Z",
      },
      {
        id: "o3",
        user_id: "c2",
        customer_email: "ben@marvel.com",
        total_amount: 70,
        status: "pending",
        created_at: "2026-10-03T10:00:00Z",
      },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await openCustomersTab(user, nav);
    const main = screen.getByRole("main");
    await user.click(within(main).getByRole("button", { name: /^Repeat Buyers/ }));
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Ben Ito")).toBeNull();
    expect(customerCount()).toHaveTextContent("Showing 1 of 1 customers");

    // Ben only bought once, so searching for him inside the repeat segment
    // matches nothing — the search filters the dataset the pills show.
    await user.type(screen.getByPlaceholderText(CUSTOMER_SEARCH), "ben");
    expect(screen.getByText("No customers match your search.")).toBeVisible();
    expect(screen.queryByText("Asha Rao")).toBeNull();
  });

  it("filters orders by reference, customer and item, and updates the visible count", async () => {
    const user = userEvent.setup();
    apiFetchOrders.mockResolvedValueOnce([
      {
        id: "11111111-2222-4333-8444-55555555aaaa",
        customer_name: "Asha Rao",
        customer_email: "asha@marvel.com",
        status: "pending",
        total_amount: 1200,
        items: [{ title: "Aurora Speaker", price: 1200, quantity: 1 }],
      },
      {
        id: "11111111-2222-4333-8444-66666666bbbb",
        customer_name: "Ben Ito",
        customer_email: "ben@marvel.com",
        status: "delivered",
        total_amount: 3400,
        items: [{ title: "Chronos Watch", price: 3400, quantity: 1 }],
      },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Orders Pipeline/ }));
    await screen.findByRole("main");

    const search = screen.getByPlaceholderText("Search orders by reference, customer, or item...");
    await user.type(search, "asha");
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Ben Ito")).toBeNull();
    expect(orderCount()).toHaveTextContent("Showing 1 of 2 order records");

    await user.clear(search);
    await user.type(search, "chronos");
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.getByText("Ben Ito")).toBeVisible();

    await user.clear(search);
    await user.type(search, "ben@marvel");
    expect(screen.getByText("Ben Ito")).toBeVisible();
    expect(screen.queryByText("Asha Rao")).toBeNull();
  });

  it("shows the empty state when no order matches the search", async () => {
    const user = userEvent.setup();
    apiFetchOrders.mockResolvedValueOnce([
      {
        id: "11111111-2222-4333-8444-55555555aaaa",
        customer_name: "Asha Rao",
        customer_email: "asha@marvel.com",
        status: "pending",
        total_amount: 1200,
        items: [],
      },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Orders Pipeline/ }));
    await screen.findByRole("main");

    const search = screen.getByPlaceholderText("Search orders by reference, customer, or item...");
    await user.type(search, "nobody-here");

    expect(screen.getByText("No orders match your search.")).toBeVisible();
  });

  it("gives each order a reference that actually tells them apart", async () => {
    const user = userEvent.setup();
    // Two ids that share a head, the way a batch-minted set does.
    apiFetchOrders.mockResolvedValueOnce([
      { id: "f2000000-0000-4000-8000-aaaaaaaaaaaa", customer_name: "A", status: "pending" },
      { id: "f2000000-0000-4000-8000-bbbbbbbbbbbb", customer_name: "B", status: "pending" },
    ]);
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    await user.click(within(nav).getByRole("button", { name: /Orders Pipeline/ }));
    await screen.findByRole("main");

    const refs = screen.getAllByText(/^#[0-9a-f]{8}$/).map((node) => node.textContent);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("keeps only one sidebar section open at a time", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    const dashboard = within(nav).getByRole("button", { name: /Dashboard Live Metrics/ });
    const usersTab = within(nav).getByRole("button", { name: /Users Accounts/ });
    const productsTab = within(nav).getByRole("button", { name: /Products Catalog/ });

    expect(dashboard).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("button", { name: "Overview" })).toBeVisible();

    await user.click(usersTab);
    expect(usersTab).toHaveAttribute("aria-expanded", "true");
    expect(dashboard).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("button", { name: "Overview" })).toBeNull();
    expect(within(nav).getByRole("button", { name: /View Users/ })).toBeVisible();

    await user.click(productsTab);
    expect(productsTab).toHaveAttribute("aria-expanded", "true");
    expect(usersTab).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("button", { name: /View Users/ })).toBeNull();
    expect(within(nav).getAllByRole("button", { expanded: true })).toHaveLength(1);
  });

  it("closes the open sidebar section when it is clicked again", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    const usersTab = within(nav).getByRole("button", { name: /Users Accounts/ });

    await user.click(usersTab);
    expect(usersTab).toHaveAttribute("aria-expanded", "true");

    await user.click(usersTab);
    expect(usersTab).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("button", { name: /View Users/ })).toBeNull();
    expect(within(nav).queryAllByRole("button", { expanded: true })).toHaveLength(0);
  });

  it("opens the parent section when one of its sub-items is clicked", async () => {
    const user = userEvent.setup();
    render(<UnifiedAdminConsole />);

    const nav = await screen.findByRole("navigation");
    const ordersTab = within(nav).getByRole("button", { name: /Orders Pipeline/ });
    const dashboard = within(nav).getByRole("button", { name: /Dashboard Live Metrics/ });

    await user.click(ordersTab);
    expect(ordersTab).toHaveAttribute("aria-expanded", "true");
    expect(dashboard).toHaveAttribute("aria-expanded", "false");

    await user.click(within(nav).getByRole("button", { name: /^Pending/ }));
    expect(ordersTab).toHaveAttribute("aria-expanded", "true");
    expect(dashboard).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).getAllByRole("button", { expanded: true })).toHaveLength(1);
    expect(
      within(screen.getByRole("main")).getByRole("button", { name: "Pending (0)" })
    ).toBeVisible();
  });
});
