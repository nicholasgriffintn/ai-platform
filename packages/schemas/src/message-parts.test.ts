import { describe, expect, it } from "vitest";

import {
	hasInvalidCompactionPart,
	hasValidCompactionPart,
	isCompactionMarkerMessage,
	normaliseMessageParts,
} from "./message-parts";

describe("normaliseMessageParts", () => {
	it("normalises persisted snake-case tool part identifiers", () => {
		expect(
			normaliseMessageParts([
				{
					type: "tool_use",
					name: "web_search",
					tool_call_id: "call-search",
					input: { query: "context compaction" },
				},
				{
					type: "tool_result",
					tool_call_id: "call-search",
					content: "Search result",
				},
			]),
		).toEqual([
			expect.objectContaining({
				type: "tool_use",
				toolCallId: "call-search",
			}),
			expect.objectContaining({
				type: "tool_result",
				toolCallId: "call-search",
			}),
		]);
	});

	it("distinguishes valid, invalid, and missing compaction part statuses", () => {
		const validPart = [{ type: "compaction", status: "completed", label: "Context compacted" }];
		const invalidPart = [{ type: "compaction", status: "unknown", label: "Context compacted" }];
		const missingStatusPart = [{ type: "compaction", label: "Context compacted" }];

		expect(hasValidCompactionPart(validPart)).toBe(true);
		expect(hasInvalidCompactionPart(validPart)).toBe(false);
		expect(isCompactionMarkerMessage({ role: "assistant", parts: validPart })).toBe(true);

		for (const parts of [invalidPart, missingStatusPart]) {
			expect(hasValidCompactionPart(parts)).toBe(false);
			expect(hasInvalidCompactionPart(parts)).toBe(true);
			expect(isCompactionMarkerMessage({ role: "assistant", parts })).toBe(false);
			expect(normaliseMessageParts(parts)).toBeUndefined();
		}
	});
});
