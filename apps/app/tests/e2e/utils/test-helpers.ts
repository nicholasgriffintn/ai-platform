import type { Page } from "@playwright/test";
import { HomePage, AuthPage } from "../page-objects";

export class TestHelpers {
	static createHomePage(page: Page): HomePage {
		return new HomePage(page);
	}

	static createAuthPage(page: Page): AuthPage {
		return new AuthPage(page);
	}

	static async mockApiResponse(page: Page, endpoint: string, response: any) {
		await page.route(endpoint, (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(response),
			});
		});

		const apiEndpoint = endpoint.replace("**/api/", "**/localhost:8787/");
		await page.route(apiEndpoint, (route) => {
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(response),
			});
		});
	}

	static async mockChatResponse(page: Page, message: string) {
		const streamResponse = `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":${Date.now()},"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"${message}"},"finish_reason":null}]}\n\ndata: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":${Date.now()},"model":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`;

		await page.route("**/api/chat/completions", (route) => {
			route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: streamResponse,
			});
		});

		await page.route("**/localhost:8787/chat/completions", (route) => {
			route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: streamResponse,
			});
		});
	}

	static async waitForNetworkIdle(page: Page, timeout: number = 2000) {
		await page.waitForLoadState("networkidle", { timeout });
	}

	static async clearLocalStorage(
		page: Page,
		options?: { preserveKeys?: string[] },
	) {
		try {
			await page.evaluate(
				({ preserveKeys }) => {
					const preservedEntries: Array<[string, string]> = [];

					if (Array.isArray(preserveKeys) && preserveKeys.length > 0) {
						for (const key of preserveKeys) {
							const value = window.localStorage.getItem(key);
							if (value !== null) {
								preservedEntries.push([key, value]);
							}
						}
					}

					localStorage.clear();
					sessionStorage.clear();

					for (const [key, value] of preservedEntries) {
						window.localStorage.setItem(key, value);
					}
				},
				{ preserveKeys: options?.preserveKeys ?? [] },
			);
		} catch (error) {
			// localStorage not available yet, skip clearing
			console.warn("Could not clear localStorage:", error);
		}
	}

	static async setLocalStorageItem(page: Page, key: string, value: string) {
		await page.evaluate(
			({ key, value }) => {
				localStorage.setItem(key, value);
			},
			{ key, value },
		);
	}

	static async injectApiKeyBeforeNavigation(page: Page, apiKey: string) {
		await page.addInitScript(
			({ apiKey }) => {
				window.localStorage.setItem("api_key", apiKey);
				window.localStorage.setItem("localOnlyMode", "false");
			},
			{ apiKey },
		);
	}
}
