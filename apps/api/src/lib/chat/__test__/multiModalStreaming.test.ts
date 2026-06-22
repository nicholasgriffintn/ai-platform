import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAIResponse, mockCreateStreamWithPostProcessing } = vi.hoisted(() => ({
	mockGetAIResponse: vi.fn(),
	mockCreateStreamWithPostProcessing: vi.fn(),
}));

vi.mock("~/lib/chat/responses", () => ({
	getAIResponse: mockGetAIResponse,
}));

vi.mock("../streaming", () => ({
	createStreamWithPostProcessing: mockCreateStreamWithPostProcessing,
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	}),
}));

vi.mock("~/utils/id", () => ({
	generateId: () => "generated-id",
}));

import { createMultiModelStream } from "../multiModalStreaming";

function createStream(events: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const event of events) {
				controller.enqueue(encoder.encode(event));
			}
			controller.close();
		},
	});
}

async function readStream(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let output = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		output += decoder.decode(value);
	}

	return output;
}

function parseDataEvents(output: string): any[] {
	return output
		.split("\n\n")
		.filter((event) => event.startsWith("data: "))
		.map((event) => event.substring(6))
		.filter((event) => event !== "[DONE]")
		.map((event) => JSON.parse(event));
}

describe("createMultiModelStream", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("adds a synthesis pass for consensus opinion requests", async () => {
		const primaryProviderStream = createStream([]);
		mockGetAIResponse
			.mockResolvedValueOnce(primaryProviderStream)
			.mockResolvedValueOnce({ response: "Secondary answer" })
			.mockResolvedValueOnce({ response: "Final consensus" });
		mockCreateStreamWithPostProcessing.mockResolvedValue(
			createStream([
				`data: ${JSON.stringify({
					type: "content_block_delta",
					content: "Primary answer",
				})}\n\n`,
				"data: [DONE]\n\n",
			]),
		);

		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue(null),
			get: vi.fn().mockResolvedValue([
				{
					role: "assistant",
					content: "Primary answer",
					data: {},
				},
			]),
			update: vi.fn(),
			add: vi.fn(),
		};

		const stream = createMultiModelStream(
			{
				messages: [
					{ role: "user", content: "Question" },
					{ role: "assistant", content: "Original answer" },
					{
						role: "user",
						content: "Consensus request",
						data: {
							opinion: {
								mode: "consensus",
								sourceMessageId: "assistant-1",
								modelIds: ["primary", "secondary"],
							},
						},
					},
				],
				models: [
					{ model: "primary", provider: "openai", displayName: "Primary" },
					{ model: "secondary", provider: "anthropic", displayName: "Secondary" },
				],
			},
			{
				env: {} as any,
				completion_id: "conversation-1",
				model: "primary",
				provider: "openai",
			},
			conversationManager as any,
		);

		const output = await readStream(stream);
		const finalMessageDelta = parseDataEvents(output).find(
			(event) => event.type === "message_delta",
		);

		expect(output).toContain("Final consensus");
		expect(finalMessageDelta).toEqual(
			expect.objectContaining({
				type: "message_delta",
				message_id: expect.any(String),
				content: expect.stringContaining("Final consensus"),
			}),
		);
		expect(mockGetAIResponse).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				model: "primary",
				provider: "openai",
				stream: false,
				disable_functions: true,
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: "user",
						content: expect.stringContaining("Write a concise consensus"),
					}),
				]),
			}),
		);
		expect(conversationManager.update).toHaveBeenCalledWith(
			"conversation-1",
			expect.arrayContaining([
				expect.objectContaining({
					content: expect.stringContaining("Final consensus"),
				}),
			]),
		);
	});
});
