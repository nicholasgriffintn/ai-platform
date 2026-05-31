import { describe, expect, it } from "vitest";

import { ApiError } from "../fetch-wrapper";
import { shouldRetryApiQuery } from "../retry";

describe("shouldRetryApiQuery", () => {
	it("does not retry authentication failures", () => {
		expect(shouldRetryApiQuery(0, new ApiError("Unauthorized", 401))).toBe(false);
		expect(shouldRetryApiQuery(0, new ApiError("Forbidden", 403))).toBe(false);
	});

	it("retries transient API failures until the query retry limit", () => {
		expect(shouldRetryApiQuery(0, new ApiError("Server error", 500))).toBe(true);
		expect(shouldRetryApiQuery(1, new ApiError("Rate limited", 429))).toBe(true);
		expect(shouldRetryApiQuery(2, new ApiError("Server error", 500))).toBe(false);
	});

	it("does not retry statusless application errors", () => {
		expect(shouldRetryApiQuery(0, new Error("Failed to list agents: Unauthorized"))).toBe(false);
	});

	it("retries fetch-shaped network errors", () => {
		expect(shouldRetryApiQuery(0, new TypeError("Failed to fetch"))).toBe(true);
	});
});
