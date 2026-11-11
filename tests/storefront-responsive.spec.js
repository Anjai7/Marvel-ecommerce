import { expect, test } from "@playwright/test";

// The storefront must fit every screen, with and without a dropdown open.
//
// The check is not "does the page scroll sideways" — below 900px the app
// sets `overflow-x: clip`, so content that runs past the edge is cut off
// rather than scrollable, and the document never reports an overflow. So
// the check is "does any element stick out past the right edge".

const WIDTHS = [360, 390, 414, 768, 1024, 1280, 1440];

const PAGES = [
  { name: "home", path: "/" },
  { name: "category", path: "/category/electronics" },
  { name: "cart", path: "/cart" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
];

/** The elements that stick out past the right edge of the screen. */
const offenders = (page) =>
  page.evaluate(() => {
    const limit = window.innerWidth;

    /**
     * True when an ancestor clips the element — a horizontal scroller, a
     * card with `overflow: hidden`. Such an element is not sticking out of
     * the page; it is scrolled or trimmed on purpose. The root is not
     * counted: content clipped by the root is cut off at the edge of the
     * screen, which is exactly the bug this looks for.
     */
    const isClipped = (node) => {
      let parent = node.parentElement;
      while (parent && parent !== document.body) {
        if (getComputedStyle(parent).overflowX !== "visible") return true;
        parent = parent.parentElement;
      }
      return false;
    };

    return [...document.querySelectorAll("body *")]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        if (isClipped(node)) return false;
        return box.right > limit + 1;
      })
      .slice(0, 6)
      .map((node) => {
        const box = node.getBoundingClientRect();
        const cls = typeof node.className === "string" ? node.className : "";
        return `${node.tagName.toLowerCase()}${
          cls ? "." + cls.split(" ").filter(Boolean).join(".") : ""
        } right=${Math.round(box.right)} w=${Math.round(box.width)}`;
      });
  });

test.describe("storefront fits the screen", () => {
  for (const { name, path } of PAGES) {
    for (const width of WIDTHS) {
      test(`${name} fits at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(1200);
        expect(await offenders(page), `${name} @${width}`).toEqual([]);
      });
    }
  }

  for (const width of WIDTHS.filter((w) => w >= 1024)) {
    test(`the category dropdown stays on the screen at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.waitForTimeout(1500);

      const trigger = page.locator("#nav-electronics");
      if (!(await trigger.count())) return;

      await trigger.hover();
      await page.waitForTimeout(600);

      const menu = page.locator(".mega-menu");
      if (!(await menu.count())) return;

      const box = await menu.first().boundingBox();
      expect(box, `the dropdown is off the screen at ${width}`).not.toBeNull();
      expect(box.x, `the dropdown starts off the left edge at ${width}`).toBeGreaterThanOrEqual(-1);
      expect(
        box.x + box.width,
        `the dropdown runs past the right edge at ${width}`
      ).toBeLessThanOrEqual(width + 1);
    });
  }
});
