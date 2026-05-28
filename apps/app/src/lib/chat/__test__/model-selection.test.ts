import { describe, expect, it } from "vitest";

import { normalizeSelectedModel, resolveRequestModel } from "../model-selection";

describe("chat model selection", () => {
	it("normalizes automatic model selection to an omitted request model", () => {
		expect(normalizeSelectedModel(null)).toBeUndefined();
		expect(normalizeSelectedModel("gpt-5.4")).toBe("gpt-5.4");
	});

	it("uses explicit request model overrides before the current selection", () => {
		expect(resolveRequestModel("gpt-5.4", "claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
		expect(resolveRequestModel(null, "claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
		expect(resolveRequestModel("gpt-5.4")).toBe("gpt-5.4");
		expect(resolveRequestModel(null)).toBeUndefined();
	});
});
