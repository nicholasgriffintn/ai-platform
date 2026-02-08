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
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				completion_id: chatId,
				platform: "api",
				store: false,
				...params,
			}),
		});

		const data = (await response.json()) as {
			choices: Array<{
				message: {
					content: string;
				};
			}>;
		};
		return data.choices[0].message.content;
	}
}
