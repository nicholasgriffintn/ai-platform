import { describe, expect, it } from "vitest";

import { getChatCompletionMessagesResponseSchema } from "./chat";

describe("chat schemas", () => {
	it("accepts stored assistant messages represented by parts and tool calls", () => {
		const result = getChatCompletionMessagesResponseSchema.safeParse({
			conversation_id: "1d465ce1-a3ee-4818-97ad-30f633330c2c",
			messages: [
				{
					id: "be7d21b2-af66-4c7c-b45a-48c80f9344ab",
					role: "user",
					content: "GTA 6 is coming out, write me a letter",
				},
				{
					id: "70ae18ed-ecf0-4de1-8ab5-0fa8429ef440",
					role: "assistant",
					parts: [
						{
							timestamp: 1782854043514,
							type: "reasoning",
							text: "Let me search for the latest GTA 6 release information.",
							collapsed: true,
						},
						{
							timestamp: 1782854043572,
							type: "tool_use",
							name: "web_search",
							toolCallId: "call_00_EPBIreC96A2WzsLns7Ov9665",
							input: {
								query: "GTA 6 release date 2026 latest news",
								search_depth: "advanced",
							},
						},
					],
					tool_calls: [
						{
							id: "call_00_EPBIreC96A2WzsLns7Ov9665",
							type: "function",
							function: {
								name: "web_search",
								arguments:
									'{"query": "GTA 6 release date 2026 latest news", "search_depth": "advanced"}',
							},
						},
					],
				},
			],
		});

		expect(result.success).toBe(true);
	});
});
