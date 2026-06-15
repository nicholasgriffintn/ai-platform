import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "../errors";
import { captureApiError, getSentryOptions, shouldCaptureApiError } from "../sentry";

const sentryMock = vi.hoisted(() => {
	const setTag = vi.fn();
	return {
		captureException: vi.fn(),
		setTag,
		withScope: vi.fn((callback: (scope: { setTag: typeof setTag }) => void) => {
			callback({ setTag });
		}),
	};
});

vi.mock("@sentry/cloudflare", () => sentryMock);

describe("getSentryOptions", () => {
	it("returns undefined when no DSN is configured", () => {
		expect(getSentryOptions({ ENV: "production" })).toBeUndefined();
	});

	it("builds Cloudflare Sentry options from the Worker environment", () => {
		expect(
			getSentryOptions({
				ENV: "production",
				SENTRY_DSN: " https://example@sentry.invalid/1 ",
			}),
		).toEqual({
			dsn: "https://example@sentry.invalid/1",
			environment: "production",
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
		});
	});
});

describe("captureApiError", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not capture expected client errors", () => {
		const error = new AssistantError("Invalid request", ErrorType.PARAMS_ERROR, 400);

		expect(shouldCaptureApiError(error)).toBe(false);
		captureApiError(error);

		expect(sentryMock.captureException).not.toHaveBeenCalled();
	});

	it("captures server errors with low-cardinality tags", () => {
		const originalError = new Error("Database unavailable");
		const error = new AssistantError("Database unavailable", ErrorType.DATABASE_ERROR, 500, {
			requestId: "request-123",
			userPrompt: "do not send this to Sentry extras",
		});

		expect(shouldCaptureApiError(error)).toBe(true);
		captureApiError(error, originalError);

		expect(sentryMock.setTag).toHaveBeenCalledWith("error.type", ErrorType.DATABASE_ERROR);
		expect(sentryMock.setTag).toHaveBeenCalledWith("http.status_code", "500");
		expect(sentryMock.setTag).toHaveBeenCalledWith("request_id", "request-123");
		expect(sentryMock.captureException).toHaveBeenCalledWith(originalError);
	});
});
