import { describe, expect, it } from "vitest";

import { parseMetricMetadata } from "./metrics";

describe("parseMetricMetadata", () => {
	it("keeps malformed metadata visible without throwing", () => {
		expect(parseMetricMetadata("{broken")).toEqual({
			provider: "unknown",
			model: "unknown model",
			tokenUsage: {
				prompt_tokens: 0,
				completion_tokens: 0,
				total_tokens: 0,
			},
			cost: 0,
			cached: false,
			raw: "{broken",
		});
	});
});
