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

async function seedCart(page, items) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("marvel_cart", JSON.stringify(value));
  }, items);
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`cart banner joins image with text as one unit (${viewport.name})`, async ({ page }) => {
    await seedCart(page, SEEDED_CART);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/#/cart");

    const banner = page.locator(".cart-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("heading", { name: "Your Cart" })).toBeVisible();
    await expect(banner.getByText("3 items")).toBeVisible();

    // Image and text live inside the same card and overlap along the
    // stacking axis (joined, not fighting): vertically on desktop (row),
    // horizontally on mobile (centered column).
    const [bannerBox, imgBox, textBox] = await Promise.all([
      banner.boundingBox(),
      banner.locator(".cart-banner-img").boundingBox(),
      banner.locator(".cart-banner-text").boundingBox(),
    ]);
    expect(bannerBox).not.toBeNull();
    expect(imgBox).not.toBeNull();
    expect(textBox).not.toBeNull();
    for (const box of [imgBox, textBox]) {
      expect(box.x).toBeGreaterThanOrEqual(bannerBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(bannerBox.x + bannerBox.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(bannerBox.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(bannerBox.y + bannerBox.height + 1);
    }

    const flexDirection = await banner.evaluate((el) => getComputedStyle(el).flexDirection);
    if (flexDirection === "column") {
      const horizontalOverlap =
        Math.min(imgBox.x + imgBox.width, textBox.x + textBox.width) -
        Math.max(imgBox.x, textBox.x);
      expect(horizontalOverlap).toBeGreaterThan(0);
    } else {
      const verticalOverlap =
        Math.min(imgBox.y + imgBox.height, textBox.y + textBox.height) -
        Math.max(imgBox.y, textBox.y);
      expect(verticalOverlap).toBeGreaterThan(0);
    }

    if (viewport.name === "mobile") {
      expect(flexDirection).toBe("column");
    }
  });
}

test("cart page shows items with working quantity steppers and totals", async ({ page }) => {
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
  await expect(page.getByText("19,950")).toBeVisible(); // savings

  await page.getByRole("button", { name: "Remove Smart OLED Watch Ultra from cart" }).click();
  await expect(page.getByRole("heading", { name: "Smart OLED Watch Ultra" })).toHaveCount(0);
  await expect(page.locator(".cart-banner").getByText("3 items")).toBeVisible(); // p1 ×3 remains
});

test("cart page empty state links back to shopping", async ({ page }) => {
  await seedCart(page, []);
  await page.goto("/#/cart");

  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await page.getByRole("button", { name: "Continue Shopping" }).click();
  await expect(page.getByRole("img", { name: "Marvel Logo" })).toBeVisible();
});

test("header cart badge reflects the real cart and links to the cart page", async ({ page }) => {
  await seedCart(page, SEEDED_CART);
  await page.goto("/");

  await expect(page.locator(".cart-badge")).toHaveText("3");
  await page.locator("#cart-btn").click();
  await page.getByRole("button", { name: "View Cart" }).click();
  await expect(page).toHaveURL(/#\/cart/);
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
});
