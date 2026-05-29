import { describe, expect, it } from "vitest";

import { hasToolCalls, nonEmptyToolCallsOrNull } from "../toolCalls";

describe("toolCalls utilities", () => {
	it("treats only non-empty arrays as tool calls", () => {
		expect(hasToolCalls(undefined)).toBe(false);
		expect(hasToolCalls(null)).toBe(false);
		expect(hasToolCalls([])).toBe(false);
		expect(hasToolCalls([{ id: "call_1" }])).toBe(true);
	});

	it("converts missing or empty tool calls to null for storage", () => {
		const toolCalls = [{ id: "call_1" }];

		expect(nonEmptyToolCallsOrNull(undefined)).toBeNull();
		expect(nonEmptyToolCallsOrNull([])).toBeNull();
		expect(nonEmptyToolCallsOrNull(toolCalls)).toBe(toolCalls);
	});
});
