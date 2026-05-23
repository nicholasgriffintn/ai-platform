import { describe, expect, it } from "vitest";

import { resolveResponseData, resolveTextResponseData } from "./response-data";

describe("ResponseRenderer response data", () => {
	it("uses tool message content for text responses when metadata has no content", () => {
		const result = {
			status: "error",
			name: "run_feature_implementation",
			content: "User context is required for sandbox execution",
			data: {
				responseType: "text",
				responseDisplay: {
					fields: [
						{ key: "status", label: "Status" },
						{ key: "content", label: "Error" },
					],
				},
				icon: "alert-triangle",
				formattedName: "Run Feature Implementation",
			},
		};

		const responseData = resolveResponseData(result, {
			hasAppSchema: false,
			responseType: "text",
		});

		expect(resolveTextResponseData(result, responseData)).toEqual({
			content: "User context is required for sandbox execution",
		});
	});

	it("keeps explicit text response content from response data", () => {
		const result = {
			content: "fallback",
			data: {
				content: "preferred",
			},
		};

		expect(
			resolveTextResponseData(
				result,
				resolveResponseData(result, {
					hasAppSchema: false,
					responseType: "text",
				}),
			),
		).toEqual({ content: "preferred" });
	});

	it("does not unwrap result without an app schema or response type", () => {
		const result = {
			data: {
				result: {
					content: "nested",
				},
			},
		};

		expect(resolveResponseData(result, { hasAppSchema: false })).toEqual(result.data);
	});
});
