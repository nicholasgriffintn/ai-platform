import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
	private readonly chatInput: Locator;
	private readonly sendButton: Locator;
	private readonly welcomeMessage: Locator;
	private readonly modelSelector: Locator;
	private readonly newChatButton: Locator;
	private readonly assistantMessages: Locator;

	constructor(page: Page) {
		super(page);
		this.chatInput = page.locator("#message-input");
		this.sendButton = page.getByRole("button", { name: /send message/i });
		this.welcomeMessage = page
			.getByText(/What would you like to know/i)
			.first();
		this.modelSelector = page.getByRole("button", { name: /select model/i });
		this.newChatButton = page.getByRole("button", { name: /New Chat/i });
		this.assistantMessages = page.locator('[data-role="assistant"]');
	}

	async sendMessage(message: string) {
		await this.fillInput(this.chatInput, message);
		await this.clickElement(this.sendButton);
	}

	async selectModel(modelName: string) {
		await this.clickElement(this.modelSelector);
		await this.clickElement(this.page.getByRole("option", { name: modelName }));
	}

	async startNewChat() {
		await this.clickElement(this.newChatButton);
	}

	async waitForWelcomeMessage() {
		await this.waitForElement(this.welcomeMessage);
	}

	async isWelcomeScreenVisible(): Promise<boolean> {
		try {
			await this.welcomeMessage.waitFor({ timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}

	async waitForChatResponse(previousAssistantMessageCount?: number) {
		if (typeof previousAssistantMessageCount === "number") {
			await this.page.waitForFunction(
				(prevCount) => {
					return (
						document.querySelectorAll('[data-role="assistant"]').length >
						(prevCount ?? 0)
					);
				},
				previousAssistantMessageCount,
				{ timeout: 60000 },
			);
			return;
		}

		await this.page.waitForSelector('[data-role="assistant"]', {
			timeout: 60000,
		});
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
}
