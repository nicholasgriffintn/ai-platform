import { describe, expect, it } from "vitest";

import { formatProviderError } from "../errors";

describe("formatProviderError", () => {
	it("formats and redacts provider response bodies", async () => {
		const secret = "Abcdef1234567890Ghijklm_Nopqrs";
		const response = new Response(
			JSON.stringify({
				error: `upstream echoed ${secret}`,
				authorization: `Bearer ${secret}`,
			}),
			{ status: 401, statusText: "Unauthorized" },
		);

		const message = await formatProviderError(response, "Provider request failed");

		expect(message).toContain("Provider request failed: 401 Unauthorized");
		expect(message).toContain("[redacted]");
		expect(message).not.toContain(secret);
	});

	it("formats and redacts caught errors", async () => {
		const secret = "Abcdef1234567890Ghijklm_Nopqrs";
		const message = await formatProviderError(
			new Error(`Authorization: Bearer ${secret}`),
			"Provider request failed",
		);

		expect(message).toBe("Provider request failed: Authorization: [redacted]");
		expect(message).not.toContain(secret);
	});
});
