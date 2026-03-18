import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";
import { parseSseBuffer } from "~/lib/sandbox/sse";
import type {
	ConnectSandboxInstallationInput,
	CreateSandboxConnectionInput,
	ExecuteSandboxRunInput,
	SandboxConnection,
	SandboxInstallConfig,
	SandboxRunInstruction,
	SandboxRunInstructionKind,
	SandboxRun,
	SandboxRunEvent,
} from "~/types/sandbox";

async function extractApiErrorMessage(
	response: Response,
	fallback: string,
): Promise<string> {
	const bodyText = await response.text();
	if (!bodyText.trim()) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(bodyText) as {
			error?: string;
			message?: string;
			details?: unknown;
		};
		const topLevelMessage = parsed.error || parsed.message;
		if (topLevelMessage?.trim()) {
			return topLevelMessage;
		}

		if (Array.isArray(parsed.details) && parsed.details.length > 0) {
			const firstDetail = parsed.details[0] as { message?: unknown };
			if (
				typeof firstDetail?.message === "string" &&
				firstDetail.message.trim()
			) {
				return firstDetail.message;
			}
		}
	} catch {
		// Fall back to plain text body.
	}

	return bodyText;
}

export async function fetchSandboxConnections(): Promise<SandboxConnection[]> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/connections", {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox connections: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ connections: SandboxConnection[] }>(
		response,
	);
	return data.connections ?? [];
}

export async function fetchSandboxInstallConfig(): Promise<SandboxInstallConfig> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/github/install-config", {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox install configuration: ${response.statusText}`,
			),
		);
	}

	return returnFetchedData<SandboxInstallConfig>(response);
}

export async function upsertSandboxConnection(
	input: CreateSandboxConnectionInput,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/connections", {
		method: "POST",
		headers,
		body: input,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to save sandbox connection: ${response.statusText}`,
			),
		);
	}
}

export async function connectSandboxInstallation(
	input: ConnectSandboxInstallationInput,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/connections/auto", {
		method: "POST",
		headers,
		body: input,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to connect GitHub installation: ${response.statusText}`,
			),
		);
	}
}

export async function deleteSandboxConnection(
	installationId: number,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(
		`/apps/sandbox/connections/${installationId}`,
		{
			method: "DELETE",
			headers,
		},
	);

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to delete sandbox connection: ${response.statusText}`,
			),
		);
	}
}

export async function fetchSandboxRuns(params: {
	installationId?: number;
	repo?: string;
	limit?: number;
}): Promise<SandboxRun[]> {
	const headers = await apiService.getHeaders();
	const searchParams = new URLSearchParams();

	if (params.installationId !== undefined) {
		searchParams.set("installationId", String(params.installationId));
	}
	if (params.repo) {
		searchParams.set("repo", params.repo);
	}
	if (params.limit !== undefined) {
		searchParams.set("limit", String(params.limit));
	}

	const query = searchParams.toString();
	const response = await fetchApi(
		`/apps/sandbox/runs${query ? `?${query}` : ""}`,
		{
			method: "GET",
			headers,
		},
	);

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox runs: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ runs: SandboxRun[] }>(response);
	return data.runs ?? [];
}

export async function fetchSandboxRun(runId: string): Promise<SandboxRun> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(`/apps/sandbox/runs/${runId}`, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox run: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ run: SandboxRun }>(response);
	if (!data.run) {
		throw new Error("Sandbox run was not returned");
	}
	return data.run;
}

export async function fetchSandboxRunInstructions(
	runId: string,
): Promise<SandboxRunInstruction[]> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(`/apps/sandbox/runs/${runId}/instructions`, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox run instructions: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{
		instructions?: Array<{ instruction?: SandboxRunInstruction }>;
	}>(response);
	const envelopes = Array.isArray(data.instructions) ? data.instructions : [];
	return envelopes
		.map((entry) => entry.instruction)
		.filter((entry): entry is SandboxRunInstruction => Boolean(entry));
}

export async function cancelSandboxRun(
	runId: string,
	reason?: string,
): Promise<SandboxRun> {
	return mutateSandboxRunState({
		runId,
		action: "cancel",
		reason,
		errorFallback: "Failed to cancel sandbox run",
	});
}

export async function pauseSandboxRun(
	runId: string,
	reason?: string,
): Promise<SandboxRun> {
	return mutateSandboxRunState({
		runId,
		action: "pause",
		reason,
		errorFallback: "Failed to pause sandbox run",
	});
}

export async function resumeSandboxRun(
	runId: string,
	reason?: string,
): Promise<SandboxRun> {
	return mutateSandboxRunState({
		runId,
		action: "resume",
		reason,
		errorFallback: "Failed to resume sandbox run",
	});
}

async function mutateSandboxRunState(params: {
	runId: string;
	action: "cancel" | "pause" | "resume";
	reason?: string;
	errorFallback: string;
}): Promise<SandboxRun> {
	const { runId, action, reason, errorFallback } = params;
	const headers = await apiService.getHeaders();
	const response = await fetchApi(`/apps/sandbox/runs/${runId}/${action}`, {
		method: "POST",
		headers,
		body: {
			reason,
		},
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`${errorFallback}: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ run: SandboxRun }>(response);
	if (!data.run) {
		throw new Error("Sandbox run was not returned");
	}
	return data.run;
}

export async function submitSandboxRunInstruction(params: {
	runId: string;
	kind?: SandboxRunInstructionKind;
	content?: string;
	command?: string;
	requestId?: string;
	approvalStatus?: "approved" | "rejected";
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(
		`/apps/sandbox/runs/${params.runId}/instructions`,
		{
			method: "POST",
			headers,
			body: {
				kind: params.kind ?? "message",
				content: params.content,
				command: params.command,
				requestId: params.requestId,
				approvalStatus: params.approvalStatus,
				timeoutSeconds: params.timeoutSeconds,
				escalateAfterSeconds: params.escalateAfterSeconds,
			},
		},
	);

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to submit run instruction: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ instruction?: SandboxRunInstruction }>(
		response,
	);
	if (!data.instruction) {
		throw new Error("Submitted instruction was not returned");
	}
	return data.instruction;
}

export interface StreamSandboxRunOptions {
	signal?: AbortSignal;
	onEvent: (event: SandboxRunEvent) => void;
	onRunStarted?: (runId: string) => void;
	onComplete?: (finalEvent?: SandboxRunEvent) => void;
}

export interface StreamSandboxRunEventsOptions {
	signal?: AbortSignal;
	after?: number;
	onEvent: (event: SandboxRunEvent) => void;
	onComplete?: (finalEvent?: SandboxRunEvent) => void;
}

export async function streamSandboxRun(
	input: ExecuteSandboxRunInput,
	options: StreamSandboxRunOptions,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/runs/execute-stream", {
		method: "POST",
		headers: {
			...headers,
			Accept: "text/event-stream",
		},
		body: input,
		timeoutMs: null,
		signal: options.signal,
	});

	if (!response.ok) {
		const message = await extractApiErrorMessage(
			response,
			`Failed to execute sandbox run: ${response.statusText}`,
		);
		throw new Error(message);
	}

	const responseRunId = response.headers.get("X-Sandbox-Run-Id")?.trim();
	if (responseRunId) {
		options.onRunStarted?.(responseRunId);
	}

	if (!response.body) {
		throw new Error("Sandbox stream response body is empty");
	}

	const contentType = response.headers.get("content-type") || "";
	if (!contentType.includes("text/event-stream")) {
		const data = await returnFetchedData<{ run: SandboxRun }>(response);
		const syntheticEvent: SandboxRunEvent = {
			type:
				data.run?.status === "completed"
					? "run_completed"
					: data.run?.status === "paused"
						? "run_paused"
						: data.run?.status === "cancelled"
							? "run_cancelled"
							: "run_failed",
			runId: data.run?.runId,
			result: data.run?.result,
			error: data.run?.error,
			message: data.run?.cancellationReason,
		};
		options.onEvent(syntheticEvent);
		options.onComplete?.(syntheticEvent);
		return;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finalEvent: SandboxRunEvent | undefined;
	const handleEvent = (event: SandboxRunEvent) => {
		options.onEvent(event);
		if (
			event.type === "run_completed" ||
			event.type === "run_failed" ||
			event.type === "run_cancelled"
		) {
			finalEvent = event;
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (!value) {
				continue;
			}

			buffer += decoder.decode(value, { stream: true });
			buffer = parseSseBuffer<SandboxRunEvent>(buffer, {
				onEvent: handleEvent,
			});
		}

		if (buffer.trim()) {
			parseSseBuffer<SandboxRunEvent>(`${buffer}\n\n`, {
				onEvent: handleEvent,
				onError: () => {
					// Ignore final parse errors from truncated buffers.
				},
			});
		}
	} finally {
		reader.releaseLock();
		options.onComplete?.(finalEvent);
	}
}

export async function streamSandboxRunEvents(
	runId: string,
	options: StreamSandboxRunEventsOptions,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const params = new URLSearchParams();
	if (typeof options.after === "number" && options.after > 0) {
		params.set("after", String(options.after));
	}
	const query = params.toString();
	const response = await fetchApi(
		`/apps/sandbox/runs/${encodeURIComponent(runId)}/events/stream${
			query ? `?${query}` : ""
		}`,
		{
			method: "GET",
			headers: {
				...headers,
				Accept: "text/event-stream",
			},
			timeoutMs: null,
			signal: options.signal,
		},
	);

	if (!response.ok) {
		const message = await extractApiErrorMessage(
			response,
			`Failed to stream sandbox run events: ${response.statusText}`,
		);
		throw new Error(message);
	}

	if (!response.body) {
		throw new Error("Sandbox events stream response body is empty");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finalEvent: SandboxRunEvent | undefined;
	const handleEvent = (event: SandboxRunEvent) => {
		options.onEvent(event);
		if (
			event.type === "run_completed" ||
			event.type === "run_failed" ||
			event.type === "run_cancelled"
		) {
			finalEvent = event;
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (!value) {
				continue;
			}

			buffer += decoder.decode(value, { stream: true });
			buffer = parseSseBuffer<SandboxRunEvent>(buffer, {
				onEvent: handleEvent,
			});
		}

		if (buffer.trim()) {
			parseSseBuffer<SandboxRunEvent>(`${buffer}\n\n`, {
				onEvent: handleEvent,
				onError: () => {
					// Ignore final parse errors from truncated buffers.
				},
			});
		}
	} finally {
		reader.releaseLock();
		options.onComplete?.(finalEvent);
	}
}
