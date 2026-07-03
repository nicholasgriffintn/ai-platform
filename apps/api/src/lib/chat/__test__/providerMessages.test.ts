import { describe, expect, it } from "vitest";

import {
	isProviderMessage,
	toProviderMessages,
	toProviderResponseMessagePartSource,
	toProviderResponseMessages,
} from "../providerMessages";

describe("isProviderMessage", () => {
	it("excludes compaction status messages represented by role or parts", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{
				role: "assistant",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{ role: "assistant", content: "Hi" },
		];

		expect(messages.filter(isProviderMessage)).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]);
	});

	it("projects nullable message lists into provider-eligible messages", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{ role: "assistant", content: "Hi" },
		];

		expect(toProviderMessages(messages)).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]);
		expect(toProviderMessages(undefined)).toEqual([]);
		expect(toProviderMessages(null)).toEqual([]);
	});

	it("excludes malformed assistant-shaped compaction metadata from provider context", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{
				role: "assistant",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			},
			{ role: "assistant", content: "Hi" },
		];

		expect(toProviderMessages(messages)).toEqual([
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi" },
		]);
	});

	it("keeps instruction roles eligible for provider context", () => {
		const messages = [
			{ role: "system", content: "System instructions" },
			{ role: "developer", content: "Developer instructions" },
			{ role: "user", content: "Hello" },
		];

		expect(toProviderMessages(messages).map((message) => message.role)).toEqual([
			"system",
			"developer",
			"user",
		]);
	});

	it("keeps assistant tool-call turns without content eligible for provider context", () => {
		const toolCallMessage = {
			role: "assistant",
			tool_calls: [
				{
					id: "call-weather",
					type: "function",
					function: {
						name: "get_weather",
						arguments: "{}",
					},
				},
			],
		};

		expect(isProviderMessage(toolCallMessage)).toBe(true);
		expect(toProviderMessages([toolCallMessage])).toEqual([{ ...toolCallMessage, content: "" }]);
	});

	it("keeps provider context timestamps numeric but preserves response timestamps", () => {
		const toolMessage = {
			id: "tool-1",
			role: "tool",
			content: "Tool result",
			timestamp: "2023-01-01T00:00:00Z",
		};

		expect(toProviderMessages([toolMessage])).toEqual([
			{
				id: "tool-1",
				role: "tool",
				content: "Tool result",
			},
		]);
		expect(toProviderResponseMessages([toolMessage])).toEqual([toolMessage]);
		expect(
			toProviderResponseMessagePartSource(toProviderResponseMessages([toolMessage])[0]),
		).toEqual({
			id: "tool-1",
			role: "tool",
			content: "Tool result",
		});
	});
});
