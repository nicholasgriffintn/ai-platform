import { describe, expect, it } from "vitest";

import { buildMessageParts, normaliseMessageParts } from "../messageParts";
import type { Message } from "~/types";

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
});

describe("buildMessageParts", () => {
	it("serialises ordinary object content as text instead of a snapshot", () => {
		const message: Message = {
			role: "assistant",
			content: {
				answer: "Visible structured response",
			},
		};

		expect(buildMessageParts(message)).toEqual([
			expect.objectContaining({
				type: "text",
				text: '{"answer":"Visible structured response"}',
			}),
		]);
	});
});
