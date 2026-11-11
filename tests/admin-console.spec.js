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

  test("products submenu has only View Product and Add Product, no in-page extra button, and form validates mandatory fields with red indication", async ({
    page,
  }) => {
    await page.locator("#admin-tab-products").click();
    await expect(page.locator("#admin-tab-products-list")).toContainText("View Product");
    await expect(page.locator("#admin-tab-products-add")).toContainText("Add Product");
    await expect(page.getByText("All Products")).toHaveCount(0);

    // Verify there is no extra in-page add button inside the page
    await page.locator("#admin-tab-products-list").click();
    await expect(page.locator("#admin-add-product-button")).toHaveCount(0);

    // Open add product modal from sidebar
    await page.locator("#admin-tab-products-add").click();
    await expect(page.getByRole("button", { name: "Publish Product" })).toBeVisible();

    // Verify the required-field mark
    await expect(page.getByText("Product Title *")).toBeVisible();
    await expect(page.getByText("Price (₹) *")).toBeVisible();
    await expect(page.getByText("Product Image *")).toBeVisible();
    await expect(page.getByText("Description *")).toBeVisible();

    // Click Publish Product without filling fields to trigger validation
    await page.getByRole("button", { name: "Publish Product" }).click();

    // Verify red errors show up for mandatory fields
    await expect(page.getByText("Product title is required.")).toBeVisible();
    await expect(page.getByText("Valid product price is required.")).toBeVisible();
    await expect(page.getByText("Product image is required.")).toBeVisible();
    await expect(page.getByText("Product description is required.")).toBeVisible();
  });

  test("sidebar exposes the Pages editor", async ({ page }) => {
    await page.locator("#admin-tab-site-content").click();
    await expect(page.locator("#admin-tab-site-content-pages")).toBeVisible();
    await page.locator("#admin-tab-site-content-pages").click();
    await expect(page.getByRole("heading", { name: "Pages", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New page" })).toBeVisible();
  });

  test("mobile side panel opens as drawer and navigates smoothly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.getByRole("button", { name: "Open navigation menu" });
    await expect(toggle).toBeVisible();

    const sidebar = page.locator("#admin-sidebar");
    await expect(sidebar).not.toHaveClass(/mobile-open/);

    await toggle.click();
    await expect(sidebar).toHaveClass(/mobile-open/);

    // Clicking an item closes drawer and navigates
    await page.locator("#admin-tab-dashboard-sales").click();
    await expect(sidebar).not.toHaveClass(/mobile-open/);
    await expect(page.getByText("Today Orders")).toBeVisible();
  });

  test("main top navbar remains fixed and sticky when scrolling the viewport", async ({ page }) => {
    const navbar = page.locator(".main-top-navbar");
    await expect(navbar).toBeVisible();

    const initialBox = await navbar.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(initialBox.y).toBe(0);

    // Scroll down inside the admin-main-viewport
    await page.locator(".admin-main-viewport").evaluate((el) => el.scrollTo({ top: 400 }));
    await page.waitForTimeout(100);

    const scrolledBox = await navbar.boundingBox();
    expect(scrolledBox).not.toBeNull();
    // Navbar y position remains 0 (fixed/sticky at top)
    expect(scrolledBox.y).toBe(0);
    await expect(navbar).toBeVisible();
  });

  test("main top navbar remains fixed at top when scrolling on tablet and mobile viewports", async ({
    page,
  }) => {
    // 1. Tablet viewport (e.g. 815px width)
    await page.setViewportSize({ width: 815, height: 1024 });
    const navbar = page.locator(".main-top-navbar");
    await expect(navbar).toBeVisible();

    const initialTabletBox = await navbar.boundingBox();
    expect(initialTabletBox).not.toBeNull();
    expect(initialTabletBox.y).toBe(0);

    // Scroll down inside the admin-main-viewport
    await page.locator(".admin-main-viewport").evaluate((el) => el.scrollTo({ top: 400 }));
    await page.waitForTimeout(100);

    const scrolledTabletBox = await navbar.boundingBox();
    expect(scrolledTabletBox).not.toBeNull();
    expect(scrolledTabletBox.y).toBe(0);
    await expect(navbar).toBeVisible();

    // 2. Mobile viewport (e.g. 390px width)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(navbar).toBeVisible();

    const initialMobileBox = await navbar.boundingBox();
    expect(initialMobileBox).not.toBeNull();
    expect(initialMobileBox.y).toBe(0);

    await page.locator(".admin-main-viewport").evaluate((el) => el.scrollTo({ top: 400 }));
    await page.waitForTimeout(100);

    const scrolledMobileBox = await navbar.boundingBox();
    expect(scrolledMobileBox).not.toBeNull();
    expect(scrolledMobileBox.y).toBe(0);
    await expect(navbar).toBeVisible();
  });

  test("automatically logs out and redirects to /login on inactivity timeout", async ({ page }) => {
    await expect(page.locator(".main-top-navbar")).toBeVisible();

    // Simulate inactivity by setting timestamp to 6 minutes ago
    await page.evaluate(() => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      localStorage.setItem("marvel_admin_last_activity", String(sixMinutesAgo));
    });

    // Wait for periodic check to trigger expiration
    await page.waitForTimeout(1200);

    // Verify redirected to /login with session expired notification
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Session expired due to 5 minutes of inactivity")).toBeVisible();
  });
});
