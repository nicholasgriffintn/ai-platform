import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";
import { parseSseBuffer } from "~/lib/sandbox/sse";
import type {
	DynamicWorkerRun,
	DynamicWorkerRunEvent,
	ExecuteDynamicWorkerRunPayload,
} from "~/types/dynamic-workers";

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
		};
		return parsed.error || parsed.message || bodyText;
	} catch {
		return bodyText;
	}
}

export async function fetchDynamicWorkerRuns(params?: {
	limit?: number;
}): Promise<DynamicWorkerRun[]> {
	const headers = await apiService.getHeaders();
	const searchParams = new URLSearchParams();
	if (typeof params?.limit === "number") {
		searchParams.set("limit", String(params.limit));
	}

	const query = searchParams.toString();
	const response = await fetchApi(
		`/apps/dynamic-workers/runs${query ? `?${query}` : ""}`,
		{
			method: "GET",
			headers,
		},
	);

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch dynamic worker runs: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ runs: DynamicWorkerRun[] }>(response);
	return data.runs ?? [];
}

export async function cancelDynamicWorkerRun(
	runId: string,
): Promise<DynamicWorkerRun> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(
		`/apps/dynamic-workers/runs/${runId}/cancel`,
		{
			method: "POST",
			headers,
			body: {},
		},
	);

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to cancel dynamic worker run: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ run: DynamicWorkerRun }>(response);
	if (!data.run) {
		throw new Error("Dynamic worker run was not returned");
	}
	return data.run;
}

export interface StreamDynamicWorkerRunOptions {
	signal?: AbortSignal;
	onEvent: (event: DynamicWorkerRunEvent) => void;
	onRunStarted?: (runId: string) => void;
	onComplete?: (finalEvent?: DynamicWorkerRunEvent) => void;
}

export async function streamDynamicWorkerRun(
	input: ExecuteDynamicWorkerRunPayload,
	options: StreamDynamicWorkerRunOptions,
): Promise<void> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/dynamic-workers/runs/execute-stream", {
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
			`Failed to execute dynamic worker run: ${response.statusText}`,
		);
		throw new Error(message);
	}

	const responseRunId = response.headers.get("X-Dynamic-Worker-Run-Id")?.trim();
	if (responseRunId) {
		options.onRunStarted?.(responseRunId);
	}

	if (!response.body) {
		throw new Error("Dynamic worker stream response body is empty");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finalEvent: DynamicWorkerRunEvent | undefined;
	const handleEvent = (event: DynamicWorkerRunEvent) => {
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
			buffer = parseSseBuffer<DynamicWorkerRunEvent>(buffer, {
				onEvent: handleEvent,
			});
		}
	} finally {
		reader.releaseLock();
		options.onComplete?.(finalEvent);
	}
}
