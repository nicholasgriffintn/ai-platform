import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class AuthPage extends BasePage {
	private readonly loginModal: Locator;
	private readonly githubButton: Locator;
	private readonly emailInput: Locator;
	private readonly magicLinkButton: Locator;
	private readonly passkeyButton: Locator;

	constructor(page: Page) {
		super(page);
		this.loginModal = page.getByRole("dialog");
		this.githubButton = page.getByRole("button", {
			name: /sign in with github/i,
		});
		this.emailInput = page.getByRole("textbox", { name: /email/i });
		this.magicLinkButton = page.getByRole("button", {
			name: /sign in with email/i,
		});
		this.passkeyButton = page.getByRole("button", {
			name: /sign in with passkey/i,
		});
	}

	async waitForLoginModal() {
		await this.waitForElement(this.loginModal);
	}

	async isLoginModalVisible(): Promise<boolean> {
		try {
			await this.loginModal.waitFor({ timeout: 2000 });
			return true;
		} catch {
			return false;
		}
	}

	async loginWithGitHub() {
		await this.waitForLoginModal();
		await this.clickElement(this.githubButton);
	}

	async loginWithMagicLink(email: string) {
		await this.waitForLoginModal();
		await this.fillInput(this.emailInput, email);
		await this.clickElement(this.magicLinkButton);
	}

	async loginWithPasskey() {
		await this.waitForLoginModal();
		await this.clickElement(this.passkeyButton);
	}

	async isLoggedIn(): Promise<boolean> {
		try {
			// Check for user menu or any indicator of logged-in state
			await this.page.waitForSelector('[data-testid="user-menu"]', {
				timeout: 5000,
			});
			return true;
		} catch {
			return false;
		}
	}

	async triggerLoginModal() {
		// This method would need to be implemented based on how login is actually triggered
		// For now, it's a placeholder since login is typically triggered by other actions
		await this.page.evaluate(() => {
			// Try to find and click any element that might trigger login
			const triggers = document.querySelectorAll(
				'[data-auth-trigger], button[aria-label*="sign"], button[aria-label*="login"]',
			);
			if (triggers.length > 0) {
				(triggers[0] as HTMLElement).click();
			}
		});
	}
}
