import { expect, test } from "../fixtures/polychat-test";

const SECTIONS = [
  "Tiers",
  "On your own hardware",
  "System models",
  "Behind the scenes",
  "By provider",
];

test("reads as one page and scrolls each section clear of the header", async ({ page }) => {
  await page.goto("/models", { waitUntil: "domcontentloaded" });

  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toHaveText([
    "Models",
    "Every model, one perch",
  ]);

  const sectionNav = page.getByRole("navigation", { name: "Models sections" });

  await expect(sectionNav.getByRole("link")).toHaveCount(SECTIONS.length);

  for (const section of SECTIONS) {
    await sectionNav.getByRole("link", { name: section, exact: true }).click();
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeInViewport();
  }
});

test("marks every provider with artwork in the filter and in its section", async ({ page }) => {
  await page.goto("/models", { waitUntil: "domcontentloaded" });

  const filter = page.getByRole("group", { name: "Filter by provider" });

  await expect(filter).toBeVisible();
  const chips = filter.getByRole("button").filter({ hasNotText: "All providers" });
  const sections = page.locator("section[id^='provider-']");
  const providerCount = await chips.count();

  expect(providerCount).toBeGreaterThan(0);
  await expect(sections).toHaveCount(providerCount);
  await expect(chips.locator("svg")).toHaveCount(providerCount);
  await expect(sections.locator("> div svg")).toHaveCount(providerCount);
});
