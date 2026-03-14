import {
	sandboxRunControlSchema,
	type SandboxRunControl,
} from "@assistant/schemas";

const DEFAULT_CONTROL_REQUEST_TIMEOUT_MS = 8000;

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

async function fetchWithTimeout(
	request: Request,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutHandle = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	const forwardAbort = () => {
		controller.abort();
	};

	if (signal) {
		if (signal.aborted) {
			clearTimeout(timeoutHandle);
			throw new DOMException("Request aborted", "AbortError");
		}
		signal.addEventListener("abort", forwardAbort, { once: true });
	}

	try {
		return await fetch(request, {
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeoutHandle);
		if (signal) {
			signal.removeEventListener("abort", forwardAbort);
		}
	}
}

export interface RunControlClientOptions {
	polychatApiUrl: string;
	userToken: string;
	runId?: string;
	requestTimeoutMs?: number;
}

export class RunControlClient {
	private readonly polychatApiUrl: string;
	private readonly userToken: string;
	private readonly runId?: string;
	private readonly requestTimeoutMs: number;

	constructor(options: RunControlClientOptions) {
		this.polychatApiUrl = trimTrailingSlash(options.polychatApiUrl);
		this.userToken = options.userToken;
		this.runId = options.runId;
		this.requestTimeoutMs =
			options.requestTimeoutMs ?? DEFAULT_CONTROL_REQUEST_TIMEOUT_MS;
	}

	public async fetchControlState(
		signal?: AbortSignal,
	): Promise<SandboxRunControl | null> {
		if (!this.runId) {
			return null;
		}

		const controlUrl = `${this.polychatApiUrl}/apps/sandbox/runs/${encodeURIComponent(this.runId)}/control`;
		const request = new Request(controlUrl, {
			method: "GET",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${this.userToken}`,
			},
		});

		let response: Response;
		try {
			response = await fetchWithTimeout(request, this.requestTimeoutMs, signal);
		} catch {
			if (signal?.aborted) {
				return {
					runId: this.runId,
					state: "cancelled",
					updatedAt: new Date().toISOString(),
					cancellationReason: "Sandbox run cancelled",
				};
			}
			return null;
		}

		if (!response.ok) {
			if (response.status === 404 || response.status === 410) {
				return {
					runId: this.runId,
					state: "cancelled",
					updatedAt: new Date().toISOString(),
					cancellationReason: "Run control state unavailable",
				};
			}
			return null;
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			return null;
		}

		const parsed = sandboxRunControlSchema.safeParse(payload);
		if (!parsed.success) {
			return null;
		}

		return parsed.data;
	}
}
