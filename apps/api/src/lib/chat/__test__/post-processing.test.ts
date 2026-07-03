import { describe, expect, it } from "vitest";

import { buildChatPostProcessing } from "../post-processing";

describe("buildChatPostProcessing", () => {
	it("preserves compaction metadata alongside tool-step metadata", () => {
		const compactionMessage = {
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context automatically compacted",
			parts: [
				{
					type: "compaction",
					status: "completed",
					label: "Context automatically compacted",
				},
			],
		};
		const steps = [
			{
				step: 1,
				tool_calls: [{ id: "tool-1" }],
			},
		];

		expect(
			buildChatPostProcessing({
				compactionMessage,
				response: {
					steps,
					totalUsage: { total_tokens: 42 },
				},
			}),
		).toEqual({
			compaction: {
				message: compactionMessage,
			},
			steps,
			total_usage: { total_tokens: 42 },
		});
	});

	it("rejects ordinary messages as compaction metadata", () => {
		expect(
			buildChatPostProcessing({
				compactionMessage: {
					id: "assistant-1",
					role: "assistant",
					content: "Hello",
				},
			}),
		).toEqual({});
	});
});
