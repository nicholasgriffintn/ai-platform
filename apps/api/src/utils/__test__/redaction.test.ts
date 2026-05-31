import { describe, expect, it } from "vitest";

import { redactSensitiveTokens } from "../redaction";

describe("redactSensitiveTokens", () => {
	it("redacts labelled credential fields in objects", () => {
		const redacted = redactSensitiveTokens({
			message: "request failed",
			authorization: "Bearer Abcdef1234567890Ghijklm_Nopqrs",
			nested: {
				apiKey: "Abcdef1234567890Ghijklm_Nopqrs",
			},
		});

		expect(redacted).toEqual({
			message: "request failed",
			authorization: "[redacted]",
			nested: {
				apiKey: "[redacted]",
			},
		});
	});

	it("redacts auth schemes and labelled tokens in strings", () => {
		const redacted = redactSensitiveTokens(
			'provider failed authorization="Bearer Abcdef1234567890Ghijklm_Nopqrs" api_key=Abcdef1234567890Ghijklm_Nopqrs',
		);

		expect(redacted).not.toContain("Abcdef1234567890Ghijklm_Nopqrs");
		expect(redacted).toContain("[redacted]");
	});

	it("redacts likely high-entropy bare tokens without a caller-provided secret", () => {
		const redacted = redactSensitiveTokens(
			"provider echoed Abcdef1234567890Ghijklm_Nopqrs in the error body",
		);

		expect(redacted).toBe("provider echoed [redacted] in the error body");
	});
});
