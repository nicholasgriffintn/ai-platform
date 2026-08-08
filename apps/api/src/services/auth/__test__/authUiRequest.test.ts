import { describe, expect, it } from "vitest";

import { requireAuthUiRequest, requireAuthUiValue } from "~/services/auth/authUiRequest";

describe("shared authentication UI requests", () => {
	it("reads values from a shared authentication request", () => {
		expect(
			requireAuthUiValue(
				requireAuthUiRequest({
					action: "request_magic_link",
					values: { email: "me@example.com" },
				}),
				"email",
			),
		).toBe("me@example.com");
	});
});
