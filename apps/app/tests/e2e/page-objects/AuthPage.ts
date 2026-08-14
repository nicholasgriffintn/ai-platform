import type { Page, Locator } from "@playwright/test";
import { addVirtualAuthenticator } from "../support/virtual-authenticator";
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

	async enablePasskeySignInOption() {
		await this.page.addInitScript(() => {
			Object.defineProperty(window, "PublicKeyCredential", {
				value: class PublicKeyCredential {
					static isUserVerifyingPlatformAuthenticatorAvailable() {
						return Promise.resolve(true);
					}
				},
				configurable: true,
			});
		});
		await this.reload();
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

	async isMagicLinkEmailValid(): Promise<boolean> {
		return await this.emailInput.evaluate((input: HTMLInputElement) => input.checkValidity());
	}

	async loginWithPasskey() {
		await this.waitForLoginModal();
		const authenticationResponse = this.page.waitForResponse((response) => {
			if (response.request().method() !== "POST" || new URL(response.url()).pathname !== "/auth") {
				return false;
			}
			const body = response.request().postDataJSON() as {
				action?: string;
				values?: { ceremony?: string };
			};
			return body.action === "continue" && body.values?.ceremony === "authentication";
		});
		await this.clickElement(this.passkeyButton);
		const response = await authenticationResponse;
		if (!response.ok()) {
			throw new Error(
				`Passkey authentication failed with ${response.status()}: ${await response.text()}`,
			);
		}
		const body = (await response.json()) as { status?: string };
		if (body.status !== "authenticated") {
			throw new Error(`Passkey authentication returned ${body.status ?? "no status"}`);
		}
	}

	async registerSignOutAndSignInWithPasskey() {
		const removeVirtualAuthenticator = await addVirtualAuthenticator(this.page);
		try {
			await this.navigate("/profile?tab=passkeys");
			await this.page.getByRole("heading", { name: "Passkeys", exact: true }).waitFor();
			await this.page.getByRole("button", { name: "Add Passkey" }).first().click();
			await this.page
				.getByText(/Passkey$/, { exact: false })
				.filter({ hasNotText: "Add" })
				.first()
				.waitFor();

			await this.navigate("/profile?tab=account");
			await this.page.getByRole("button", { name: "Logout", exact: true }).click();
			await this.page.getByText("Sign in to view your profile", { exact: true }).waitFor();
			await this.navigate("/chat");
			await this.triggerLoginModal();
			await this.loginWithPasskey();
			await this.page
				.getByRole("button", { name: "Open settings and configuration" })
				.getByText("Pro Release User", { exact: true })
				.waitFor();

			await this.navigate("/profile?tab=passkeys");
			await this.page.getByRole("button", { name: "Remove passkey" }).click();
			const confirmation = this.page.getByRole("dialog", { name: "Remove Passkey" });
			await confirmation.getByRole("button", { name: "Remove Passkey" }).click();
			await confirmation.waitFor({ state: "hidden" });
			await this.navigate("/profile?tab=account");
			await this.page.getByRole("heading", { name: "Account", exact: true }).waitFor();
		} finally {
			await removeVirtualAuthenticator();
		}
	}

	async isLoggedIn(): Promise<boolean> {
		const logoutButton = this.page.getByRole("button", { name: "Logout", exact: true });
		const signedOutState = this.page.getByText("Sign in to view your profile", { exact: true });
		await logoutButton.or(signedOutState).first().waitFor();
		return await logoutButton.isVisible();
	}

	async triggerLoginModal() {
		const settingsButton = this.page.getByRole("button", {
			name: "Open settings and configuration",
		});
		await settingsButton.getByText("Guest", { exact: true }).waitFor();
		const signInButton = this.page.getByRole("button", { name: "Sign in", exact: true });
		for (let attempt = 0; attempt < 3 && !(await signInButton.isVisible()); attempt += 1) {
			await settingsButton.click();
			await signInButton.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
		}
		await this.clickElement(signInButton);
		await this.waitForLoginModal();
	}
}
