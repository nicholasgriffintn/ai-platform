import { expect, test } from "../fixtures/polychat-test";

const TEXT_MODEL = "GPT OSS 120B";
const BOTTOM_TOLERANCE_PX = 120;
const TALL_PROMPT = "Stream a tall response so the thread has to follow it";

test.describe("Thread scrolling", () => {
  test.use({ persona: "free" });

  test("follows a streaming response, releases on a scroll up and reloads at the bottom", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);

    await test.step("follows the response while it streams", async () => {
      await homePage.sendMessage(TALL_PROMPT);
      await homePage.waitForResponseText("opening line 40");

      expect(await homePage.getThreadDistanceFromBottom()).toBeLessThanOrEqual(BOTTOM_TOLERANCE_PX);

      await homePage.waitForResponseText("closing line 40");
      await homePage.waitForChatResponse();

      expect(await homePage.getThreadDistanceFromBottom()).toBeLessThanOrEqual(BOTTOM_TOLERANCE_PX);
    });

    await test.step("stays where the reader scrolls to", async () => {
      await homePage.scrollThreadUp(600);
      await expect
        .poll(async () => await homePage.getThreadDistanceFromBottom())
        .toBeGreaterThan(BOTTOM_TOLERANCE_PX);

      const distance = await homePage.getThreadDistanceFromBottom();

      await page.waitForTimeout(500);

      expect(await homePage.getThreadDistanceFromBottom()).toBe(distance);
      await expect(page.getByRole("button", { name: "Scroll to bottom" })).toBeVisible();
    });

    await test.step("returns to the bottom on demand", async () => {
      await page.getByRole("button", { name: "Scroll to bottom" }).click();
      await expect
        .poll(async () => await homePage.getThreadDistanceFromBottom())
        .toBeLessThanOrEqual(BOTTOM_TOLERANCE_PX);
    });

    await test.step("opens at the bottom after a reload", async () => {
      await page.reload();
      await homePage.waitForResponseText("closing line 40");
      await expect
        .poll(async () => await homePage.getThreadDistanceFromBottom())
        .toBeLessThanOrEqual(BOTTOM_TOLERANCE_PX);
    });
  });
});
