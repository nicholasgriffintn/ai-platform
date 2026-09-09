import type { Browser, BrowserContext, Page } from "@playwright/test";

import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { HomePage } from "../page-objects";

const TEXT_MODEL = "GPT OSS 120B";
const SYNC_TIMEOUT = 30_000;

async function openDevice(context: BrowserContext) {
  const page = await context.newPage();
  const homePage = new HomePage(page);

  await homePage.navigate("/chat");
  await homePage.waitForPersonaReady("pro");

  return { homePage, page };
}

async function openPairedDevices(browser: Browser, seed: string) {
  const leader = await provisionPersonaBrowserContext(browser, "pro", seed);
  const follower = await provisionPersonaBrowserContext(browser, "pro", seed);

  return {
    leader: leader.context,
    follower: follower.context,
    close: async () => {
      await leader.context.close();
      await follower.context.close();
    },
  };
}

function sidebarConversations(page: Page) {
  return page.getByRole("navigation", { name: "Conversations" }).getByRole("listitem");
}

test.describe("Live device sync", () => {
  test.setTimeout(120_000);

  test("mirrors a new conversation and a later reply onto a second signed-in device", async ({
    browser,
  }, testInfo) => {
    const devices = await openPairedDevices(
      browser,
      `${testInfo.testId}:${testInfo.retry}:live-sync-mirror`,
    );

    try {
      const leader = await openDevice(devices.leader);
      const follower = await openDevice(devices.follower);
      const title = /Mirror this onto my other device|Release validation chat/;

      await leader.homePage.selectModel(TEXT_MODEL);
      await leader.homePage.sendMessage("Mirror this onto my other device");
      await leader.homePage.waitForChatResponse(0);

      const mirrored = sidebarConversations(follower.page).filter({ hasText: title });

      await expect(mirrored).toHaveCount(1, { timeout: SYNC_TIMEOUT });
      await expect(sidebarConversations(follower.page).first()).toContainText(title);

      await follower.homePage.navigate(new URL(leader.page.url()).pathname);
      await expect(
        follower.page.getByRole("region", { name: "Conversation messages" }),
      ).toBeVisible();

      await leader.homePage.sendMessage("Send a second turn for the follower to receive");
      await leader.homePage.waitForChatResponse(1);

      await expect(
        follower.page.getByText("Send a second turn for the follower to receive"),
      ).toBeVisible({ timeout: SYNC_TIMEOUT });
      await expect(follower.page.locator('[data-role="assistant"]')).toHaveCount(2, {
        timeout: SYNC_TIMEOUT,
      });
      await expect(follower.page.locator('[data-role="assistant"]').last()).toContainText(
        "E2E response:",
      );
    } finally {
      await devices.close();
    }
  });

  test("mirrors a rename and an archive onto the other device without a reload", async ({
    browser,
  }, testInfo) => {
    const devices = await openPairedDevices(
      browser,
      `${testInfo.testId}:${testInfo.retry}:live-sync-organisation`,
    );

    try {
      const leader = await openDevice(devices.leader);
      const follower = await openDevice(devices.follower);
      const originalTitle = /Organise this across my devices|Release validation chat/;
      const renamed = "Renamed on the leading device";

      await leader.homePage.selectModel(TEXT_MODEL);
      await leader.homePage.sendMessage("Organise this across my devices");
      await leader.homePage.waitForChatResponse(0);
      await leader.homePage.waitForConversationInHistory(originalTitle);
      await expect(
        sidebarConversations(follower.page).filter({ hasText: originalTitle }),
      ).toHaveCount(1, { timeout: SYNC_TIMEOUT });

      await leader.homePage.renameConversation(originalTitle, renamed);
      await expect(sidebarConversations(follower.page).filter({ hasText: renamed })).toHaveCount(
        1,
        { timeout: SYNC_TIMEOUT },
      );

      await leader.homePage.archiveAllConversations();
      await expect(sidebarConversations(follower.page).filter({ hasText: renamed })).toHaveCount(
        0,
        { timeout: SYNC_TIMEOUT },
      );
    } finally {
      await devices.close();
    }
  });
});
