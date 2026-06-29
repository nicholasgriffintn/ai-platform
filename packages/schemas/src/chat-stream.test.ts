import { describe, expect, it, vi } from "vitest";

import {
	createChatStreamAssembler,
	formatChatStreamSseDone,
	formatChatStreamSseEvent,
	parseChatStreamSseBuffer,
	parseChatStreamSseEvent,
	type ChatStreamUpdate,
} from "./chat-stream";

function collectUpdates(events: unknown[]) {
	const assembler = createChatStreamAssembler({
		model: "test-model",
		createId: vi.fn(() => "generated-id"),
		now: vi.fn(() => 1234),
	});
	const updates: ChatStreamUpdate[] = [];

	for (const event of events) {
		updates.push(...assembler.ingest(event));
	}

	return {
		updates,
		finalMessage: assembler.getFinalMessage(),
	};
}

describe("chat stream assembler", () => {
	it("emits separate assistant messages for recursive streamed turns and deduplicates tool results", () => {
		const duplicateToolResult = {
			type: "tool_response",
			tool_id: "tool-result-1",
			result: {
				role: "tool",
				id: "tool-result-1",
				name: "web_search",
				content: "Web search completed",
				status: "success",
				tool_call_id: "call-web-search",
				tool_call_arguments: '{"query":"recipe setup"}',
				data: { responseType: "text" },
			},
		};
		const toolCalls = [
			{
				id: "call-web-search",
				type: "function",
				function: {
					name: "web_search",
					arguments: '{"query":"recipe setup"}',
				},
			},
		];

		const { updates, finalMessage } = collectUpdates([
			{ type: "content_block_delta", content: "First turn" },
			{
				type: "message_delta",
				message_id: "assistant-1",
				created: 1000,
				model: "test-model",
				tool_calls: toolCalls,
				parts: [
					{ type: "text", text: "First turn", timestamp: 1000 },
					{
						type: "tool_use",
						name: "web_search",
						toolCallId: "call-web-search",
						input: { query: "recipe setup" },
						timestamp: 1000,
					},
				],
			},
			duplicateToolResult,
			duplicateToolResult,
			{ type: "tool_response_end" },
			{ type: "content_block_delta", content: "Second turn" },
			{
				type: "message_delta",
				message_id: "assistant-2",
				created: 2000,
				model: "test-model",
				parts: [{ type: "text", text: "Second turn", timestamp: 2000 }],
			},
		]);

		const finalisedMessages = updates
			.filter((update) => update.type === "assistant_final")
			.map((update) => update.message);
		const toolResults = updates
			.filter((update) => update.type === "tool_result")
			.map((update) => update.message);

		expect(finalisedMessages.map((message) => message.id)).toEqual(["assistant-1", "assistant-2"]);
		expect(finalisedMessages.map((message) => message.content)).toEqual([
			"First turn",
			"Second turn",
		]);
		expect(finalisedMessages[0]?.tool_calls).toEqual(toolCalls);
		expect(toolResults).toHaveLength(1);
		expect(toolResults[0]).toMatchObject({
			tool_call_id: "call-web-search",
			tool_call_arguments: '{"query":"recipe setup"}',
		});
		expect(finalMessage?.id).toBe("assistant-2");
		expect(finalMessage?.content).toBe("Second turn");
	});

	it("uses final message_delta content and parts when a stream revises the assistant message", () => {
		const { updates, finalMessage } = collectUpdates([
			{ type: "content_block_delta", content: "Primary answer" },
			{
				type: "message_delta",
				message_id: "assistant-1",
				created: 1000,
				model: "primary-model",
			},
			{ type: "content_block_delta", content: "Secondary answer" },
			{
				type: "message_delta",
				message_id: "assistant-1",
				created: 1001,
				model: "primary-model",
				content: "Primary answer\n\nSecondary answer",
			},
		]);

		const finalisedMessages = updates
			.filter((update) => update.type === "assistant_final")
			.map((update) => update.message);

		expect(finalisedMessages).toHaveLength(1);
		expect(finalMessage?.content).toBe("Primary answer\n\nSecondary answer");
		expect(finalMessage?.parts).toEqual([
			expect.objectContaining({
				type: "text",
				text: "Primary answer\n\nSecondary answer",
			}),
		]);
		expect(finalisedMessages.at(-1)?.content).toBe("Primary answer\n\nSecondary answer");
	});
});

describe("parseChatStreamSseEvent", () => {
	it("parses data events and done markers from raw SSE blocks", () => {
		expect(parseChatStreamSseEvent('data: {"type":"state","state":"thinking"}\n\n')).toEqual({
			type: "state",
			state: "thinking",
		});
		expect(parseChatStreamSseEvent("data: [DONE]\n\n")).toEqual({ type: "done" });
		expect(parseChatStreamSseEvent(": ping\n\n")).toBeNull();
	});

	it("formats typed events and done markers as SSE data blocks", () => {
		expect(formatChatStreamSseEvent("state", { state: "thinking" })).toBe(
			'data: {"state":"thinking","type":"state"}\n\n',
		);
		expect(formatChatStreamSseDone()).toBe("data: [DONE]\n\n");
	});

	it("parses CRLF-delimited buffers and can flush a trailing final block", () => {
		const firstParse = parseChatStreamSseBuffer(
			'data: {"state":"thinking","type":"state"}\r\n\r\n' +
				'data: {"content":"<answer","type":"content_block_delta"}\r\n\r\n' +
				'data: {"content":">\\nLoaded","type":"content_block_delta"}',
		);

		expect(firstParse.events).toEqual([
			{ state: "thinking", type: "state" },
			{ content: "<answer", type: "content_block_delta" },
		]);
		expect(firstParse.remainingBuffer).toBe(
			'data: {"content":">\\nLoaded","type":"content_block_delta"}',
		);

		const flushed = parseChatStreamSseBuffer(firstParse.remainingBuffer, { flush: true });
		expect(flushed).toEqual({
			events: [{ content: ">\nLoaded", type: "content_block_delta" }],
			remainingBuffer: "",
		});
	});
});
