import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("storefront has no critical automated accessibility violations", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Marvel Logo" })).toBeVisible();

  const results = await new AxeBuilder({ page })
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
});
