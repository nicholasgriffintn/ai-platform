import {
	sandboxRunControlSchema,
	sandboxRunInstructionEnvelopeSchema,
	type SandboxRunControl,
	type SandboxRunInstruction,
	type SandboxRunInstructionEnvelope,
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

export interface RequestCommandApprovalOptions {
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
}

interface CommandApproval {
	id: string;
	runId: string;
	command: string;
	status: "pending" | "escalated" | "timed_out" | "approved" | "rejected";
	requestedAt: string;
	resolvedAt?: string;
	resolutionReason?: string;
	requestReason?: string;
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
	expiresAt?: string;
	escalationAt?: string;
	escalatedAt?: string;
	timedOutAt?: string;
}

function mapApprovalInstructionToApproval(
	instruction: SandboxRunInstruction | null,
	fallbackCommand?: string,
): CommandApproval | null {
	if (!instruction || instruction.kind !== "approval_request") {
		return null;
	}

	return {
		id: instruction.id,
		runId: instruction.runId,
		command: instruction.command || fallbackCommand || "",
		status: instruction.approvalStatus ?? "pending",
		requestedAt: instruction.createdAt,
		resolvedAt: instruction.resolvedAt,
		resolutionReason: instruction.resolutionReason,
		requestReason: instruction.content,
		timeoutSeconds: instruction.timeoutSeconds,
		escalateAfterSeconds: instruction.escalateAfterSeconds,
		expiresAt: instruction.expiresAt,
		escalationAt: instruction.escalationAt,
		escalatedAt: instruction.escalatedAt,
		timedOutAt: instruction.timedOutAt,
	};
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

	public async requestCommandApproval(
		command: string,
		reason?: string,
		options?: RequestCommandApprovalOptions,
		signal?: AbortSignal,
	): Promise<CommandApproval | null> {
		if (!this.runId || !command.trim()) {
			return null;
		}

		const url = `${this.polychatApiUrl}/apps/sandbox/runs/${encodeURIComponent(this.runId)}/instructions`;
		const requestBody: Record<string, unknown> = {
			kind: "approval_request",
			command,
			content: reason,
		};
		if (typeof options?.timeoutSeconds === "number") {
			requestBody.timeoutSeconds = options.timeoutSeconds;
		}
		if (typeof options?.escalateAfterSeconds === "number") {
			requestBody.escalateAfterSeconds = options.escalateAfterSeconds;
		}
		const request = new Request(url, {
			method: "POST",
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${this.userToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});
		let response: Response;
		try {
			response = await fetchWithTimeout(request, this.requestTimeoutMs, signal);
		} catch {
			return null;
		}

		if (!response.ok) {
			return null;
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			return null;
		}

		const instruction = (payload as { instruction?: SandboxRunInstruction })
			.instruction;
		return mapApprovalInstructionToApproval(instruction ?? null, command);
	}

	public async fetchApproval(
		approvalId: string,
		signal?: AbortSignal,
	): Promise<CommandApproval | null> {
		if (!this.runId || !approvalId.trim()) {
			return null;
		}

		const instructions = await this.listInstructions(0, signal);
		const match = instructions
			.slice()
			.reverse()
			.find(
				(entry) =>
					entry.instruction.kind === "approval_request" &&
					entry.instruction.id === approvalId,
			);
		return mapApprovalInstructionToApproval(match?.instruction ?? null);
	}

	public async listInstructions(
		after = 0,
		signal?: AbortSignal,
	): Promise<SandboxRunInstructionEnvelope[]> {
		if (!this.runId) {
			return [];
		}

		const instructionsUrl = new URL(
			`${this.polychatApiUrl}/apps/sandbox/runs/${encodeURIComponent(this.runId)}/instructions`,
		);
		if (Number.isFinite(after) && after > 0) {
			instructionsUrl.searchParams.set("after", String(after));
		}
		const request = new Request(instructionsUrl.toString(), {
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
			return [];
		}
		if (!response.ok) {
			return [];
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			return [];
		}
		const rawInstructions = (
			payload as { instructions?: unknown[] | undefined }
		).instructions;
		if (!Array.isArray(rawInstructions)) {
			return [];
		}

		const instructions: SandboxRunInstructionEnvelope[] = [];
		for (const entry of rawInstructions) {
			const parsed = sandboxRunInstructionEnvelopeSchema.safeParse(entry);
			if (parsed.success) {
				instructions.push(parsed.data);
			}
		}
		return instructions;
	}
}
