import { expect, test } from "@playwright/test";

/**
 * The category landing page.
 *
 * The route carries the FULL ancestor path (`#/category/electronics/accessories`),
 * because a category slug is only unique per parent — the seeded tree has three
 * categories called "accessories" and two called "watches". The specs below
 * prove the page resolves the path segment by segment and lands on the intended
 * one, and that a link in the navigation reaches it.
 *
 * Everything here is served from mocked API responses, so the suite runs with no
 * database. The one live spec at the bottom is gated on the schema being applied.
 */

const TREE = [
  {
    id: "c-electronics",
    name: "Electronics",
    slug: "electronics",
    level: 1,
    parent_id: null,
    is_active: true,
    description: "The electronics root.",
    children: [
      {
        id: "c-acc-electronics",
        name: "Accessories",
        slug: "accessories",
        level: 2,
        parent_id: "c-electronics",
        is_active: true,
        description: "Accessories under Electronics.",
        children: [
          {
            id: "c-watch-acc",
            name: "Watches",
            slug: "watches",
            level: 3,
            parent_id: "c-acc-electronics",
            is_active: true,
            description: "Watches under Electronics accessories.",
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "c-acc-root",
    name: "Accessories",
    slug: "accessories",
    level: 1,
    parent_id: null,
    is_active: true,
    description: "The root Accessories category.",
    children: [],
  },
];

const PRODUCTS = [
  {
    id: "p-1",
    title: "Braided Cable",
    price: 9.99,
    original_price: 19.99,
    image_url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=400&fit=crop",
    rating: 4.4,
    reviews_count: 12,
    category: "Accessories",
    discount: 50,
  },
];

/** Install the content API stubs the storefront and the category page read. */
async function stubContent(page, { tree = TREE, products = PRODUCTS } = {}) {
  await page.route("**/api/content/hero", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slides: [] }),
    })
  );
  await page.route("**/api/content/banners", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ banners: [] }),
    })
  );
  await page.route("**/api/content/footer", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sections: [], links: [] }),
    })
  );
  await page.route("**/api/menu**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
  await page.route("**/api/categories/tree**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: tree }),
    })
  );
  await page.route("**/api/categories/path**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ category: null, ancestors: [], descendants: [] }),
    })
  );
  await page.route("**/api/categories**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: tree }),
    })
  );
  await page.route("**/api/products**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(products) })
  );
  // The category listing reads its own endpoint, which answers the shape of
  // the listing and not a bare array.
  await page.route("**/api/categories/products**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: products,
        total: products.length,
        page: 1,
        pageSize: 0,
        hasMore: false,
      }),
    })
  );
}

test.describe("category landing page", () => {
  test("a full ancestor path resolves to that level, not a same-named sibling", async ({
    page,
  }) => {
    await stubContent(page);

    const response = await page.goto("/#/category/electronics/accessories");
    expect(response?.ok()).toBe(true);

    // The level-2 Accessories under Electronics — proven by its own description
    // and by the fact that it has a child chip. The root Accessories has neither.
    await expect(page.getByText("Accessories under Electronics.")).toBeVisible();
    await expect(page.getByText("The root Accessories category.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Watches/ })).toBeVisible();
  });

  test("the breadcrumb lists the ancestors", async ({ page }) => {
    await stubContent(page);
    await page.goto("/#/category/electronics/accessories/watches");

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("Electronics", { exact: true })).toBeVisible();
    await expect(breadcrumb.getByText("Accessories", { exact: true })).toBeVisible();
    await expect(breadcrumb.getByText("Watches", { exact: true })).toBeVisible();
  });

  test("a subcategory chip navigates to the child's full ancestor path", async ({ page }) => {
    await stubContent(page);
    await page.goto("/#/category/electronics/accessories");

    await page.getByRole("button", { name: /Watches/ }).click();

    await expect(page).toHaveURL(/#\/category\/electronics\/accessories\/watches$/);
  });

  test("the product grid renders the products for that category", async ({ page }) => {
    await stubContent(page);
    await page.goto("/#/category/electronics/accessories");

    await expect(page.getByText("Braided Cable")).toBeVisible();
  });

  test("an unknown path shows the not-found state, not the homepage", async ({ page }) => {
    await stubContent(page);
    await page.goto("/#/category/electronics/nope");

    await expect(page.getByText("Category not found.")).toBeVisible();
    // It must not have bounced back to the storefront.
    await expect(page).toHaveURL(/#\/category\/electronics\/nope$/);
  });

  test("a navigation link to a category path lands on the category page", async ({ page }) => {
    await stubContent(page);

    await page.route("**/api/menu**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "m-1",
            title: "Electronics",
            path: "/category/electronics",
            icon: "Cpu",
            order_index: 0,
            is_active: true,
            level: 1,
            parent_id: null,
            children: [
              {
                id: "m-2",
                title: "Accessories",
                path: "/category/electronics/accessories",
                section: "Shop by Type",
                section_icon: "🔌",
                order_index: 0,
                is_active: true,
                level: 2,
                parent_id: "m-1",
                children: [],
              },
            ],
          },
        ]),
      })
    );

    await page.goto("/");
    const nav = page.locator("nav.hover-nav");
    await expect(nav).toBeVisible();
    await nav.getByText("Electronics", { exact: true }).first().hover();
    await page
      .locator(".mega-menu")
      .first()
      .getByRole("menuitem", { name: /Accessories/ })
      .click();

    await expect(page).toHaveURL(/#\/category\/electronics\/accessories$/);
    await expect(page.getByText("Accessories under Electronics.")).toBeVisible();
  });
});

/**
 * The live spec needs the schema applied and the seeds run. It is gated on a
 * cheap probe so it starts passing by itself the moment the human applies
 * `docs/sql/apply-01-content-taxonomy.sql` — it is never unconditionally skipped.
 */
test("a live category page lists products from the seeded taxonomy", async ({ page, request }) => {
  const probe = await request.get("/api/categories/tree?includeInactive=0").catch(() => null);
  const tree = probe && probe.ok() ? await probe.json().catch(() => null) : null;
  const root = tree?.categories?.find(
    (node) => node.level === 1 && (node.children?.length ?? 0) > 0
  );
  if (!root) {
    test.skip(
      true,
      "the categories schema is not applied yet — run docs/sql/apply-01-content-taxonomy.sql, then the seeds in docs/sql/apply-03-run-seeds.md"
    );
  }

  const child = root.children[0];
  const path = `${root.slug}/${child.slug}`;
  await page.goto(`/#/category/${path}`);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(child.name, { exact: true }).first()).toBeVisible();
});
