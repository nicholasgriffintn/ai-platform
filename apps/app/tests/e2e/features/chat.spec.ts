import { expect, test } from "../fixtures/polychat-test";
import { createSilentWavFixture, TEXT_MESSAGE_CASES } from "../fixtures/test-data";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

const TEXT_MODEL = "Compound Mini";

for (const persona of ["logged-out", "free", "pro"] as const) {
  test.describe(`Chat as ${persona}`, () => {
    test.use({ persona });

    test("sends representative text messages", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);

      for (const message of TEXT_MESSAGE_CASES) {
        await test.step(message.name, async () => {
          const previousCount = await homePage.getAssistantMessageCount();

          await homePage.sendMessage(message.value);
          await homePage.waitForChatResponse(previousCount);
          await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
        });
      }

      await captureVisualSnapshots(
        page,
        `release-chat-text-${persona}`,
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });

    test("starts a new conversation without submitting empty content", async ({
      homePage,
      page,
    }) => {
      await homePage.navigate("/chat");
      await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessage(`Start a clean ${persona} conversation`);
      await homePage.waitForChatResponse(0);
      await homePage.startNewChat();
      await expect(homePage.getLatestAssistantMessage()).toHaveCount(0);
      await expect(homePage.chatInput).toBeEditable();
      await captureVisualSnapshots(page, `release-chat-new-${persona}`, {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("suggests prompts, shuffles them, and loads one into the composer", async ({
      homePage,
      page,
    }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);

      const initialIds = await homePage.getSuggestionIds();

      expect(initialIds).toHaveLength(4);
      expect(new Set(initialIds).size).toBe(4);

      await homePage.shuffleSuggestions();
      await expect.poll(() => homePage.getSuggestionIds()).not.toEqual(initialIds);

      await homePage.selectEverydaySuggestion();
      await expect(homePage.chatInput).not.toBeEmpty();
      await captureVisualSnapshots(page, `release-chat-suggestions-${persona}`, {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });

      await homePage.sendMessageAndRequireCompletion(`Follow up as ${persona}`);
      await homePage.waitForChatResponse(0);
      await expect(homePage.suggestions).toHaveCount(0);
    });

    test("edits, retries, copies and rates message content", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessage(`Original ${persona} message action content`);
      await homePage.waitForChatResponse(0);

      const editedContent = `Edited ${persona} message action content`;

      await homePage.editLatestUserMessage(editedContent);
      await expect(homePage.getLatestUserMessage()).toContainText(editedContent);
      await expect(homePage.getLatestAssistantMessage()).toContainText(editedContent);
      expect(await homePage.copyLatestAssistantMessage()).toContain(editedContent);
      await homePage.retryLatestAssistantMessage();
      await expect(homePage.getLatestAssistantMessage()).toContainText(editedContent);
      if (persona !== "pro") {
        await expect(homePage.getLatestAssistantFeedbackButton("positive")).toHaveCount(0);
      } else {
        const feedbackResponse = await homePage.submitLatestAssistantFeedback("positive");

        expect(feedbackResponse.status()).toBe(200);
        await expect(
          homePage.getLatestAssistantMessage().getByRole("button", { name: "Feedback submitted" }),
        ).toBeDisabled();
      }

      await captureVisualSnapshots(page, `release-chat-edits-${persona}`, {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("renames, finds and removes a conversation", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessage(`Manage this ${persona} release conversation`);
      await homePage.waitForChatResponse(0);
      const generatedTitle = /Manage this|Release validation chat/;

      await homePage.waitForConversationInHistory(generatedTitle);

      await homePage.hoverConversation(generatedTitle);
      await captureVisualSnapshots(page, `release-chat-conversation-hover-${persona}`, {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });

      const renamedTitle = `${persona} managed release conversation`;

      await homePage.renameConversation(generatedTitle, renamedTitle);
      await homePage.searchPolychat(renamedTitle);
      await expect(page.getByRole("option").filter({ hasText: renamedTitle })).toBeVisible();
      await homePage.searchPolychat("missing release conversation");
      await expect(page.getByText("No matches found")).toBeVisible();
      await homePage.closeGlobalSearch();
      await homePage.deleteConversation(renamedTitle);

      if (persona === "pro") {
        await homePage.setConversationArchiveFilter("Archived");
        await expect(page.getByRole("button").filter({ hasText: renamedTitle })).toBeVisible();
      }

      await captureVisualSnapshots(page, `release-chat-conversation-history-${persona}`, {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });

    test("moves between Live and Canvas surfaces", async ({ externalServices, homePage, page }) => {
      await externalServices.mockGeminiLiveWebSocket();
      await homePage.navigate("/chat");
      await homePage.waitForPersonaReady(persona);

      await homePage.selectChatMode("Live");
      await expect(page).toHaveURL(/\/chat\?mode=live$/);
      await expect(page.getByRole("heading", { name: "Start a live session" })).toBeVisible();
      expect(await homePage.startAndStopMutedLiveSession()).toBe(
        persona === "logged-out" ? 401 : 200,
      );
      await captureVisualSnapshots(page, "release-chat-mode-live", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
      await homePage.clearChatMode("Live");

      await homePage.openCanvas();
      await captureVisualSnapshots(page, "release-chat-canvas-open", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
      await homePage.selectCanvasSurface("Video generation");
      await homePage.selectCanvasSurface("Drawing");
      await homePage.selectCanvasSurface("Image generation");
      await homePage.closeCanvas();
    });
  });
}

for (const persona of ["logged-out", "free"] as const) {
  test.describe(`Local history as ${persona}`, () => {
    test.use({ persona });

    test("persists and reopens a conversation after reload", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessage(`Persist this ${persona} release conversation`);
      await homePage.waitForChatResponse(0);
      const conversationTitle = new RegExp(`Persist this ${persona}|Release validation chat`);

      await homePage.waitForConversationInHistory(conversationTitle);

      await homePage.reload();
      await homePage.openConversation(conversationTitle);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await captureVisualSnapshots(page, "release-chat-local-history", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });
}

test.describe("Canvas creation as pro", () => {
  test.use({ persona: "pro" });

  test("draws, identifies and transforms a sketch", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.createDrawing();
    await expect(page.getByText("E2E release validation sketch", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  });
});

test.describe("Canvas generation", () => {
  test.describe("logged out", () => {
    test.use({ persona: "logged-out" });

    test("requires an account before generating media", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      expect(
        await homePage.attemptCanvasGeneration(
          "Image generation",
          "FLUX 2 Pro",
          "A deterministic release validation image",
        ),
      ).toBe(401);
      await captureVisualSnapshots(page, "release-chat-canvas-auth-block", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });

  test.describe("free", () => {
    test.use({ persona: "free" });

    test("generates and displays an image", async ({ homePage, profilePage, page }) => {
      await profilePage.openProviders();
      await profilePage.syncProviders();
      await profilePage.configureProvider("Replicate", "e2e-replicate-provider-key");
      await homePage.navigate("/chat");
      const modelName = "FLUX 2 Pro";

      await homePage.generateCanvasOutput(
        "Image generation",
        modelName,
        "A deterministic release validation image",
      );
      await expect(homePage.getCanvasGeneration(modelName).getByRole("img")).toBeVisible();
      await captureVisualSnapshots(page, "release-chat-canvas-image", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });

  test.describe("pro", () => {
    test.use({ persona: "pro" });

    test("generates and displays a video", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      const modelName = "Seedance 2.0";

      await homePage.generateCanvasOutput(
        "Video generation",
        modelName,
        "A deterministic release validation video",
      );
      await expect(homePage.getCanvasGeneration(modelName).locator("video")).toBeVisible();
      await captureVisualSnapshots(page, "release-chat-canvas-video", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        viewports: [{ name: "desktop", width: 1280, height: 720 }],
      });
    });
  });
});

test.describe("Response controls as pro", () => {
  test.use({ persona: "pro" });

  test("applies reasoning and verbosity settings to a message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-5.2");
    await homePage.configureResponseControls("High", "Caveman");
    const request = await homePage.sendMessageAndReadCompletionRequest(
      "Use the selected response controls for this release check",
    );

    expect(request.reasoning).toEqual({ effort: "high" });
    expect(request.verbosity).toBe("caveman");
    await homePage.waitForChatResponse(0);
    await homePage.waitForResponseText(/E2E response:/);
    await captureVisualSnapshots(page, "release-chat-response-controls", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("enables a hosted tool for a message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT-5.2 Pro");
    const request = await homePage.sendMessageWithComposerActionAndReadCompletionRequest(
      "Use code execution for this release check",
      "Code execution",
    );

    expect(request.enabled_tools).toContain("code_execution");
    await homePage.waitForChatResponse(0);
    await homePage.waitForResponseText(/E2E response:/);
    await captureVisualSnapshots(page, "release-chat-hosted-tool", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("invokes a skill with its slash command", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageWithSkillCommand(
      "artifacts",
      "Create a release validation document",
    );

    expect(JSON.stringify(request.messages)).toContain(
      "/artifacts Create a release validation document",
    );
    await homePage.waitForChatResponse(0);
    await homePage.waitForResponseText(/E2E response:/);
    await captureVisualSnapshots(page, "release-chat-skills", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("applies detailed generation and retrieval settings", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.configureDetailedChatSettings();
    const request = await homePage.sendMessageAndReadCompletionRequest(
      "Use the detailed settings for this release check",
    );

    expect(request).toMatchObject({
      compaction: "off",
      frequency_penalty: -0.3,
      max_tokens: 1024,
      presence_penalty: 0.4,
      rag_options: {
        include_metadata: true,
        namespace: "release-docs",
        score_threshold: 0.65,
        top_k: 6,
      },
      temperature: 0.4,
      top_p: 0.75,
      use_rag: true,
    });
    await homePage.waitForChatResponse(0);
    await homePage.waitForResponseText(/E2E response:/);
    await captureVisualSnapshots(page, "release-chat-detailed-settings", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("requests a second opinion on the latest answer", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessage("Give the primary release recommendation");
    await homePage.waitForChatResponse(0);

    const request = await homePage.requestSecondOpinion("Llama 4 Scout 17B", "Groq");

    expect(request.model).toBe("groq-llama-4-scout-17b");
    expect(request.models).toBeUndefined();
    expect(request.use_multi_model).toBe(false);
    await homePage.waitForChatResponse(1);
    await homePage.waitForResponseText(/E2E response:/);
  });
});

test.describe("Pro message attachments", () => {
  test.use({ persona: "pro" });

  test("sends an image message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("Llama 4 Scout 17B");
    await homePage.uploadFile({
      name: "release-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await homePage.sendMessage("Describe the attached release image");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-attachment-image", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("sends a code document message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.uploadFile({
      name: "release-check.ts",
      mimeType: "text/typescript",
      buffer: Buffer.from("export const releaseReady = true;"),
    });
    await homePage.sendMessage("Review the attached code document");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-attachment-code", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("sends a PDF document message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("Gemini Flash-Lite Latest");
    await homePage.uploadFile({
      name: "release-validation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\n%%EOF",
      ),
    });
    await homePage.sendMessage("Review the attached release document");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-attachment-pdf", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("sends an audio message", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT Audio Mini");
    await homePage.uploadFile({
      name: "release-audio.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavFixture(),
    });
    await homePage.sendMessage("Summarise the attached audio");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-attachment-audio", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("persists a server-backed conversation across reload", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessage("Persist this Pro release conversation");
    await homePage.waitForChatResponse(0);

    await homePage.reload();
    await homePage.openConversation(/Persist this Pro release conve|Release validation chat/);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-server-history", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("shares, unshares and branches a conversation", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessage("Create a conversation for lifecycle actions");
    await homePage.waitForChatResponse(0);

    await homePage.shareConversation();
    await expect(page.getByLabel("Share link")).toHaveValue(/\/s\//);
    await homePage.stopSharingConversation();
    await homePage.branchFromLatestAssistantMessage();
    await expect(
      page.getByRole("button", { name: "Go to original conversation", exact: true }),
    ).toBeVisible();

    await homePage.returnToOriginalConversation();
    await homePage.branchFromLatestUserMessageWithModel("Llama 4 Scout 17B", "Groq");
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "release-chat-branching", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });

  test("chooses council members from the picker and convenes them", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessageAndRequireCompletion(
      "Convene a council on the safest release validation approach",
    );

    await homePage.waitForCouncilMemberPicker();
    await expect(
      page.getByText("These two disagree most about release risk.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Sceptic" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Operator" })).not.toBeChecked();

    await homePage.toggleCouncilMember("Operator");
    await homePage.conveneCouncil();

    await homePage.waitForResponseText(/E2E response:/);
    await expect(page.getByText("Council convened.")).toBeVisible();
    await captureVisualSnapshots(page, "release-chat-council-picker", {
      ...DEFAULT_VISUAL_CHECKPOINTS,
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    });
  });
});

test.describe("Goals as pro", () => {
  test.use({ persona: "pro" });

  test("sets, pauses, and clears a conversation goal", async ({ homePage }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessage("Start a conversation to hold a goal");
    await homePage.waitForChatResponse(0);

    const objective = "Make the release checks pass without changing public API behaviour";
    const setResponse = await homePage.setGoal(objective);

    expect(setResponse.status()).toBe(200);
    await expect(homePage.goalCard()).toContainText(objective);
    await expect(homePage.goalCard()).toContainText("Goal active");

    const pauseResponse = await homePage.updateGoal("Pause");

    expect(pauseResponse.status()).toBe(200);
    await expect(homePage.goalCard()).toContainText("Goal paused");

    const resumeResponse = await homePage.updateGoal("Resume");

    expect(resumeResponse.status()).toBe(200);
    await expect(homePage.goalCard()).toContainText("Goal active");

    const clearResponse = await homePage.updateGoal("Clear goal");

    expect(clearResponse.status()).toBe(200);
    await expect(homePage.goalCard()).toHaveCount(0);
  });
});

test.describe("Goals as free", () => {
  test.use({ persona: "free" });

  test("does not offer goals without a pro plan", async ({ homePage, page }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessage("Start a free conversation");
    await homePage.waitForChatResponse(0);

    await page.getByRole("textbox", { name: "Message input" }).fill("/goal");

    await expect(page.getByRole("button", { name: /^\/goal/ })).toHaveCount(0);
  });
});
