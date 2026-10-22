import { expect, test } from "@playwright/test";

// Covers the admin console shell against the seeded dev database
// (admin@marvel.com / admin123). Read-only: no data is mutated.
test.describe("admin console", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill("admin@marvel.com");
    await page.getByPlaceholder("••••••••").first().fill("admin123");
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ timeout: 20000 });
  });

  test("sidebar exposes menus with submenus", async ({ page }) => {
    await expect(page.locator("#admin-tab-dashboard-sales")).toBeVisible();
    await expect(page.locator("#admin-tab-products")).toBeVisible();
    await expect(page.locator("#admin-tab-orders")).toBeVisible();
    await expect(page.locator("#admin-tab-customers")).toBeVisible();

    await page.locator("#admin-tab-products").click();
    await expect(page.locator("#admin-tab-products-add")).toBeVisible();
  });

  test("sales report shows real-data sections", async ({ page }) => {
    await page.locator("#admin-tab-dashboard-sales").click();
    await expect(page.getByText("Today Orders")).toBeVisible();
    // "Repeat Customers" is rendered twice (a desktop and a mobile variant of
    // the report card), so the locator must not be strict.
    await expect(page.getByText("Repeat Customers").first()).toBeVisible();
    // "Orders Pipeline" is the content heading of the Orders tab, not a
    // section of the sales report, so it is asserted after opening that tab.
    await page.locator("#admin-tab-orders").click();
    await expect(page.getByText("Orders Pipeline", { exact: true })).toBeVisible();
  });

  test("products view offers an add-product flow", async ({ page }) => {
    await page.locator("#admin-tab-products").click();
    await page.locator("#admin-tab-products-list").click();
    await page.locator("#admin-tab-products-add").click();
    await expect(page.getByRole("button", { name: "Publish Product" })).toBeVisible();
  });

  test("sidebar exposes the Pages editor", async ({ page }) => {
    await page.locator("#admin-tab-site-content").click();
    await expect(page.locator("#admin-tab-site-content-pages")).toBeVisible();
    await page.locator("#admin-tab-site-content-pages").click();
    await expect(page.getByRole("heading", { name: "Pages", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New page" })).toBeVisible();
  });
});
