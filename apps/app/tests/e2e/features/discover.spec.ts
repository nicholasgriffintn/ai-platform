import { expect, test } from "../fixtures/polychat-test";
import { DiscoverPage } from "../page-objects/DiscoverPage";

test("keeps the guest tour below the composer and removes it throughout a conversation", async ({
  homePage,
  page,
}) => {
  const discover = new DiscoverPage(page);

  await homePage.navigate("/");
  await expect(homePage.chatInput).toBeInViewport();
  await expect(discover.homeTour.getByRole("region")).toHaveCount(6);
  await expect(discover.homeTour).not.toBeInViewport();
  await homePage.selectModel("GPT OSS 120B");
  await homePage.sendMessage("Start a conversation from the guest tour");
  await homePage.waitForChatResponse(0);
  await expect(discover.homeTour).toHaveCount(0);
  await homePage.sendMessage("Continue the guest conversation");
  await homePage.waitForChatResponse(1);
  await expect(discover.homeTour).toHaveCount(0);
});

test("opens each public tour section and restores a direct pricing link", async ({ page }) => {
  const discover = new DiscoverPage(page);

  await discover.navigate("/discover");
  await expect(discover.sectionLinks).toHaveCount(6);
  for (const [label, id] of [
    ["Chat and Work", "chat-and-work"],
    ["Models", "models"],
    ["Teammates", "teammates"],
    ["Pets", "pets"],
    ["Pricing", "pricing"],
    ["Your keys", "keys"],
  ]) {
    await discover.openSection(label);
    await expect(discover.section(id).getByRole("heading", { level: 2 })).toBeInViewport();
  }

  await discover.navigate("/discover#pricing");
  await expect(discover.section("pricing").getByRole("heading", { level: 2 })).toBeInViewport();
});

test("keeps the named provider marks in the Discover models band", async ({ page }) => {
  const discover = new DiscoverPage(page);

  await discover.navigate("/discover");
  const models = discover.section("models");

  await models.scrollIntoViewIfNeeded();
  for (const provider of ["standardcompute", "the-grid-ai"]) {
    const mark = models.locator(`li[title^="${provider}:"]`);

    await expect(mark).toHaveCount(1);
    await expect(mark.locator("svg")).toHaveCount(1);
  }
});

test.describe("Signed-in tour placement", () => {
  test.use({ persona: "free" });

  test("keeps the chat home focused and exposes discovery from the standard sidebar", async ({
    appPage,
    homePage,
    page,
  }) => {
    const discover = new DiscoverPage(page);

    await homePage.navigate("/");
    await expect(homePage.chatInput).toBeEditable();
    await expect(discover.homeTour).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tour", exact: true })).toHaveCount(0);
    await discover.navigate("/pricing");
    for (const name of ["Tour", "Pets", "Pricing"]) {
      await expect(page.getByRole("link", { name, exact: true }).first()).toBeVisible();
    }

    await appPage.followLink("Tour");
    await expect(page).toHaveURL(/\/discover$/);
    await expect(discover.sectionLinks).toHaveCount(6);
  });
});
