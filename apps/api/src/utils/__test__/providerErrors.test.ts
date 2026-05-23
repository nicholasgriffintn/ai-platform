import { describe, expect, it } from "vitest";

import {
	getProviderErrorMessage,
	isProviderRateLimit,
	isProviderRateLimitError,
	isRetryableProviderError,
} from "../providerErrors";
import { AssistantError, ErrorType } from "../errors";

describe("providerErrors", () => {
	it("reads provider messages from common error payload shapes", () => {
		expect(getProviderErrorMessage({ message: "Rate limit exceeded" })).toBe("Rate limit exceeded");
		expect(getProviderErrorMessage({ error: "Unavailable" })).toBe("Unavailable");
		expect(getProviderErrorMessage({ error: { message: "Nested provider error" } })).toBe(
			"Nested provider error",
		);
	});

	it("identifies gateway-wrapped provider rate limits", () => {
		expect(
			isProviderRateLimit(502, {
				raw_status_code: 429,
				code: "1300",
				type: "rate_limited",
				message: "Rate limit exceeded",
			}),
		).toBe(true);
	});

	it("identifies thrown structured provider rate limit payloads", () => {
		expect(
			isProviderRateLimitError({
				status: 502,
				raw_status_code: 429,
				code: "1300",
				type: "rate_limited",
				message: "Rate limit exceeded",
				object: "error",
			}),
		).toBe(true);
	});

	it("identifies typed assistant rate limit errors", () => {
		expect(
			isProviderRateLimitError(
				new AssistantError("Rate limit exceeded", ErrorType.RATE_LIMIT_ERROR),
			),
		).toBe(true);
	});

	it("does not classify unrelated provider failures as rate limits", () => {
		expect(
			isProviderRateLimit(502, {
				code: "internal_error",
				message: "Provider unavailable",
			}),
		).toBe(false);
	});

	it("does not classify message-only provider failures as rate limits", () => {
		expect(isProviderRateLimitError({ message: "Rate limit exceeded" })).toBe(false);
	});

	it("identifies transient provider failures as retryable", () => {
		expect(isRetryableProviderError({ status: 500 })).toBe(true);
		expect(isRetryableProviderError({ statusCode: 502 })).toBe(true);
		expect(isRetryableProviderError({ status: 408 })).toBe(true);
		expect(isRetryableProviderError({ code: "ETIMEDOUT" })).toBe(true);
		expect(isRetryableProviderError({ name: "AbortError" })).toBe(true);
		expect(
			isRetryableProviderError(new AssistantError("Network error", ErrorType.NETWORK_ERROR)),
		).toBe(true);
	});

	it("identifies rate limit provider failures as retryable", () => {
		expect(isRetryableProviderError({ status: 429 })).toBe(true);
		expect(
			isRetryableProviderError({
				status: 502,
				raw_status_code: 429,
				code: "1300",
				type: "rate_limited",
			}),
		).toBe(true);
	});

	it("does not retry client-side provider failures", () => {
		expect(isRetryableProviderError({ status: 400 })).toBe(false);
		expect(isRetryableProviderError({ status: 401 })).toBe(false);
		expect(isRetryableProviderError({ status: 403 })).toBe(false);
		expect(
			isRetryableProviderError(new AssistantError("Bad request", ErrorType.PARAMS_ERROR)),
		).toBe(false);
		expect(
			isRetryableProviderError(
				new AssistantError("Authentication failed", ErrorType.AUTHENTICATION_ERROR),
			),
		).toBe(false);
		expect(isRetryableProviderError({ message: "validation failed" })).toBe(false);
	});
});
