import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
	private readonly chatInput: Locator;
	private readonly sendButton: Locator;
	private readonly welcomeMessage: Locator;
	private readonly modelSelector: Locator;
	private readonly newChatButton: Locator;

	constructor(page: Page) {
		super(page);
		this.chatInput = page.locator("#message-input");
		this.sendButton = page.getByRole("button", { name: /send message/i });
		this.welcomeMessage = page
			.getByText(/What would you like to know/i)
			.first();
		this.modelSelector = page.getByRole("button", { name: /select model/i });
		this.newChatButton = page.getByRole("button", { name: /New Chat/i });
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

	async waitForChatResponse() {
		await this.page.waitForSelector('[data-role="assistant"]', {
			timeout: 30000,
		});
	}

	async getLastMessage(): Promise<string> {
		const messages = this.page.locator('[data-role="assistant"]');
		const lastMessage = messages.last();
		return await this.getText(lastMessage);
	}
}
