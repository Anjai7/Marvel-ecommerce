import { expect, test } from "@playwright/test";

test("product gallery auto-slides through photos", async ({ page, request }) => {
  const res = await request.get("/api/products");
  expect(res.ok()).toBe(true);
  const products = await res.json();
  test.skip(!Array.isArray(products) || products.length === 0, "needs at least one product in the database");

  await page.goto(`/#/product/${products[0].id}`);
  const counter = page.locator(".pvg-counter");
  await expect(counter).toBeVisible();

  const text = await counter.innerText();
  const total = Number(/of (\d+)/.exec(text)?.[1] || "0");
  test.skip(total < 2, "needs at least two gallery media items to observe sliding");

  await expect
    .poll(async () => page.locator(".pvg-counter").innerText(), { timeout: 12000 })
    .not.toBe(text);

  // Play/pause toggle is available and labelled
  await expect(
    page.getByRole("button", { name: /Pause auto-slide|Play auto-slide/ })
  ).toBeVisible();
});

test("gallery holds while the pointer is over the main image", async ({
  page,
  request,
}) => {
  const res = await request.get("/api/products");
  expect(res.ok()).toBe(true);
  const products = await res.json();
  test.skip(!Array.isArray(products) || products.length === 0, "needs at least one product in the database");

  await page.goto(`/#/product/${products[0].id}`);
  const counter = page.locator(".pvg-counter");
  await expect(counter).toBeVisible();

  // Hovering the big image pauses (zoom inspection); it must hold still.
  await page.locator(".pvg-main-wrap").hover();
  const frozen = await counter.innerText();
  await page.waitForTimeout(6000);
  await expect(counter).toHaveText(frozen);
});
