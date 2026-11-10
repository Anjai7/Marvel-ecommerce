import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The admin forms live in the page instead of over it. These checks pin that
// down: the panel is in the normal flow, the list behind it stays visible,
// and the destructive write asks inline too.
//
// Covers the admin console shell against the seeded dev database
// (admin@marvel.com / admin123). Read-only: no data is mutated.
//
// The describe is serial on purpose. Every admin page load fans out to the
// one Express API, which waits on Supabase, so running these in parallel
// starves the storefront specs that share that API and makes them time out
// for reasons that have nothing to do with the code under test.
test.describe("admin inline panels", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill("admin@marvel.com");
    await page.getByPlaceholder("••••••••").first().fill("admin123");
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ timeout: 20000 });
  });

  test("the product form sits in the page, with the catalog still visible behind it", async ({
    page,
  }) => {
    await page.locator("#admin-tab-products").click();
    await page.locator("#admin-tab-products-add").click();

    const panel = page.getByRole("region", { name: "Add Product" });
    await expect(panel).toBeVisible();

    // It is a panel in the flow, not a popup over the page.
    const position = await panel.evaluate((node) => getComputedStyle(node).position);
    expect(position).not.toBe("fixed");

    // The catalog behind it is not covered by a backdrop, so it stays visible.
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: "Close the product form" }).click();
    await expect(panel).toHaveCount(0);
  });

  test("the delete confirmation asks inline, beside the list it acts on", async ({ page }) => {
    await page.locator("#admin-tab-users").click();
    await page.locator("#admin-tab-users-list").click();

    // The delete action of the first row that is not the signed-in admin.
    const row = page.locator(".users-table .user-table-row").first();
    await row.locator("button.delete-btn").click();

    const strip = page.getByRole("alertdialog");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("cannot be undone");

    const position = await strip.evaluate((node) => getComputedStyle(node).position);
    expect(position).not.toBe("fixed");

    await strip.getByRole("button", { name: "Cancel" }).click();
    await expect(strip).toHaveCount(0);
  });

  test("the user panel is accessible and fits a narrow screen", async ({ page }, testInfo) => {
    await page.locator("#admin-tab-users").click();
    await page.locator("#admin-tab-users-add").click();

    const panel = page.getByRole("region", { name: "Create User Account" });
    await expect(panel).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include(".admin-inline-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const report = results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(" ")),
    }));

    await testInfo.attach("axe-summary", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    const criticalViolations = results.violations.filter(({ impact }) => impact === "critical");
    expect(criticalViolations, JSON.stringify(report, null, 2)).toEqual([]);

    for (const viewport of [
      { name: "mobile-360", width: 360, height: 800 },
      { name: "tablet-768", width: 768, height: 1024 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // On a narrow screen the sidebar is a drawer, so it is opened first.
      const toggle = page.getByRole("button", { name: "Open navigation menu" });
      if (await toggle.isVisible()) {
        await toggle.click();
      }

      const overflow = await panel.evaluate(
        (node) => node.getBoundingClientRect().right - window.innerWidth
      );
      expect(overflow, `the panel overflows at ${viewport.name}`).toBeLessThanOrEqual(1);
    }
  });
});
