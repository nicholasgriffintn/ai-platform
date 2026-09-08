import { expect, test } from "../fixtures/polychat-test";
import { AppPage } from "../page-objects/AppPage";

test.describe("Access token lifetime", () => {
  test.use({ persona: "pro" });

  test("keeps the token in memory and never writes it to storage", async ({
    appPage,
    homePage,
    page,
  }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    expect(await appPage.readStoredAccessTokenValues()).toEqual([]);

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
    expect(await appPage.readStoredAccessTokenValues()).toEqual([]);
  });

  test("refreshes an idle tab past token expiry and sends without reloading", async ({
    appPage,
    homePage,
    page,
  }) => {
    await page.clock.install();
    await homePage.navigate("/chat");
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    const refreshed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/auth/token") && response.status() === 200,
    );

    await page.clock.fastForward(20 * 60 * 1000);
    await refreshed;
    await page.clock.setSystemTime(new Date());
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Reply after idle token refresh");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Reply after idle token refresh",
    );
    expect(await appPage.readStoredAccessTokenValues()).toEqual([]);
  });

  test("signs a second tab in from the session cookie alone", async ({ appPage, page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(appPage.settingsButton.getByText("Pro", { exact: true })).toBeVisible();

    const second = await page.context().newPage();
    const secondApp = new AppPage(second);

    await second.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(secondApp.settingsButton.getByText("Pro", { exact: true })).toBeVisible();
    expect(await secondApp.readStoredAccessTokenValues()).toEqual([]);
    await second.close();
  });
});
