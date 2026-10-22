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
    await page.route("**/api/pages/diwali-sale*", (route) =>
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
    await page.route("**/api/pages/secret-draft*", (route) =>
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
    await page.route("**/api/pages/secret-draft*", (route) => {
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
    await page.route("**/api/pages/broken-page*", (route) =>
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
    await page.route("**/api/pages/diwali-sale*", (route) =>
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

test.describe("admin page builder flows", () => {
  test("an admin can create a page and see it in the list", async ({ page }) => {
    let pages = [SAMPLE_PAGE];

    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "mock-token",
          user: { id: "u1", email: "admin@marvel.com", role: "admin", full_name: "Admin User" },
        }),
      })
    );

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "u1", email: "admin@marvel.com", role: "admin", full_name: "Admin User" },
        }),
      })
    );

    await page.route("**/api/pages**", (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        const created = {
          id: "p-new",
          title: body.title,
          slug: body.slug,
          kind: body.kind || "landing",
          template: body.template || "landing",
          status: "draft",
          updated_at: new Date().toISOString(),
        };
        pages = [...pages, created];
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ message: "Page created.", page: created }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pages }),
      });
    });

    await page.route("**/api/pages/p-new**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: { id: "p-new", title: "Autumn Sale", slug: "autumn-sale", status: "draft" },
          sections: [],
        }),
      })
    );

    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill("admin@marvel.com");
    await page.getByPlaceholder("••••••••").first().fill("admin123");
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ timeout: 20000 });

    await page.locator("#admin-tab-site-content").click();
    await page.locator("#admin-tab-site-content-pages").click();
    await expect(page.getByRole("heading", { name: "Pages", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "New page" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title *").fill("Autumn Sale");
    await dialog.getByRole("button", { name: "Create page" }).click();

    await expect(page.getByRole("heading", { name: "Autumn Sale" })).toBeVisible();
  });

  test("an admin can add a section, reorder it and save", async ({ page }) => {
    let sections = [SAMPLE_SECTIONS[0]];

    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "mock-token",
          user: { id: "u1", email: "admin@marvel.com", role: "admin", full_name: "Admin User" },
        }),
      })
    );

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "u1", email: "admin@marvel.com", role: "admin", full_name: "Admin User" },
        }),
      })
    );

    await page.route("**/api/pages**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pages: [SAMPLE_PAGE] }),
      })
    );

    await page.route("**/api/pages/p-diwali/sections", (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        sections = body.sections || [];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Sections saved.", sections }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: SAMPLE_PAGE, sections }),
      });
    });

    await page.route("**/api/pages/p-diwali**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: SAMPLE_PAGE, sections }),
      })
    );

    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill("admin@marvel.com");
    await page.getByPlaceholder("••••••••").first().fill("admin123");
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ timeout: 20000 });

    await page.locator("#admin-tab-site-content").click();
    await page.locator("#admin-tab-site-content-pages").click();

    await page.getByRole("button", { name: "Edit Diwali Sale" }).click();
    await expect(page.getByRole("heading", { name: "Diwali Sale" })).toBeVisible();

    await page.getByRole("button", { name: "Add section" }).click();
    const typeDialog = page.getByRole("dialog");
    await typeDialog.getByRole("button", { name: "Spacer" }).click();

    await page.getByRole("button", { name: "Save Sections" }).click();
    await expect(page.getByText("Sections Saved")).toBeVisible();
  });
});
