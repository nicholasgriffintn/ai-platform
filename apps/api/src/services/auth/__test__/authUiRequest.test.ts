import { describe, expect, it } from "vitest";

import { parseAssistantAuthUiRequest } from "~/services/auth/authUiRequest";

describe("shared authentication UI requests", () => {
	it("reads values from a shared authentication request", () => {
		const request = parseAssistantAuthUiRequest({
			action: "request_magic_link",
			values: { email: "me@example.com" },
		});
		expect(request).toEqual({
			action: "request_magic_link",
			values: { email: "me@example.com" },
		});
	});
});
