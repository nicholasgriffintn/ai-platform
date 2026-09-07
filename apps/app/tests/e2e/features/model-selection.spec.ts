import { expect, test } from "../fixtures/polychat-test";
import { pauseNextNetworkRequest } from "../support/network-conditions";

test.describe("Persisted model selection", () => {
  test.use({ persona: "pro" });

  test("retains a Pro model and response controls after reload, then preserves the Default tier", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-6 Astra");
    await homePage.configureResponseControls("High", "Caveman");
    await homePage.configureProcessingTier("fast");
    await homePage.reload();
    await homePage.waitForPersonaReady("pro");
    await expect(page.getByLabel("Select a model", { exact: true })).toContainText("GPT-6 Astra");
    await expect(page.getByRole("button", { name: "Reasoning depth: High" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verbosity: Caveman" })).toBeVisible();
    const request = await homePage.sendMessageAndRequireCompletion(
      "Keep my chosen model after refresh",
    );

    expect(request.model).toBe("gpt-6-astra");
    expect(request.reasoning).toEqual({ effort: "high" });
    expect(request.verbosity).toBe("caveman");
    expect(request.service_tier).toBe("fast");
    await homePage.waitForChatResponse(0);
    await homePage.selectModelTier("Default");
    await homePage.reload();
    await homePage.waitForPersonaReady("pro");
    await expect(page.getByLabel("Select a model", { exact: true })).toContainText("Default");
    const automatic = await homePage.sendMessageAndRequireCompletion(
      "Use my deliberate Default tier selection",
    );

    expect(automatic.model).toBeUndefined();
    expect(automatic.models).toBeUndefined();
    expect(automatic.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "Keep my chosen model after refresh" }),
      ]),
    );
    expect(homePage.completionIdFromRequest(automatic)).toBe(
      homePage.completionIdFromRequest(request),
    );
    await homePage.waitForChatResponse(1);
  });

  test("keeps the chosen model while the catalogue is delayed during reload", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-6 Astra");
    await homePage.recordModelSelectorStatesAcrossNextNavigation();
    const pausedModels = await pauseNextNetworkRequest(page, "*/models");
    const reload = page.reload({ waitUntil: "domcontentloaded" });

    await pausedModels.wait();
    await reload;
    try {
      await homePage.waitForModelLoadingState();
      expect(await homePage.modelSelectorCount()).toBe(0);
    } finally {
      await pausedModels.release();
    }

    await homePage.waitForPersonaReady("pro");
    await homePage.waitForSelectedModel("GPT-6 Astra");
    const states = await homePage.recordedModelSelectorStates();

    expect(states).toContain("Loading models...");
    expect(states.some((state) => /^(?:Auto|Default)$/.test(state))).toBe(false);
    expect(states.at(-1)).toContain("GPT-6 Astra");
  });

  test("retains an unavailable model after sign-out until an eligible replacement is chosen", async ({
    homePage,
    page,
    profilePage,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-6 Astra");
    await profilePage.openAccount();
    await profilePage.logout();
    await expect(page.getByText("Sign in to view your profile", { exact: true })).toBeVisible();
    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("logged-out");
    await expect(page.getByLabel("Select a model", { exact: true })).toContainText("GPT-6 Astra");
    await homePage.chatInput.fill("Continue after signing out");
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
    await expect(page.getByText("This model cannot run", { exact: true })).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    const request = await homePage.sendMessageAndRequireCompletion("Continue after signing out");

    expect(request.model).not.toBe("gpt-6-astra");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
  });
});
