import { describe, expect, it } from "vitest";

import {
	getProviderErrorMessage,
	isProviderRateLimit,
	isProviderRateLimitError,
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
});
