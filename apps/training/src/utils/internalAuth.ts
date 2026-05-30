import { TRAINING_WORKER_TOKEN_HEADER, TRAINING_WORKER_USER_ID_HEADER } from "@assistant/schemas";

import { HttpError } from "./http.js";

interface InternalAuthEnv {
	TRAINING_WORKER_TOKEN?: string;
}

export function assertInternalRequest(request: Request, env: InternalAuthEnv): void {
	if (!env.TRAINING_WORKER_TOKEN) {
		throw new HttpError("Training worker token is not configured", 500);
	}

	const token = request.headers.get(TRAINING_WORKER_TOKEN_HEADER);
	if (token !== env.TRAINING_WORKER_TOKEN) {
		throw new HttpError("Unauthorized", 401);
	}
}

export function getInternalUserId(request: Request): number {
	const value = request.headers.get(TRAINING_WORKER_USER_ID_HEADER);
	if (!value) {
		throw new HttpError("Missing internal user context", 400);
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new HttpError("Invalid internal user context", 400);
	}

	return parsed;
}
