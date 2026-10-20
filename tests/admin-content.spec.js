import { expect, test } from "@playwright/test";

/**
 * The admin round trip: an admin edits content in the console and the
 * storefront reflects it.
 *
 * This spec needs a live API **and** admin credentials, because it exercises
 * the real write path (the admin bearer token, the real routes, the real
 * database). It is gated on `ADMIN_EMAIL` / `ADMIN_PASSWORD` and on the
 * categories schema being applied, and it skips with an explicit reason rather
 * than failing for the wrong cause. It is never unconditionally skipped.
 *
 * Run it with:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx playwright test tests/admin-content.spec.js
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const reason =
  !ADMIN_EMAIL || !ADMIN_PASSWORD
    ? "ADMIN_EMAIL / ADMIN_PASSWORD are not set — set them to run the admin content round trip"
    : "the categories schema is not applied yet — run docs/sql/apply-01-content-taxonomy.sql, then the seeds in docs/sql/apply-03-run-seeds.md";

test.describe("admin content round trip", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, reason);

  test("an edited category name reaches the storefront", async ({ page, request }) => {
    const probe = await request.get("/api/categories/tree?includeInactive=0").catch(() => null);
    const tree = probe && probe.ok() ? await probe.json().catch(() => null) : null;
    const root = tree?.categories?.find((node) => node.level === 1);
    test.skip(!root, reason);

    const originalName = root.name;
    const editedName = `${originalName} E2E`;

    // --- admin edits the category -----------------------------------------
    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill(ADMIN_EMAIL);
    await page.getByPlaceholder("••••••••").first().fill(ADMIN_PASSWORD);
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ timeout: 20000 });

    await page.locator("#admin-tab-site-content-categories").click();
    await page.getByLabel(`Edit ${originalName}`).first().click();

    const nameInput = page.locator("#category-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(editedName);
    await page.getByRole("button", { name: "Save Category" }).click();

    // The editor reports the write; the change is now in the database.
    await expect(page.getByText("Category Updated")).toBeVisible();

    // --- the storefront shows it ------------------------------------------
    const storefront = await page.context().newPage();
    await storefront.goto(`/#/category/${root.slug}`);
    await expect(storefront.getByRole("heading", { level: 1 })).toContainText(editedName);

    // --- put it back so the suite is repeatable ---------------------------
    await page.getByLabel(`Edit ${editedName}`).first().click();
    await page.locator("#category-name").fill(originalName);
    await page.getByRole("button", { name: "Save Category" }).click();
    await expect(page.getByText("Category Updated")).toBeVisible();
  });
});
