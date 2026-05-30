import type { ZodType } from "zod";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

const FINETUNE_WORKER_ORIGIN = "https://finetune.worker.internal";

export async function requestFinetuneWorker<T>(
	env: IEnv,
	path: string,
	responseSchema: ZodType<T>,
	init: { method?: string; body?: unknown } = {},
): Promise<T> {
	if (!env.FINETUNE_WORKER) {
		throw new AssistantError(
			"Fine-tuning worker binding is not configured",
			ErrorType.CONFIGURATION_ERROR,
			500,
		);
	}

	const request = new Request(`${FINETUNE_WORKER_ORIGIN}${path}`, {
		method: init.method || "GET",
		headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const response = await env.FINETUNE_WORKER.fetch(request);
	const payload = await readFinetuneWorkerJson(response);

	if (!response.ok) {
		throw new AssistantError(
			getFinetuneWorkerErrorMessage(payload, response.statusText),
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}

	return responseSchema.parse(payload);
}

async function readFinetuneWorkerJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return undefined;

	try {
		return JSON.parse(text);
	} catch {
		throw new AssistantError(
			"Fine-tuning worker returned invalid JSON",
			ErrorType.PROVIDER_ERROR,
			response.status,
		);
	}
}

function getFinetuneWorkerErrorMessage(payload: unknown, fallback: string): string {
	if (isRecord(payload) && typeof payload.error === "string") {
		return payload.error;
	}

	return fallback || "Fine-tuning worker request failed";
}
