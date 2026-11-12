import { expect, test } from "@playwright/test";

// Nothing may scroll sideways. A table or a form that runs past the edge of
// the screen makes the page feel broken, and on a phone it hides the
// controls an admin needs.
//
// Covers the admin console shell against the seeded dev database
// (admin@marvel.com / admin123). Read-only: no data is mutated.
test.describe("admin console is responsive", () => {
  const WIDTHS = [360, 390, 768, 1024, 1280];

  /** How far the page scrolls past the right edge, and what causes it. */
  const overflow = (page) =>
    page.evaluate(() => {
      const over = document.documentElement.scrollWidth - window.innerWidth;
      if (over <= 1) return { over, culprits: [] };
      const limit = window.innerWidth;
      const culprits = [...document.querySelectorAll("body *")]
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.right > limit + 1;
        })
        .slice(0, 5)
        .map((node) => {
          const box = node.getBoundingClientRect();
          const cls = typeof node.className === "string" ? node.className : "";
          return `${node.tagName.toLowerCase()}${
            cls ? "." + cls.split(" ").filter(Boolean).join(".") : ""
          } right=${Math.round(box.right)} w=${Math.round(box.width)}`;
        });
      return { over, culprits };
    });

  test.beforeEach(async ({ page }) => {
    await page.goto("/#/login");
    await page.getByPlaceholder("you@example.com").first().fill("admin@marvel.com");
    await page.getByPlaceholder("••••••••").first().fill("admin123");
    await page.getByPlaceholder("••••••••").first().press("Enter");
    await page.locator("#admin-tab-dashboard").waitFor({ state: "attached", timeout: 20000 });
  });

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      const tabs = [
        "#admin-tab-dashboard",
        "#admin-tab-orders",
        "#admin-tab-products",
        "#admin-tab-users",
        "#admin-tab-site-content-menus",
        "#admin-tab-site-content-banners",
        "#admin-tab-settings",
      ];

      for (const tab of tabs) {
        // On a narrow screen the sidebar is a drawer that sits off-canvas,
        // and a collapsed section hides its submenu. Open both, then pick
        // the tab.
        await page.evaluate((sel) => {
          const node = document.querySelector(sel);
          if (!node) return;
          const box = node.getBoundingClientRect();
          if (box.right <= 0 || box.left >= window.innerWidth) {
            const toggle = [...document.querySelectorAll("button")].find(
              (b) => b.getAttribute("aria-label") === "Open navigation menu"
            );
            if (toggle) toggle.click();
          }
        }, tab);
        await page.waitForTimeout(300);

        await page.evaluate(() => {
          const parent = document.querySelector("#admin-tab-site-content");
          if (parent && parent.getAttribute("aria-expanded") !== "true") parent.click();
        });
        await page.waitForTimeout(300);

        await page.evaluate((sel) => document.querySelector(sel)?.click(), tab);
        await page.waitForTimeout(600);

        // The drawer can stay open after a scripted navigation.
        await page.evaluate(() => {
          const backdrop = document.querySelector(".admin-sidebar-backdrop");
          if (backdrop && getComputedStyle(backdrop).display !== "none") backdrop.click();
        });
        await page.waitForTimeout(200);

        const result = await overflow(page);
        expect(
          result.over,
          `${tab} overflows at ${width} by ${result.over}px → ${result.culprits.join(" | ")}`
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});
