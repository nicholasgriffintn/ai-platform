import { expect, test } from "../fixtures/polychat-test";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";
import { pauseNextNetworkRequest } from "../support/network-conditions";

test.describe("Persisted model selection", () => {
  test.use({ persona: "pro" });

  test("retains conversation model selection and response controls after reload", async ({
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
    await expect(page.getByLabel("Select a model", { exact: true })).toContainText("GPT-6 Astra");
    const continued = await homePage.sendMessageAndRequireCompletion(
      "Continue with the conversation model selection",
    );

    expect(continued.model).toBe("gpt-6-astra");
    expect(continued.models).toBeUndefined();
    expect(continued.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "Keep my chosen model after refresh" }),
      ]),
    );
    expect(homePage.completionIdFromRequest(continued)).toBe(
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

test.describe("Model picker locations", () => {
  test.use({ persona: "pro" });

  test("searches every location and restores the Cloud list when its tab returns", async ({
    homePage,
    page,
  }) => {
    const machineId = crypto.randomUUID();
    const heartbeat = await page.request.post(`${E2E_API_BASE_URL}/machines/heartbeat`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        machineId,
        label: "Studio desktop",
        platform: "macos",
        appVersion: "0.1.0",
        capabilities: ["model-relay"],
        runtimes: [
          {
            kind: "model",
            vendor: "ollama",
            readiness: { status: "ready", version: "test", checkedAt: new Date().toISOString() },
            models: [
              {
                nativeId: "studio-relay-model",
                displayName: "Studio relay model",
                contextTokens: 8192,
                capabilities: { tools: false, vision: false, thinking: false },
                loaded: false,
              },
            ],
          },
        ],
      },
    });

    expect(heartbeat.ok(), await heartbeat.text()).toBe(true);
    const browserModelRequests: string[] = [];

    page.on("request", (request) => {
      if (/huggingface\.co|mlc-ai/.test(request.url())) {
        browserModelRequests.push(request.url());
      }
    });

    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("pro");
    await page.getByLabel("Select a model", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Model selection dialog" });
    const cloud = dialog.getByRole("radio", { name: "Cloud", exact: true });
    const search = dialog.getByRole("textbox", { name: "Search models" });

    await expect(cloud).toHaveAttribute("aria-checked", "true");
    await search.fill("Studio relay model");
    await expect(dialog.getByRole("status")).toHaveText("All locations");
    await expect(cloud).toHaveAttribute("aria-checked", "false");
    await expect(
      dialog.getByRole("option").filter({ hasText: "Studio desktop" }).first(),
    ).toBeVisible();
    expect(browserModelRequests).toEqual([]);

    await cloud.click();
    await expect(search).toHaveValue("");
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(cloud).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByRole("option").filter({ hasText: "Studio desktop" })).toHaveCount(0);
    expect(browserModelRequests).toEqual([]);
  });
});
