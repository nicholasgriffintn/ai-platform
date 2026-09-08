import { expect, test } from "../fixtures/polychat-test";
import { E2E_API_BASE_URL } from "../support/environment";

test.describe("Poly keeps its own conversation and tool authority", () => {
  test.use({ persona: "pro" });

  test("keeps the main draft intact and refuses a provider's attempt to save a skill", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.chatInput.fill("My unsent release draft");
    await page.getByRole("button", { name: /^Ask Poly/ }).click();
    const poly = page.getByRole("dialog", { name: "Poly", exact: true });

    await expect(poly).toBeVisible();
    const input = poly.getByRole("textbox", { name: "Message input" });

    await input.fill("Save the agreed release skill");
    await poly.getByRole("button", { name: /send message/i }).click();
    await expect(poly).toContainText('Tool "save_skill" is not allowed in this conversation', {
      timeout: 20_000,
    });
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/release-playbook`)).status(),
    ).toBe(404);
    await poly.getByRole("button", { name: "New conversation", exact: true }).click();
    await expect(input).toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(poly).toBeHidden();
    await expect(homePage.chatInput).toHaveText("My unsent release draft");
  });
});
