import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CategoryPage from "./CategoryPage";
import { ToastProvider } from "../ui/Toast";
import { CartProvider } from "../../context/CartContext";
import { apiFetchCategoryByPath } from "../../api/contentApi";
import { apiFetchCategoryProducts, apiFetchProducts } from "../../api/backendApi";
import { apiFetchCategoryPage } from "../../api/pagesApi";

const content = vi.hoisted(() => ({ value: null }));

vi.mock("../../context/ContentContext", () => ({
  useContent: () => content.value,
}));

vi.mock("../../api/contentApi", () => ({
  apiFetchCategoryByPath: vi.fn(),
}));

vi.mock("../../api/backendApi", () => ({
  apiFetchProducts: vi.fn(),
  apiFetchCategoryProducts: vi.fn(),
}));

// Only the request is mocked: the normaliser of the payload is real code and
// the page reads the page through it.
vi.mock("../../api/pagesApi", async (importOriginal) => ({
  ...(await importOriginal()),
  apiFetchCategoryPage: vi.fn(),
}));

const SMARTPHONES = {
  id: "c4",
  name: "Smartphones",
  slug: "smartphones",
  level: 3,
  parent_id: "c3",
  children: [],
};

const MOBILES = {
  id: "c3",
  name: "Mobiles",
  slug: "mobiles",
  level: 2,
  parent_id: "c1",
  description: "Gadgets, phones and everything powered by a battery.",
  children: [SMARTPHONES],
};

const ELECTRONICS_ACCESSORIES = {
  id: "c2",
  name: "Accessories",
  slug: "accessories",
  level: 2,
  parent_id: "c1",
  children: [],
};

const WATCHES = { id: "c7", name: "Watches", slug: "watches", level: 2, children: [] };

const ROOT_ACCESSORIES = {
  id: "c5",
  name: "Accessories",
  slug: "accessories",
  level: 1,
  parent_id: null,
  children: [WATCHES],
};

const ELECTRONICS = {
  id: "c1",
  name: "Electronics",
  slug: "electronics",
  level: 1,
  parent_id: null,
  description: "Gadgets, phones and everything powered by a battery.",
  children: [MOBILES, ELECTRONICS_ACCESSORIES],
};

const CATEGORY_TREE = [ELECTRONICS, ROOT_ACCESSORIES];

const PRODUCT = {
  id: "p1",
  title: "Galaxy S24",
  price: 79999,
  rating: 4.6,
  reviews_count: 120,
  image_url: "https://example.com/galaxy.jpg",
};

/** The answer of the listing endpoint: every product, no pagination. */
const listing = (overrides = {}) => ({
  items: [PRODUCT],
  total: 1,
  page: 1,
  pageSize: 0,
  hasMore: false,
  ...overrides,
});

/** A published page with the given sections. */
const customPage = (sections) => ({
  id: "pg1",
  title: "Mobiles",
  slug: "mobiles",
  kind: "category",
  status: "published",
  seo: {},
  sections,
});

const HERO_SECTION = {
  id: "s1",
  type: "hero",
  data: { heading: "Mobiles for every budget" },
};

const LISTING_SECTION = {
  id: "s2",
  type: "category_listing",
  data: { layout: "grid", sort: "newest", page_size: 0 },
};

const contextValue = (overrides = {}) => ({
  hero: [],
  banners: [],
  categories: [],
  categoryTree: CATEGORY_TREE,
  footer: { sections: [], links: [] },
  menu: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
  ...overrides,
});

/** The tree of a category that carries its own configuration. */
const treeWith = (category) => [
  {
    ...ELECTRONICS,
    children: [category],
  },
];

const renderPage = (path, props = {}) =>
  render(
    <ToastProvider>
      <CartProvider>
        <CategoryPage path={path} {...props} />
      </CartProvider>
    </ToastProvider>
  );

describe("CategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    content.value = contextValue();
    apiFetchProducts.mockResolvedValue([PRODUCT]);
    apiFetchCategoryProducts.mockResolvedValue(listing());
    apiFetchCategoryByPath.mockResolvedValue({
      category: { name: "Footwear", slug: "footwear", level: 2, description: "" },
      ancestors: [{ name: "Fashion", slug: "fashion" }],
      descendants: [],
    });
    // A category without a custom page is the normal case.
    apiFetchCategoryPage.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the path against the tree without a path lookup and renders name, breadcrumb, chips and products", async () => {
    const onNavigate = vi.fn();
    renderPage("electronics/mobiles", { onNavigate });

    expect(await screen.findByRole("heading", { name: "Mobiles" })).toBeVisible();
    expect(screen.getByText("Gadgets, phones and everything powered by a battery.")).toBeVisible();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent(/Home.*Electronics.*Mobiles/);

    expect(screen.getByRole("button", { name: "Smartphones" })).toBeVisible();
    expect(await screen.findByText("Galaxy S24")).toBeVisible();

    expect(apiFetchCategoryByPath).not.toHaveBeenCalled();
    expect(apiFetchCategoryProducts).toHaveBeenCalledWith(
      expect.objectContaining({ path: "electronics/mobiles" })
    );
  });

  it("resolves a three-level path to the nested category instead of a same-named root", async () => {
    renderPage("electronics/mobiles/smartphones");

    expect(await screen.findByRole("heading", { name: "Smartphones" })).toBeVisible();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent(/Home.*Electronics.*Mobiles.*Smartphones/);

    expect(screen.queryByText("Watches")).toBeNull();
    expect(apiFetchCategoryByPath).not.toHaveBeenCalled();
    expect(apiFetchCategoryProducts).toHaveBeenCalledWith(
      expect.objectContaining({ path: "electronics/mobiles/smartphones" })
    );
  });

  it("navigates a subcategory chip to the child's full ancestor path, not its bare slug", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderPage("electronics/mobiles", { onNavigate });

    await user.click(await screen.findByRole("button", { name: "Smartphones" }));
    expect(onNavigate).toHaveBeenLastCalledWith("/category/electronics/mobiles/smartphones");
  });

  it("keeps a nested sibling's parent in the chip path instead of using the bare slug", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderPage("electronics", { onNavigate });

    await user.click(await screen.findByRole("button", { name: "Accessories" }));
    expect(onNavigate).toHaveBeenLastCalledWith("/category/electronics/accessories");
  });

  it("shows a distinct empty state when the category has no products", async () => {
    apiFetchCategoryProducts.mockResolvedValue(listing({ items: [], total: 0 }));
    renderPage("electronics/mobiles");

    expect(await screen.findByText("No products in this category yet.")).toBeVisible();
    expect(screen.queryByText("Galaxy S24")).toBeNull();
  });

  it("shows the product error state when the product fetch rejects", async () => {
    apiFetchCategoryProducts.mockRejectedValue(new Error("offline"));
    renderPage("electronics/mobiles");

    expect(await screen.findByText("Could not load products.")).toBeVisible();
    expect(screen.getByText("offline")).toBeVisible();
    expect(screen.queryByText("No products in this category yet.")).toBeNull();
  });

  it("falls back to apiFetchCategoryByPath when the tree does not contain the path", async () => {
    content.value = contextValue({ categoryTree: [ROOT_ACCESSORIES] });
    renderPage("fashion/footwear");

    expect(await screen.findByRole("heading", { name: "Footwear" })).toBeVisible();
    expect(apiFetchCategoryByPath).toHaveBeenCalledWith("fashion/footwear");

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent(/Home.*Fashion.*Footwear/);
  });

  it("shows the unknown-category state for a 404 instead of bouncing to the homepage", async () => {
    content.value = contextValue({ categoryTree: [] });
    apiFetchCategoryByPath.mockRejectedValue(
      Object.assign(new Error("No category found for path 'nope/missing'."), { status: 404 })
    );
    const onNavigate = vi.fn();
    renderPage("nope/missing", { onNavigate });

    expect(await screen.findByText("Category not found.")).toBeVisible();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText("No products in this category yet.")).toBeNull();
  });

  it("shows a separate error state when the category lookup fails for another reason", async () => {
    content.value = contextValue({ categoryTree: [] });
    apiFetchCategoryByPath.mockRejectedValue(
      Object.assign(new Error("Could not load content."), { status: 500 })
    );
    renderPage("fashion/footwear");

    expect(await screen.findByText("Could not load this category.")).toBeVisible();
    expect(screen.queryByText("Category not found.")).toBeNull();
  });

  it("shows the loading state until the content context settles", async () => {
    content.value = contextValue({ loading: true });
    renderPage("electronics/mobiles");

    expect(screen.getByText("Loading category…")).toBeVisible();
    expect(apiFetchCategoryByPath).not.toHaveBeenCalled();
  });

  it("renders the default category content when the category has no custom page", async () => {
    apiFetchCategoryPage.mockResolvedValue(null);
    renderPage("electronics/mobiles");

    expect(await screen.findByRole("heading", { name: "Mobiles" })).toBeVisible();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent(/Home.*Electronics.*Mobiles/);

    expect(await screen.findByText("Galaxy S24")).toBeVisible();

    // A category without a custom page shows no section at all.
    expect(screen.queryByTestId("section-fallback")).toBeNull();
    expect(apiFetchCategoryPage).toHaveBeenCalledWith("c3");
  });

  it("renders the custom sections of the category page above the product listing", async () => {
    apiFetchCategoryPage.mockResolvedValue(customPage([HERO_SECTION]));
    const { container } = renderPage("electronics/mobiles");

    expect(await screen.findByRole("heading", { name: "Mobiles for every budget" })).toBeVisible();
    expect(await screen.findByText("Galaxy S24")).toBeVisible();

    // The section sits above the default content of the category.
    const order = container.textContent;
    const heroAt = order.indexOf("Mobiles for every budget");
    const productAt = order.indexOf("Galaxy S24");
    expect(heroAt).toBeGreaterThanOrEqual(0);
    expect(productAt).toBeGreaterThan(heroAt);
  });

  it("renders the default product listing when the custom page has no listing section", async () => {
    apiFetchCategoryPage.mockResolvedValue(customPage([HERO_SECTION]));
    renderPage("electronics/mobiles");

    expect(await screen.findByRole("heading", { name: "Mobiles for every budget" })).toBeVisible();
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
  });

  it("uses the category's own listing layout and sort when there is no custom page", async () => {
    content.value = contextValue({
      categoryTree: treeWith({
        ...MOBILES,
        listing_layout: "list",
        listing_sort: "price_asc",
      }),
    });
    renderPage("electronics/mobiles");

    await waitFor(() => expect(apiFetchCategoryProducts).toHaveBeenCalled());
    expect(apiFetchCategoryProducts).toHaveBeenCalledWith(
      expect.objectContaining({ path: "electronics/mobiles", sort: "price_asc", pageSize: 0 })
    );
  });

  it("uses the category's own SEO title when there is no custom page", async () => {
    content.value = contextValue({
      categoryTree: treeWith({ ...MOBILES, meta_title: "Smartphones" }),
    });
    renderPage("electronics/mobiles");

    await waitFor(() => expect(document.title).toBe("Smartphones"));
  });

  it("falls back to the default content when the custom page request fails", async () => {
    // The failure is reported on purpose.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    apiFetchCategoryPage.mockRejectedValue(new Error("offline"));
    renderPage("electronics/mobiles");

    expect(await screen.findByRole("heading", { name: "Mobiles" })).toBeVisible();
    expect(await screen.findByText("Galaxy S24")).toBeVisible();
    expect(screen.queryByTestId("section-fallback")).toBeNull();
  });

  it("renders the listing section of the custom page instead of the default listing", async () => {
    apiFetchCategoryPage.mockResolvedValue(customPage([LISTING_SECTION]));
    const { container } = renderPage("electronics/mobiles");

    // The section renders the products of the category itself.
    await waitFor(() => expect(container.querySelector(".section-listing")).not.toBeNull());
    expect(screen.getByText("Galaxy S24")).toBeVisible();
    // The default listing is not rendered any more.
    expect(container.querySelector(".category-listing")).toBeNull();
  });

  it("passes the category's listing control flags to the listing", async () => {
    content.value = contextValue({
      categoryTree: treeWith({
        ...MOBILES,
        listing_show_sort: true,
      }),
    });
    renderPage("electronics/mobiles");

    expect(await screen.findByLabelText("Sort by")).toBeVisible();
    expect(screen.queryByLabelText("In stock only")).toBeNull();
  });
});
