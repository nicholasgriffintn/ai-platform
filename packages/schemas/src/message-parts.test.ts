import { describe, expect, it } from "vitest";

import {
	hasInvalidCompactionPart,
	hasValidCompactionPart,
	isCompactionMarkerMessage,
	normaliseCompactionParts,
	normaliseMessageParts,
} from "./message-parts";

describe("normaliseMessageParts", () => {
	it("drops compaction parts with invalid statuses", () => {
		expect(
			normaliseMessageParts([
				{
					type: "compaction",
					status: "unknown",
					label: "Automatically compacting context",
				},
			]),
		).toBeUndefined();
	});

	it("drops compaction parts without statuses", () => {
		expect(
			normaliseMessageParts([
				{
					type: "compaction",
					label: "Context compacted",
				},
			]),
		).toBeUndefined();
	});

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

	it("normalises only valid compaction parts through the compaction helper", () => {
		expect(
			normaliseCompactionParts([
				{ type: "text", text: "Visible text" },
				{
					type: "compaction",
					status: "pending",
					label: "Automatically compacting context",
				},
				{
					type: "compaction",
					status: "unknown",
					label: "Context compacted",
				},
				{
					type: "compaction",
					label: "Context compacted",
				},
			]),
		).toEqual([
			expect.objectContaining({
				type: "compaction",
				status: "pending",
				label: "Automatically compacting context",
			}),
		]);
	});

	it("detects invalid compaction parts before lenient normalisation", () => {
		expect(
			hasInvalidCompactionPart([
				{
					type: "compaction",
					status: "unknown",
					label: "Automatically compacting context",
				},
			]),
		).toBe(true);
		expect(
			hasInvalidCompactionPart([
				{
					type: "compaction",
					status: "pending",
					label: "Automatically compacting context",
				},
			]),
		).toBe(false);
		expect(
			hasInvalidCompactionPart([
				{
					type: "compaction",
					label: "Context compacted",
				},
			]),
		).toBe(true);
	});

	it("detects only valid compaction parts as display markers", () => {
		expect(
			hasValidCompactionPart([
				{
					type: "compaction",
					status: "completed",
					label: "Context compacted",
				},
			]),
		).toBe(true);
		expect(
			hasValidCompactionPart([
				{
					type: "compaction",
					status: "unknown",
					label: "Context compacted",
				},
			]),
		).toBe(false);
		expect(
			hasValidCompactionPart([
				{
					type: "compaction",
					label: "Context compacted",
				},
			]),
		).toBe(false);
	});

	it("detects compaction marker messages for provider exclusion", () => {
		expect(isCompactionMarkerMessage({ role: "compaction" })).toBe(true);
		expect(
			isCompactionMarkerMessage({
				role: "assistant",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			}),
		).toBe(true);
		expect(
			isCompactionMarkerMessage({
				role: "assistant",
				parts: [{ type: "text", text: "Visible response" }],
			}),
		).toBe(false);
		expect(isCompactionMarkerMessage({ role: "assistant", parts: "not-parts" })).toBe(false);
	});

	it("does not treat invalid assistant-shaped compaction parts as marker messages", () => {
		expect(
			isCompactionMarkerMessage({
				role: "assistant",
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			}),
		).toBe(false);
		expect(
			isCompactionMarkerMessage({
				role: "assistant",
				parts: [{ type: "compaction", label: "Context compacted" }],
			}),
		).toBe(false);
	});
});
