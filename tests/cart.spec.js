import { expect, test } from "@playwright/test";

const SEEDED_CART = [
  {
    id: "p1",
    title: "Wireless Noise-Canceling Headphones Pro",
    price: 19999,
    originalPrice: 24999,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
    category: "Electronics",
    quantity: 2,
  },
  {
    id: "p2",
    title: "Smart OLED Watch Ultra",
    price: 34950,
    originalPrice: 39900,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80",
    category: "Wearables",
    quantity: 1,
  },
];

/**
 * The cart is per signed-in user now, so the cart page asks a guest to sign
 * in. Every test here signs the seeded customer in first — the cart it then
 * sees is that customer's, seeded below.
 */
async function signIn(page) {
  await page.goto("/#/login");
  await page.getByPlaceholder("you@example.com").first().fill("user@marvel.com");
  await page.getByPlaceholder("••••••••").first().fill("user123");
  await page.getByPlaceholder("••••••••").first().press("Enter");
  await page.waitForTimeout(1200);
}

/**
 * The cart belongs to the signed-in user, so the guest key is ignored. Seed
 * the key that user's cart is kept under.
 */
async function seedCart(page, items) {
  // The signed-in user's id is in the token the app keeps.
  const id = await page.evaluate(() => {
    const token = window.localStorage.getItem("marvel_jwt_token");
    if (!token) return null;
    try {
      return JSON.parse(window.atob(token.split(".")[1])).id ?? null;
    } catch {
      return null;
    }
  });
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    [`marvel_cart_user_${id}`, items]
  );

  // A hash change does not reload the document, so the app would keep the
  // cart it already has. Reloading puts the seeded cart in front of it.
  await page.reload();
  await page.waitForTimeout(800);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`cart has a plain heading and no promo banner (${viewport.name})`, async ({ page }) => {
    await signIn(page);
    await seedCart(page, SEEDED_CART);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/#/cart");

    await expect(page.locator(".cart-banner")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
    await expect(page.locator(".cart-page-head").getByText("3 items")).toBeVisible();
  });
}

test("cart page shows items with working quantity steppers and totals", async ({ page }) => {
  await signIn(page);
  await seedCart(page, SEEDED_CART);
  await page.goto("/#/cart");

  await expect(
    page.getByRole("heading", { name: "Wireless Noise-Canceling Headphones Pro" })
  ).toBeVisible();
  const subtotalRow = page.locator(".cart-summary-row", { hasText: "Subtotal" });
  const totalRow = page.locator(".cart-summary-row.cart-total");
  await expect(subtotalRow).toContainText("₹74,948"); // 19999*2 + 34950

  await page
    .getByRole("button", {
      name: "Increase quantity for Wireless Noise-Canceling Headphones Pro",
    })
    .click();
  await expect(
    page.getByLabel("Quantity for Wireless Noise-Canceling Headphones Pro", { exact: true })
  ).toHaveText("3");
  await expect(subtotalRow).toContainText("₹94,947"); // 19999*3 + 34950
  await expect(totalRow).toContainText("₹94,947");
  await expect(page.locator(".cart-summary").getByText("19,950")).toBeVisible(); // savings

  await page.getByRole("button", { name: "Remove Smart OLED Watch Ultra from cart" }).click();
  await expect(page.getByRole("heading", { name: "Smart OLED Watch Ultra" })).toHaveCount(0);
  await expect(page.locator(".cart-page-head").getByText("3 items")).toBeVisible(); // p1 ×3 remains
});

test("cart page empty state links back to shopping", async ({ page }) => {
  await signIn(page);
  await seedCart(page, []);
  await page.goto("/#/cart");

  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await page.getByRole("button", { name: "Continue Shopping" }).click();
  await expect(page.getByRole("img", { name: "Marvel Logo" })).toBeVisible();
});

test("header cart badge reflects the real cart and links to the cart page", async ({ page }) => {
  await signIn(page);
  await seedCart(page, SEEDED_CART);
  await page.goto("/");

  await expect(page.locator(".cart-badge")).toHaveText("3");
  await page.locator("#cart-btn").click();
  await page.getByRole("button", { name: "View Cart" }).click();
  await expect(page).toHaveURL(/(#\/|\/)cart/);
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
});
