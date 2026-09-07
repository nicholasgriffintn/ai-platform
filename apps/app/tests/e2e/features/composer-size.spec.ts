import { expect, test } from "../fixtures/polychat-test";

const LONG_DRAFT = Array.from(
  { length: 400 },
  (_, line) => `Line ${line} of a very long draft`,
).join("\n");

test.describe("Composer size", () => {
  test.use({ persona: "pro" });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "short", width: 1280, height: 600 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`caps a very long draft and keeps the send control on screen at ${viewport.name}`, async ({
      homePage,
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await homePage.navigate("/chat");
      await expect(homePage.chatInput).toBeEditable();

      const placeholderHeight = await homePage.chatInput.evaluate(
        (element) => element.getBoundingClientRect().height,
      );

      expect(placeholderHeight).toBeLessThan(80);

      await homePage.chatInput.fill(LONG_DRAFT);

      const capped = await homePage.chatInput.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        scrollHeight: element.scrollHeight,
        limit: Math.min(18 * 16, window.innerHeight * 0.4),
      }));

      expect(capped.height).toBeLessThanOrEqual(capped.limit + 1);
      expect(capped.scrollHeight).toBeGreaterThan(capped.height);

      const send = page.getByRole("button", { name: /send message/i });

      await expect(send).toBeInViewport();
      await expect(homePage.chatInput).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test("keeps the caret in view while typing at the cap", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await expect(homePage.chatInput).toBeEditable();
    await homePage.chatInput.fill(LONG_DRAFT);
    await homePage.chatInput.press("End");
    await homePage.chatInput.pressSequentially(" tail");

    const caretInView = await homePage.chatInput.evaluate((element) => {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0).cloneRange();

      if (!range) {
        return false;
      }

      range.collapse(false);
      const caret = range.getBoundingClientRect();
      const input = element.getBoundingClientRect();

      return caret.top >= input.top - 1 && caret.bottom <= input.bottom + 1;
    });

    expect(caretInView).toBe(true);
    await expect(homePage.chatInput).toHaveText(/tail$/);
  });
});
