const POLYCHAT_SANDBOX_USER_AGENT =
	"Polychat-Sandbox-Worker/1.0 (+https://polychat.app)";

export class PolychatClient {
	constructor(
		private baseUrl: string,
		private userToken: string,
	) {}

	async chatCompletion(params: {
		messages: Array<{ role: string; content: string }>;
		model: string;
		stream?: boolean;
	}): Promise<string> {
		const chatId = crypto.randomUUID();

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.userToken}`,
				"User-Agent": POLYCHAT_SANDBOX_USER_AGENT,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				completion_id: chatId,
				platform: "api",
				store: false,
				...params,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Polychat API request failed (${response.status}): ${errorText.slice(0, 500)}`,
			);
		}

		const data = (await response.json()) as {
			choices: Array<{
				message: {
					content: string;
				};
			}>;
		};

		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error("Polychat API returned an empty completion response");
		}

		return content;
	}
}
