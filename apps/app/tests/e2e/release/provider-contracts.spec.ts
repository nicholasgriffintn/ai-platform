import { expect, test } from "../fixtures/polychat-test";
import { createSilentWavFixture } from "../fixtures/test-data";
import { E2E_API_BASE_URL } from "../support/environment";

test.describe("Provider release contracts", { tag: "@release" }, () => {
  test.use({ persona: "pro" });

  test("OpenAI-compatible text", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Release provider contract: Groq Chat");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: Groq Chat",
    );
  });

  test("OpenAI Responses text", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-6 Astra");
    await homePage.sendMessageAndRequireCompletion("Release provider contract: OpenAI Responses");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: OpenAI Responses",
    );
  });

  test("Anthropic Messages text", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("Claude Sonnet 4.6");
    await homePage.sendMessageAndRequireCompletion("Release provider contract: Anthropic Messages");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: Anthropic Messages",
    );
  });

  test("Cohere v2 Chat text", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("Command A");
    await homePage.sendMessageAndRequireCompletion("Release provider contract: Cohere Chat");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: Cohere Chat",
    );
  });

  test("Google native image input", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("Gemini Flash-Lite Latest");
    await homePage.uploadFile({
      name: "release-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await homePage.sendMessageAndRequireCompletion("Release provider contract: Google Image");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: Google Image",
    );
  });

  test("OpenAI audio input", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT Audio Mini");
    await homePage.uploadFile({
      name: "release-audio.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavFixture(),
    });
    await homePage.sendMessageAndRequireCompletion("Release provider contract: OpenAI Audio");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Release provider contract: OpenAI Audio",
    );
  });

  test("Replicate image and video predictions", async ({ page }) => {
    for (const [modelId, prompt] of [
      ["replicate-prunaai-p-image-ideogram", "Release provider contract: Replicate Image"],
      ["replicate-prunaai-p-video-2-pro", "Release provider contract: Replicate Video"],
    ]) {
      const response = await page.request.post(`${E2E_API_BASE_URL}/apps/replicate/execute`, {
        data: { modelId, input: { prompt } },
      });

      expect(response.ok(), await response.text()).toBe(true);
      expect(await response.json()).toMatchObject({ response: { data: { status: "ready" } } });
    }
  });
});
