import type { CloudflareOptions } from "@sentry/cloudflare";
import * as Sentry from "@sentry/cloudflare";

import type { IEnv } from "~/types";
import { type AssistantError, ErrorType } from "./errors";

const NON_REPORTABLE_AUTH_ERROR_TYPES = new Set<ErrorType>([
	ErrorType.AUTHENTICATION_ERROR,
	ErrorType.AUTHORISATION_ERROR,
	ErrorType.FORBIDDEN,
	ErrorType.UNAUTHORIZED,
]);

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
		sampleRate: 1,
		enableLogs: false,
		tracesSampleRate: 0,
		beforeSend(event) {
			return event.exception?.values?.length ? event : null;
		},
		beforeSendTransaction() {
			return null;
		},
		enableRpcTracePropagation: true,
	};
}

export function shouldCaptureApiError(error: AssistantError): boolean {
	if (NON_REPORTABLE_AUTH_ERROR_TYPES.has(error.type)) {
		return false;
	}

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
