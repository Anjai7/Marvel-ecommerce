import { expect, test } from "@playwright/test";

const LIVE_SLIDE = {
  id: "live-1",
  badge: "LIVE TEST SALE",
  title: "Live Dynamic Slide",
  subtitle: "Served from the content API.",
  btn_text: "Shop Live",
  btn_path: "/products",
  bg_image_url:
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&h=700&fit=crop&q=85",
  product_image_url:
    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop&q=90",
  fallback_image_url: "",
  bg_gradient: "linear-gradient(135deg, #091322 0%, #172a45 100%)",
  price_text: "From \u20B91",
  tag: "Live Tag",
  ribbon_text: "",
  order_index: 0,
  is_active: true,
};

test("dynamic hero renders live slides when the content API returns data", async ({ page }) => {
  await page.route("**/api/content/hero", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slides: [LIVE_SLIDE] }),
    })
  );

  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  await expect(
    page.locator(".hero-slide.active .hero-title").getByText("Live Dynamic Slide")
  ).toBeVisible();
  await expect(page.locator(".hero-dots")).toBeVisible();
});

test("storefront falls back to static hero and categories when content APIs fail", async ({
  page,
}) => {
  // Live DB has no migration applied (tables missing) -> fetches return []
  // or 500. The storefront must still render static fallback content.
  await page.route("**/api/content/hero", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "relation does not exist" }),
    })
  );
  await page.route("**/api/content/categories", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "relation does not exist" }),
    })
  );

  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  await expect(page.locator(".hero-carousel")).toBeVisible();
  await expect(page.locator(".hero-slide .hero-title").first()).toContainText("Upgrade Your");
  await expect(page.locator(".cat-slider")).toBeVisible();
  await expect(page.locator(".cat-slider .cat-label").first()).toContainText("Mobiles");
});

test("dynamic menu falls back to static mega-menu when the menu API fails", async ({ page }) => {
  await page.route("**/api/menu**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "relation does not exist" }),
    })
  );

  // DynamicMenu renders on non-storefront routes (App.jsx).
  const response = await page.goto("/#/login");
  expect(response?.ok()).toBe(true);

  const nav = page.locator("nav.dynamic-menu");
  await expect(nav).toBeVisible();
  await expect(nav.getByText("Electronics", { exact: true }).first()).toBeVisible();

  await nav.getByText("Electronics", { exact: true }).first().hover();
  await expect(page.locator(".mega-menu").first()).toBeVisible();
});

for (const viewport of [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
]) {
  test(`no horizontal page overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page.locator(".hero-carousel")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
