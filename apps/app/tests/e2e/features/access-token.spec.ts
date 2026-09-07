import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/polychat-test";
import { AppPage } from "../page-objects/AppPage";

const RETIRED_KEYS = ["api_key", "encrypted_api_key"];

function readRetiredKeys(page: Page) {
  return page.evaluate((keys) => keys.map((key) => window.localStorage.getItem(key)), RETIRED_KEYS);
}

test.describe("Access token lifetime", () => {
  test.use({ persona: "pro" });

  test("keeps the token in memory and clears what earlier releases stored", async ({
    appPage,
    homePage,
    page,
  }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    expect(await readRetiredKeys(page)).toEqual([null, null]);

    await page.evaluate((keys) => {
      window.localStorage.setItem(keys[0], "left-behind");
      window.localStorage.setItem(keys[1], '{"iv":[],"encrypted":[]}');
    }, RETIRED_KEYS);

    const tokenRequests: string[] = [];

    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/auth/token")) {
        tokenRequests.push(request.url());
      }
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    await expect(homePage.chatInput).toBeEditable();

    expect(tokenRequests.length).toBeGreaterThan(0);
    expect(await readRetiredKeys(page)).toEqual([null, null]);
  });

  test("signs a second tab in from the session cookie alone", async ({ appPage, page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();

    const second = await page.context().newPage();
    const secondApp = new AppPage(second);

    await second.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(secondApp.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    expect(await readRetiredKeys(second)).toEqual([null, null]);
    await second.close();
  });
});
