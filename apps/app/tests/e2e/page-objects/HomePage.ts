import type { Dialog, Locator, Page, Response } from "@playwright/test";

import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  readonly chatInput: Locator;
  readonly suggestions: Locator;
  private readonly sendButton: Locator;
  private readonly modelSelector: Locator;
  private readonly newChatButton: Locator;
  private readonly assistantMessages: Locator;

  constructor(page: Page) {
    super(page);
    this.chatInput = page.getByRole("textbox", { name: "Message input" });
    this.suggestions = page.locator("[data-suggestion-id]");
    this.sendButton = page.getByRole("button", { name: /send message/i });
    this.modelSelector = page.getByLabel("Select a model", { exact: true });
    this.newChatButton = page.getByRole("button", { name: /New Chat/i });
    this.assistantMessages = page.locator('[data-role="assistant"]');
  }

  async sendMessage(message: string) {
    await this.fillInput(this.chatInput, message);
    await this.clickElement(this.sendButton);
  }

  async sendMessageAndReadCompletionRequest(message: string) {
    const requestPromise = this.page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/chat/completions"),
    );

    await this.sendMessage(message);

    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  async sendMessageAndRequireCompletion(message: string) {
    const completionResponse = this.waitForCompletionRequest();

    await this.sendMessage(message);
    const response = await completionResponse;

    if (!response.ok()) {
      throw new Error(`Completion failed with ${response.status()}: ${await response.text()}`);
    }

    return response.request().postDataJSON() as Record<string, unknown>;
  }

  async selectModel(modelName: string) {
    await this.clickElement(this.modelSelector);
    const modelsTab = this.page.getByRole("tab", { name: "Models", exact: true });

    if (await modelsTab.isVisible()) {
      await modelsTab.click();
    }

    await this.fillInput(this.page.getByRole("textbox", { name: "Search models" }), modelName);
    const option = this.page.getByRole("option").filter({ hasText: modelName }).first();

    if (!(await option.isVisible())) {
      const showDeprecated = this.page.getByRole("button", { name: /Show deprecated models/ });

      if (await showDeprecated.isVisible()) {
        await showDeprecated.click();
      }
    }

    await this.clickElement(option);
  }

  async selectChatMode(mode: "Chat" | "Live") {
    const command = `/${mode.toLowerCase()}`;

    await this.chatInput.fill(command);
    await this.page.getByRole("button", { name: new RegExp(`^${command}`) }).click();
    if (mode === "Live") {
      await this.page.keyboard.press("Escape");
    }
  }

  async setGoal(objective: string) {
    const goalResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/goal"),
    );

    await this.sendMessage(`/goal ${objective}`);

    return goalResponse;
  }

  async updateGoal(action: "Pause" | "Resume" | "Clear goal") {
    const goalResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname.endsWith("/goal"),
    );

    await this.page.getByRole("button", { name: action }).click();

    return goalResponse;
  }

  goalCard() {
    return this.page.getByRole("status").filter({ hasText: "Goal" });
  }

  get councilMemberPicker() {
    return this.page.getByText("Choose the council", { exact: true });
  }

  async waitForCouncilMemberPicker() {
    await this.waitForElement(this.councilMemberPicker);
  }

  async toggleCouncilMember(memberName: string) {
    await this.clickElement(this.page.getByRole("checkbox", { name: memberName }));
  }

  async conveneCouncil() {
    await this.clickElement(this.page.getByRole("button", { name: "Convene", exact: true }));
  }

  async sendMessageWithSkillCommand(skillName: string, message: string) {
    const command = `/${skillName}`;

    await this.chatInput.fill(command.slice(0, -1));
    await this.page.getByRole("button", { name: new RegExp(`^${command}`) }).click();
    await this.chatInput.press("End");
    await this.chatInput.pressSequentially(` ${message}`);
    const requestPromise = this.page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/chat/completions"),
    );

    await this.clickElement(this.sendButton);

    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  async waitForPersonaReady(persona: "logged-out" | "free" | "pro") {
    if (persona === "logged-out") {
      await this.page
        .getByText("Chats are only stored on this device while you are not signed in", {
          exact: true,
        })
        .waitFor();

      return;
    }

    await this.page.getByRole("button", { name: "Switch to local-only mode" }).waitFor();
  }

  async clearChatMode(mode: "Live") {
    await this.page.getByRole("button", { name: `Clear ${mode} mode` }).click();
  }

  async startAndStopMutedLiveSession() {
    await this.selectModel("Gemini 3.1 Flash Live Preview");
    await this.page.getByRole("button", { name: "Turn microphone off" }).click();
    const sessionResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/realtime/session/realtime"),
    );

    await this.page.getByRole("button", { name: "Start live session" }).click();
    const response = await sessionResponse;

    if (!response.ok()) {
      return response.status();
    }

    const stopButton = this.page.getByRole("button", { name: "Pause live session" });

    await stopButton.waitFor();
    await stopButton.click();
    await this.page.getByRole("button", { name: "Start live session" }).waitFor();

    return response.status();
  }

  async openCanvas() {
    await this.page
      .getByRole("button", { name: "Switch to local-only mode" })
      .or(
        this.page.getByText("Chats are only stored on this device while you are not signed in", {
          exact: true,
        }),
      )
      .waitFor();
    await this.page.getByRole("button", { name: "Switch to image generation" }).click();
    await this.page.getByRole("heading", { name: "Generations", exact: true }).waitFor();
  }

  async selectCanvasSurface(surface: "Image generation" | "Video generation" | "Drawing") {
    await this.page.getByRole("button", { name: surface, exact: true }).click();
    await this.page
      .getByRole("heading", {
        name: surface === "Drawing" ? "Drawings" : "Generations",
        exact: true,
      })
      .waitFor();
  }

  async closeCanvas() {
    await this.page.getByRole("button", { name: "Switch to chat" }).click();
    await this.chatInput.waitFor();
  }

  private async configureCanvasGeneration(
    mode: "Image generation" | "Video generation",
    modelName: string,
    prompt: string,
  ) {
    await this.openCanvas();
    await this.selectCanvasSurface(mode);
    await this.page.getByPlaceholder("Describe what to generate...").fill(prompt);
    await this.page.getByPlaceholder("Search models").fill(modelName);
    const model = this.page.getByRole("button").filter({ hasText: modelName }).first();

    try {
      await model.click();
    } catch (error) {
      await this.page.getByPlaceholder("Search models").fill("");
      const availableModels = await this.page
        .getByRole("button")
        .filter({ has: this.page.locator("span.text-sm") })
        .allTextContents();

      throw new Error(
        `Canvas model ${modelName} is unavailable. Available models: ${availableModels.join(", ")}`,
        { cause: error },
      );
    }
  }

  async attemptCanvasGeneration(
    mode: "Image generation" | "Video generation",
    modelName: string,
    prompt: string,
  ) {
    await this.configureCanvasGeneration(mode, modelName, prompt);
    const generationResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/apps/canvas/generate"),
    );

    await this.page.getByRole("button", { name: "Generate", exact: true }).click();
    const response = await generationResponse;

    if (!response.ok()) {
      await this.page
        .getByText(/auth|sign in/i)
        .first()
        .waitFor();
    }

    return response.status();
  }

  async generateCanvasOutput(
    mode: "Image generation" | "Video generation",
    modelName: string,
    prompt: string,
  ) {
    const status = await this.attemptCanvasGeneration(mode, modelName, prompt);

    if (status < 200 || status >= 300) {
      throw new Error(`Canvas generation failed with ${status}`);
    }

    const card = this.getCanvasGeneration(modelName);
    const completed = card.getByText("completed", { exact: true });
    const failed = card.getByText("failed", { exact: true });

    await completed.or(failed).waitFor();
    if (await failed.isVisible()) {
      throw new Error(
        `Canvas output failed: ${(await card.locator("p").last().textContent()) ?? ""}`,
      );
    }
  }

  getCanvasGeneration(modelName: string) {
    return this.page
      .getByRole("article")
      .filter({ has: this.page.getByRole("heading", { name: modelName, exact: true }) })
      .first();
  }

  async createDrawing() {
    await this.page.getByRole("button", { name: "Switch to local-only mode" }).waitFor();
    await this.openCanvas();
    await this.selectCanvasSurface("Drawing");
    await this.page.getByRole("button", { name: "New Drawing" }).click();
    const canvas = this.page.locator("canvas");

    await canvas.waitFor();
    const bounds = await canvas.boundingBox();

    if (!bounds) {
      throw new Error("Drawing canvas has no visible bounds");
    }

    await this.page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.4);
    await this.page.mouse.down();
    await this.page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
      steps: 8,
    });
    await this.page.mouse.up();

    const guessResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/apps/drawing/guess"),
    );

    await this.page.getByRole("button", { name: "Guess What I Drew" }).click();
    const guessed = await guessResponse;

    if (!guessed.ok()) {
      throw new Error(`Drawing guess failed with ${guessed.status()}: ${await guessed.text()}`);
    }

    await this.page.getByText("E2E release validation sketch", { exact: true }).waitFor();

    const transformResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/apps/drawing"),
    );

    await this.page.getByRole("button", { name: "Transform Drawing" }).click();
    const transformed = await transformResponse;

    if (!transformed.ok()) {
      throw new Error(
        `Drawing transformation failed with ${transformed.status()}: ${await transformed.text()}`,
      );
    }

    const responseBody = await transformed.json();
    const description = this.page.getByRole("heading", { name: "Description", exact: true });
    const displayError = this.page.getByText("Error: Could not show your drawing", {
      exact: true,
    });

    await description.or(displayError).waitFor();
    if (await displayError.isVisible()) {
      throw new Error(
        `Drawing transformation returned successfully but did not open its output: ${JSON.stringify(responseBody)}`,
      );
    }
  }

  async uploadFile(file: { name: string; mimeType: string; buffer: Buffer }) {
    const uploadResponse = this.page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/uploads"),
    );
    let resolveUploadError: (outcome: { error: string }) => void = () => undefined;
    const uploadError = new Promise<{ error: string }>((resolve) => {
      resolveUploadError = resolve;
    });
    const handleDialog = async (dialog: Dialog) => {
      const message = dialog.message();

      await dialog.dismiss();
      resolveUploadError({ error: message });
    };

    this.page.on("dialog", handleDialog);
    const networkOutcome = uploadResponse.then((response) => ({ response }));

    void networkOutcome.catch(() => undefined);
    const uploadOutcome = Promise.race([networkOutcome, uploadError]);
    let response: Response;

    try {
      await this.page
        .getByLabel("Upload a file (images, documents, audio, and code)")
        .setInputFiles(file);
      const outcome = await uploadOutcome;

      if ("error" in outcome) {
        throw new Error(`Attachment was rejected before upload: ${outcome.error}`);
      }

      response = outcome.response;
    } finally {
      this.page.off("dialog", handleDialog);
    }

    if (!response.ok()) {
      throw new Error(
        `Attachment upload failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await this.page.getByRole("button", { name: "Remove attachment" }).waitFor();
  }

  async openConversation(title: string | RegExp) {
    await this.clickElement(this.page.getByRole("button").filter({ hasText: title }).first());
    await this.page.getByRole("region", { name: "Conversation messages" }).waitFor();
  }

  async waitForConversationInHistory(title: string | RegExp) {
    await this.waitForElement(this.page.getByRole("button").filter({ hasText: title }).first());
  }

  private conversationItem(title: string | RegExp) {
    return this.page.getByRole("button").filter({ hasText: title }).first();
  }

  async hoverConversation(title: string | RegExp) {
    const item = this.conversationItem(title);

    await item.hover();
    await item.getByRole("button", { name: "Edit conversation title" }).waitFor();
    await item.getByRole("button", { name: "Delete", exact: true }).waitFor();

    return item;
  }

  async renameConversation(title: string | RegExp, replacement: string) {
    const item = await this.hoverConversation(title);

    this.page.once("dialog", async (dialog) => {
      if (dialog.type() !== "prompt") {
        await dialog.dismiss();
        throw new Error(`Expected a rename prompt, received ${dialog.type()}`);
      }

      await dialog.accept(replacement);
    });
    await item.getByRole("button", { name: "Edit conversation title" }).click();
    await this.conversationItem(replacement).waitFor();
  }

  async searchPolychat(query: string) {
    const searchInput = this.page.getByRole("textbox", { name: "Search Polychat" });

    if (!(await searchInput.isVisible())) {
      await this.page.getByRole("button", { name: /^Search(?:\s|$)/ }).click();
    }

    await searchInput.fill(query);
  }

  async closeGlobalSearch() {
    await this.page.keyboard.press("Escape");
    await this.page.getByRole("textbox", { name: "Search Polychat" }).waitFor({ state: "hidden" });
  }

  async setConversationListOption(section: string, option: string) {
    const trigger = this.page.getByRole("button", { name: "Conversation list options" });

    await trigger.click();
    await this.page.getByRole("menuitem", { name: new RegExp(`^${section}`) }).click();

    const choice = this.page.getByRole("menuitemradio", { name: option, exact: true });

    await choice.click();
    await choice.waitFor({ state: "hidden" });
  }

  async setConversationArchiveFilter(state: "Active" | "Archived" | "All") {
    await this.setConversationListOption("Status", state);
  }

  async archiveAllConversations() {
    await this.page.getByRole("button", { name: "Conversation list actions" }).click();
    await this.page.getByRole("menuitem", { name: /^Archive all/ }).click();

    const confirmation = this.page.getByRole("dialog", { name: "Archive all conversations" });

    await confirmation.getByRole("button", { name: "Archive all", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
  }

  async deleteConversation(title: string | RegExp) {
    const item = await this.hoverConversation(title);

    await item.getByRole("button", { name: "Delete", exact: true }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Delete Conversation" });

    await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    await item.waitFor({ state: "detached" });
  }

  async startNewChat() {
    await this.clickElement(this.newChatButton);
  }

  async waitForSuggestions() {
    await this.waitForElement(this.suggestions.first());
  }

  async getSuggestionIds(): Promise<string[]> {
    await this.waitForSuggestions();
    const ids = await this.suggestions.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-suggestion-id") ?? ""),
    );

    return ids;
  }

  async selectEverydaySuggestion() {
    await this.waitForSuggestions();
    await this.clickElement(this.page.locator('[data-suggestion-id^="everyday-"]').first());
  }

  async shuffleSuggestions() {
    await this.waitForSuggestions();
    await this.clickElement(this.page.getByRole("button", { name: "Shuffle" }));
  }

  async waitForChatResponse(previousAssistantMessageCount?: number) {
    if (typeof previousAssistantMessageCount === "number") {
      await this.page.waitForFunction(
        (prevCount) => {
          return document.querySelectorAll('[data-role="assistant"]').length > (prevCount ?? 0);
        },
        previousAssistantMessageCount,
        { timeout: 20_000 },
      );
      await this.sendButton.waitFor({ state: "visible", timeout: 20_000 });

      return;
    }

    await this.page.waitForSelector('[data-role="assistant"]', {
      timeout: 20_000,
    });
    await this.sendButton.waitFor({ state: "visible", timeout: 20_000 });
  }

  async waitForResponseText(text: string | RegExp) {
    await this.getLatestAssistantMessage().filter({ hasText: text }).waitFor({ timeout: 20_000 });
  }

  async getLastMessage(): Promise<string> {
    const lastMessage = this.assistantMessages.last();

    return await this.getText(lastMessage);
  }

  async getAssistantMessageCount(): Promise<number> {
    return await this.assistantMessages.count();
  }

  getLatestAssistantMessage(): Locator {
    return this.assistantMessages.last();
  }

  getLatestUserMessage(): Locator {
    return this.page.locator('[data-role="user"]').last();
  }

  private waitForCompletionRequest() {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/chat/completions"),
    );
  }

  async editLatestUserMessage(content: string) {
    const userMessage = this.getLatestUserMessage();

    await userMessage.getByRole("button", { name: "Edit message" }).click();
    await userMessage.getByPlaceholder("Edit your message...").fill(content);
    const completionResponse = this.waitForCompletionRequest();

    await userMessage.getByRole("button", { name: "Save", exact: true }).click();
    const response = await completionResponse;

    if (!response.ok()) {
      throw new Error(
        `Edited message completion failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await this.getLatestAssistantMessage().getByText(content).waitFor({ timeout: 20_000 });
  }

  async copyLatestAssistantMessage(): Promise<string> {
    const assistantMessage = this.getLatestAssistantMessage();

    await assistantMessage.getByRole("button", { name: "Copy message" }).click();
    await assistantMessage.getByRole("button", { name: "Copied!" }).waitFor();

    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  async retryLatestAssistantMessage() {
    const completionResponse = this.waitForCompletionRequest();

    await this.getLatestAssistantMessage().getByRole("button", { name: "Retry message" }).click();
    const response = await completionResponse;

    if (!response.ok()) {
      throw new Error(
        `Retried message completion failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await this.getLatestAssistantMessage()
      .getByRole("button", { name: "Retry message" })
      .waitFor({ timeout: 20_000 });
  }

  async submitLatestAssistantFeedback(value: "positive" | "negative") {
    const feedbackResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/chat\/completions\/[^/]+\/feedback$/.test(new URL(response.url()).pathname),
    );
    const label = value === "positive" ? "Thumbs up" : "Thumbs down";

    await this.getLatestAssistantMessage().getByRole("button", { name: label }).click();

    return feedbackResponse;
  }

  getLatestAssistantFeedbackButton(value: "positive" | "negative") {
    const label = value === "positive" ? "Thumbs up" : "Thumbs down";

    return this.getLatestAssistantMessage().getByRole("button", { name: label });
  }

  async configureResponseControls(reasoning: string, verbosity: string) {
    await this.page.getByRole("button", { name: /^Reasoning depth:/ }).click();
    await this.page.getByRole("menuitemradio", { name: reasoning, exact: true }).click();
    await this.page.getByRole("button", { name: /^Verbosity:/ }).click();
    await this.page.getByRole("menuitemradio", { name: verbosity, exact: true }).click();
    await this.page.getByRole("button", { name: `Reasoning depth: ${reasoning}` }).waitFor();
    await this.page.getByRole("button", { name: `Verbosity: ${verbosity}` }).waitFor();
  }

  async configureDetailedChatSettings() {
    await this.page.getByRole("button", { name: "Open chat settings" }).click();
    const settings = this.page.getByRole("dialog", { name: "Chat settings" });

    await settings.getByLabel("Temperature", { exact: true }).fill("0.4");
    await settings.getByLabel("Enable RAG", { exact: true }).check();
    await settings.getByRole("tab", { name: "Advanced", exact: true }).click();
    await settings.getByLabel("Context compaction", { exact: true }).selectOption("off");
    await settings.getByLabel("Top P", { exact: true }).fill("0.75");
    await settings.getByLabel("Max Tokens", { exact: true }).fill("1024");
    await settings.getByLabel("Presence penalty", { exact: true }).fill("0.4");
    await settings.getByLabel("Frequency penalty", { exact: true }).fill("-0.3");
    await settings.getByLabel("Top K Results", { exact: true }).fill("6");
    await settings.getByLabel("Score Threshold", { exact: true }).fill("0.65");
    await settings.getByLabel("Include Metadata", { exact: true }).check();
    await settings.getByLabel("Namespace", { exact: true }).fill("release-docs");
    await settings.getByRole("button", { name: "Done", exact: true }).click();
    await settings.waitFor({ state: "hidden" });
  }

  async sendMessageWithComposerActionAndReadCompletionRequest(message: string, action: string) {
    await this.fillInput(this.chatInput, message);
    const requestPromise = this.page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/chat/completions"),
    );

    await this.page.getByRole("button", { name: "Open commands" }).click();
    await this.page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ hasText: action })
      .first()
      .click();
    await this.clickElement(this.sendButton);

    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  async requestSecondOpinion(modelName: string, providerName: string) {
    const responsePromise = this.waitForCompletionRequest();

    await this.getLatestAssistantMessage()
      .getByRole("button", { name: "Get second opinion" })
      .click();
    await this.page.getByPlaceholder("Search models").fill(modelName);
    await this.page
      .getByRole("button")
      .filter({ hasText: modelName })
      .filter({ hasText: providerName })
      .first()
      .click();
    await this.page.getByRole("button", { name: "Ask for opinion", exact: true }).click();
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(
        `Second-opinion completion failed with ${response.status()}: ${await response.text()}`,
      );
    }

    return response.request().postDataJSON() as Record<string, unknown>;
  }

  async branchFromLatestUserMessageWithModel(modelName: string, providerName: string) {
    const responsePromise = this.waitForCompletionRequest();

    await this.getLatestUserMessage().getByRole("button", { name: "Branch conversation" }).click();
    await this.page.getByPlaceholder("Search other models").fill(modelName);
    await this.page
      .getByRole("button")
      .filter({ hasText: modelName })
      .filter({ hasText: providerName })
      .first()
      .click();
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(
        `Branched completion failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await this.page
      .getByRole("button", { name: "Go to original conversation", exact: true })
      .waitFor();
  }

  async shareConversation() {
    await this.clickElement(this.page.getByRole("button", { name: "Share conversation" }));
    const dialog = this.page.getByRole("dialog", { name: "Share Conversation" });

    await dialog.getByRole("button", { name: "Share Conversation" }).click();
    await this.page
      .getByRole("dialog", { name: "Manage Shared Conversation" })
      .getByLabel("Share link")
      .waitFor();
  }

  async stopSharingConversation() {
    const dialog = this.page.getByRole("dialog", { name: "Manage Shared Conversation" });

    await dialog.getByRole("button", { name: "Stop Sharing" }).click();
    await this.page
      .getByRole("dialog", { name: "Share Conversation" })
      .getByRole("button", { name: "Share Conversation" })
      .waitFor();
    await this.page.keyboard.press("Escape");
  }

  async branchFromLatestAssistantMessage() {
    await this.clickElement(
      this.getLatestAssistantMessage().getByRole("button", { name: "Branch conversation" }),
    );
    await this.page
      .getByRole("button", { name: "Go to original conversation", exact: true })
      .waitFor();
  }

  async returnToOriginalConversation() {
    await this.page
      .getByRole("button", { name: "Go to original conversation", exact: true })
      .click();
    await this.page.getByRole("region", { name: "Conversation messages" }).waitFor();
  }
}
