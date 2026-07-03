import { describe, expect, it } from "vitest";

import { createChatExecutionRequest } from "../execution-request";
import type { ChatExecutionRequestInput } from "../execution-request";

function createInput(): ChatExecutionRequestInput {
	return {
		chatOptions: {
			app_url: "https://example.com",
			completion_id: "conversation-1",
			env: {},
			messages: [],
			stream: true,
		} as any,
		prepared: {
			currentMode: "normal",
			enabledTools: [],
			messageWithContext: "Hello",
			modelConfigs: [],
			primaryModel: "test-model",
			primaryModelConfig: {},
			primaryProvider: "test-provider",
			systemPrompt: "You are helpful",
			userSettings: null,
		} as any,
		messages: [
			{ role: "user", content: "Hello" },
			{
				role: "compaction",
				content: "Context automatically compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			},
			{ role: "assistant", content: "Hi" },
		] as any,
	};
}

describe("createChatExecutionRequest", () => {
	it("excludes compaction status messages from provider request parameters", () => {
		const request = createChatExecutionRequest(createInput());

		expect(request.providerRequest().messages).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]);
	});

	it("excludes compaction status messages from multi-model stream parameters", () => {
		const request = createChatExecutionRequest(createInput());

		expect(request.multiModelStreamRequest().messages).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]);
	});
});
