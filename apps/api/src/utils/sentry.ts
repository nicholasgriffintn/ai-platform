import type { CloudflareOptions } from "@sentry/cloudflare";
import * as Sentry from "@sentry/cloudflare";

import type { IEnv } from "~/types";
import { type AssistantError } from "./errors";

const TRACES_SAMPLE_RATE = 0.1;

export function getSentryOptions(
	env: Pick<IEnv, "ENV" | "SENTRY_DSN">,
): CloudflareOptions | undefined {
	if (!env.ENV || env.ENV === "development") {
		return undefined;
	}

	const dsn = env.SENTRY_DSN?.trim();
	if (!dsn) {
		return undefined;
	}

	return {
		dsn,
		environment: env.ENV,
		tracesSampleRate: TRACES_SAMPLE_RATE,
		enableRpcTracePropagation: true,
	};
}

export function shouldCaptureApiError(error: AssistantError): boolean {
	return (error.statusCode ?? 500) >= 500;
}

export function captureApiError(error: AssistantError, originalError: Error = error): void {
	if (!shouldCaptureApiError(error)) {
		return;
	}

	Sentry.withScope((scope) => {
		scope.setTag("error.type", error.type);
		scope.setTag("http.status_code", String(error.statusCode ?? 500));

		const requestId = error.context?.requestId;
		if (requestId) {
			scope.setTag("request_id", String(requestId));
		}

		Sentry.captureException(originalError);
	});
}
