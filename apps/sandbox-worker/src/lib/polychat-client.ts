const POLYCHAT_SANDBOX_USER_AGENT =
	"Polychat-Sandbox-Worker/1.0 (+https://polychat.app)";

const RETRYABLE_HTTP_STATUS_CODES = new Set([
	408, 409, 425, 429, 500, 502, 503, 504,
]);
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 3000;

export class PolychatApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly retryable: boolean,
	) {
		super(message);
		this.name = "PolychatApiError";
	}
}

export interface PolychatRetryOptions {
	maxAttempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export class PolychatClient {
	constructor(
		private baseUrl: string,
		private userToken: string,
	) {}

	private isRetryableError(error: unknown): boolean {
		if (error instanceof PolychatApiError) {
			return error.retryable;
		}

		if (!(error instanceof Error)) {
			return false;
		}

		if (error.name === "AbortError") {
			return false;
		}

		return error.name === "TypeError";
	}

	private async requestChatCompletion(params: {
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
			throw new PolychatApiError(
				response.status,
				`Polychat API request failed (${response.status}): ${errorText.slice(0, 500)}`,
				RETRYABLE_HTTP_STATUS_CODES.has(response.status),
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

	async chatCompletion(
		params: {
			messages: Array<{ role: string; content: string }>;
			model: string;
			stream?: boolean;
		},
		retryOptions?: PolychatRetryOptions,
	): Promise<string> {
		const maxAttempts = Math.max(
			1,
			Math.min(retryOptions?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 5),
		);
		const baseDelayMs = Math.max(
			100,
			retryOptions?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
		);
		const maxDelayMs = Math.max(
			baseDelayMs,
			retryOptions?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
		);

		let lastError: unknown;
		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			try {
				return await this.requestChatCompletion(params);
			} catch (error) {
				lastError = error;
				if (!this.isRetryableError(error) || attempt === maxAttempts) {
					throw error;
				}

				const jitter = Math.floor(Math.random() * 125);
				const delayMs = Math.min(
					baseDelayMs * 2 ** (attempt - 1) + jitter,
					maxDelayMs,
				);
				await sleep(delayMs);
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Polychat API request failed with unknown retry error");
	}
}
