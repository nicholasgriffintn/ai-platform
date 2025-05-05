import { expect, test } from "@playwright/test";

// Basic smoke test to ensure the app loads correctly
test("App loads successfully", async ({ page }) => {
  // Navigate to the base URL configured in Playwright
  const response = await page.goto("/");
  // Verify the page responds with a successful status
  if (response) {
    expect(response.status()).toBeLessThan(400);
  }
  // Assert that the body element is visible
  await expect(page.locator("body")).toBeVisible();
});
