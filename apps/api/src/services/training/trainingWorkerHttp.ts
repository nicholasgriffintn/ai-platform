import { FINETUNE_WORKER_TOKEN_HEADER, FINETUNE_WORKER_USER_ID_HEADER } from "@assistant/schemas";
import type { ZodType } from "zod";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

const FINETUNE_WORKER_ORIGIN = "https://finetune.worker.internal";

export async function requestTrainingWorker<T>(
	env: IEnv,
	path: string,
	responseSchema: ZodType<T>,
	init: { method?: string; body?: unknown; userId: number },
): Promise<T> {
	if (!env.FINETUNE_WORKER) {
		throw new AssistantError(
			"Training worker binding is not configured",
			ErrorType.CONFIGURATION_ERROR,
			500,
		);
	}

	const workerToken = env.FINETUNE_WORKER_TOKEN;
	if (!workerToken) {
		throw new AssistantError(
			"Training worker token is not configured",
			ErrorType.CONFIGURATION_ERROR,
			500,
		);
	}

	const headers = getTrainingWorkerHeaders(workerToken, init);
	const request = new Request(`${FINETUNE_WORKER_ORIGIN}${path}`, {
		method: init.method || "GET",
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const response = await env.FINETUNE_WORKER.fetch(request);
	const payload = await readTrainingWorkerJson(response);

	if (!response.ok) {
		throw new AssistantError(
			getTrainingWorkerErrorMessage(payload, response.statusText),
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}

	return responseSchema.parse(payload);
}

function getTrainingWorkerHeaders(
	workerToken: string,
	init: { body?: unknown; userId: number },
): Headers {
	const headers = new Headers();

	if (init.body !== undefined) {
		headers.set("Content-Type", "application/json");
	}

	headers.set(FINETUNE_WORKER_USER_ID_HEADER, String(init.userId));
	headers.set(FINETUNE_WORKER_TOKEN_HEADER, workerToken);

	return headers;
}

async function readTrainingWorkerJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return undefined;

	try {
		return JSON.parse(text);
	} catch {
		throw new AssistantError(
			"Training worker returned invalid JSON",
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}
}

function getTrainingWorkerErrorMessage(payload: unknown, fallback: string): string {
	if (isRecord(payload) && typeof payload.error === "string") {
		return payload.error;
	}

	return fallback || "Training worker request failed";
}
