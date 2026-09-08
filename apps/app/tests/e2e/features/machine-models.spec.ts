import { OllamaMachine } from "../fixtures/ollama-machine";
import { expect, test } from "../fixtures/polychat-test";

test.describe("Desktop model execution", () => {
  test.setTimeout(120_000);
  test.use({ persona: "pro" });

  test("selects a desktop model, receives a reply and keeps the source after reload", async ({
    page,
    homePage,
  }) => {
    const machine = new OllamaMachine(page.request);

    await machine.start();
    try {
      await homePage.navigate("/chat");
      await homePage.selectMachineModel("Ollama desktop", "gemma3:1b");
      await homePage.reload();
      await homePage.waitForPersonaReady("pro");
      await homePage.verifyMachineSelection("Ollama desktop", "gemma3:1b");
      await homePage.sendMessage("What is 2 + 2? Reply with only the number.");
      await expect(
        page.locator('[data-role="assistant"]').last().getByRole("paragraph"),
      ).toHaveText(/^(?:4|four)[.!]?$/i, {
        timeout: 90_000,
      });
      await expect(homePage.stopResponseButton).toBeHidden();
      await expect(page.locator('[data-role="assistant"]').last()).toHaveAttribute(
        "data-tool-status",
        "completed",
      );
      await homePage.reload();
      await expect(
        page.locator('[data-role="assistant"]').last().getByRole("paragraph"),
      ).toHaveText(/^(?:4|four)[.!]?$/i);
    } finally {
      await machine.stop();
    }
  });
});
