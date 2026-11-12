import { expect, test } from "@playwright/test";

const SAMPLE_PAGE = {
  id: "p-diwali",
  title: "Diwali Sale",
  slug: "diwali-sale",
  kind: "campaign",
  template: "landing",
  status: "published",
  published_at: "2026-10-01T00:00:00Z",
  scheduled_at: null,
  expired_at: null,
  seo: {
    title: "Diwali Mega Sale",
    description: "Save big on Diwali electronics and gifts.",
    canonical: "https://marvel.example/pages/diwali-sale",
  },
  updated_at: "2026-10-20T00:00:00Z",
};

const SAMPLE_SECTIONS = [
  {
    id: "s-hero",
    type: "hero",
    enabled: true,
    position: 0,
    data: {
      heading: "Diwali Super Festive Offers",
      eyebrow: "Limited Time",
      cta_label: "Shop Now",
      cta_href: "#/category/electronics",
    },
    style: {},
  },
  {
    id: "s-prod",
    type: "product_grid",
    enabled: true,
    position: 1,
    data: {
      columns: 4,
      limit: 4,
    },
    style: {},
  },
];

const SAMPLE_PRODUCTS = [
  { id: "pr1", title: "Iron Man Helmet", price: 1999, image_url: "https://example.com/iron.jpg" },
  {
    id: "pr2",
    title: "Captain America Shield",
    price: 2999,
    image_url: "https://example.com/shield.jpg",
  },
];

test.describe("storefront CMS pages", () => {
  test("a published page renders at its URL", async ({ page }) => {
    await page.route("**/api/pages/**diwali-sale*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: SAMPLE_PAGE, sections: SAMPLE_SECTIONS }),
      })
    );
    await page.route("**/api/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_PRODUCTS),
      })
    );

    await page.goto("/#/pages/diwali-sale");

    await expect(page.getByRole("heading", { name: "Diwali Super Festive Offers" })).toBeVisible();
    await expect(page.getByText("Iron Man Helmet")).toBeVisible();
  });

  test("an unpublished page is not visible to a customer", async ({ page }) => {
    await page.route("**/api/pages/**secret-draft*", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Page not found." }),
      })
    );

    await page.goto("/#/pages/secret-draft");

    await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();
    await expect(page.getByText("Diwali Super Festive Offers")).not.toBeVisible();
  });

  test("a draft page is visible in preview to an admin", async ({ page }) => {
    await page.route("**/api/pages/**secret-draft*", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("preview") === "1" || url.searchParams.get("preview") === "true") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            page: { ...SAMPLE_PAGE, slug: "secret-draft", status: "draft" },
            sections: SAMPLE_SECTIONS,
          }),
        });
      }
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Page not found." }),
      });
    });
    await page.route("**/api/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_PRODUCTS),
      })
    );

    await page.goto("/#/pages/secret-draft?preview=1");

    await expect(page.getByRole("heading", { name: "Diwali Super Festive Offers" })).toBeVisible();
  });

  test("an unknown section type renders the fallback and does not break the page", async ({
    page,
  }) => {
    await page.route("**/api/pages/**broken-page*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: { ...SAMPLE_PAGE, slug: "broken-page" },
          sections: [
            { id: "s-bad", type: "unsupported_widget", enabled: true, position: 0, data: {} },
            SAMPLE_SECTIONS[0],
          ],
        }),
      })
    );
    await page.route("**/api/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_PRODUCTS),
      })
    );

    await page.goto("/#/pages/broken-page");

    await expect(page.locator(".section-fallback")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Diwali Super Festive Offers" })).toBeVisible();
  });

  test("the page has a title and a meta description", async ({ page }) => {
    await page.route("**/api/pages/**diwali-sale*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: SAMPLE_PAGE, sections: SAMPLE_SECTIONS }),
      })
    );
    await page.route("**/api/products*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_PRODUCTS),
      })
    );

    await page.goto("/#/pages/diwali-sale");

    await expect(page).toHaveTitle(/Diwali Mega Sale/);
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute("content", "Save big on Diwali electronics and gifts.");
  });
});
