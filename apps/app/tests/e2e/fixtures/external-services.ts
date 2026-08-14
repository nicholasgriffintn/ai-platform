import type { Page } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

export class ExternalServices {
	constructor(private readonly page: Page) {}

	async mockGitHubAuthorization() {
		await this.page.route("https://github.com/login/oauth/**", async (route) => {
			await route.fulfill({
				contentType: "text/html",
				body: "<main><h1>GitHub authorisation</h1></main>",
			});
		});
	}

	async mockQrImage() {
		await this.page.route("http://pashi.app/api/qr?**", async (route) => {
			await route.fulfill({
				contentType: "image/png",
				body: ONE_PIXEL_PNG,
			});
		});
	}

	async mockComposioAuthorization() {
		await this.page.context().route("https://connect.composio.dev/link/**", async (route) => {
			const accountId = new URL(route.request().url()).searchParams.get("connected_account_id");
			if (!accountId) throw new Error("Composio authorization double received no account ID");
			await route.fulfill({
				status: 302,
				headers: {
					location: `http://localhost:8787/apps/connectors/composio/verify?status=success&connected_account_id=${encodeURIComponent(accountId)}`,
				},
			});
		});
	}

	async mockGeminiLiveWebSocket() {
		await this.page.routeWebSocket(
			/^wss:\/\/generativelanguage\.googleapis\.com\/ws\//,
			(webSocket) => {
				webSocket.onMessage((message) => {
					if (typeof message !== "string") return;
					const payload = JSON.parse(message) as { setup?: unknown };
					if (payload.setup) {
						webSocket.send(JSON.stringify({ setupComplete: {} }));
					}
				});
			},
		);
	}
}
