import { describe, expect, it } from "vitest";

import { getAiGatewayMetadataHeaders, resolveAiGatewayCacheTtl } from "../aiGateway";

describe("aiGateway", () => {
	describe("getAiGatewayMetadataHeaders", () => {
		it("returns only primitive gateway metadata values", () => {
			const result = getAiGatewayMetadataHeaders({
				completion_id: "completion-123",
				platform: "api",
				user: {
					id: 123,
					email: "test@example.com",
				},
			});

			expect(result).toEqual({
				email: "test@example.com",
				userId: 123,
				platform: "api",
				completionId: "completion-123",
			});
		});

		it("omits missing gateway metadata fields", () => {
			const result = getAiGatewayMetadataHeaders({});

			expect(result).toEqual({});
		});
	});

	describe("resolveAiGatewayCacheTtl", () => {
		it("uses configured non-negative cache ttl seconds", () => {
			expect(resolveAiGatewayCacheTtl({ options: { cache_ttl_seconds: 123 } })).toBe(123);
		});

		it("falls back when cache ttl is invalid", () => {
			expect(resolveAiGatewayCacheTtl({ options: { cache_ttl_seconds: -1 } })).toBe(86400);
		});
	});
});
