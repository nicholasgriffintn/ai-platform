import { describe, expect, it } from "vitest";

import { ApiError } from "../api/fetch-wrapper";
import { getErrorMessage, isAuthenticationError } from "../errors";

describe("error helpers", () => {
	it("returns useful messages from unknown errors", () => {
		expect(getErrorMessage(new Error("Failed"), "Fallback")).toBe("Failed");
		expect(getErrorMessage("Failed", "Fallback")).toBe("Failed");
		expect(getErrorMessage("", "Fallback")).toBe("Fallback");
		expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
	});

	it("recognises API authentication failures", () => {
		expect(isAuthenticationError(new ApiError("Unauthorised", 401))).toBe(true);
		expect(isAuthenticationError(new ApiError("Forbidden", 403))).toBe(false);
		expect(
			isAuthenticationError(new Error("Authentication failed. Please check your credentials.")),
		).toBe(true);
	});
});
