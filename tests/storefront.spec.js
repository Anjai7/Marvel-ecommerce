import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`storefront header renders with aligned auth actions (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("img", { name: "Marvel Logo" })).toBeVisible();
    await expect(page.getByPlaceholder("Search for products, brands and more...")).toBeVisible();

    const signIn = page.getByRole("button", { name: "Sign In" });
    const signUp = page.getByRole("button", { name: "Sign Up" });

    await expect(signIn).toBeVisible();
    await expect(signUp).toBeVisible();
    await expect(signUp.locator("svg")).toHaveCount(0);

    const [signInBox, signUpBox] = await Promise.all([signIn.boundingBox(), signUp.boundingBox()]);

    expect(signInBox).not.toBeNull();
    expect(signUpBox).not.toBeNull();
    expect(Math.abs(signInBox.y - signUpBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(signInBox.height - signUpBox.height)).toBeLessThanOrEqual(1);
  });
}
