import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import { createStreamWithPostProcessing } from "../streaming";

const memoryMocks = vi.hoisted(() => ({
	handleMemory: vi.fn(),
	getInstance: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
	findModelConfig: vi.fn().mockResolvedValue({
		modalities: { input: ["text"], output: ["text"] },
	}),
}));

vi.mock("~/lib/providers/capabilities/guardrails", () => ({
	Guardrails: class {
		validateOutput = vi.fn().mockResolvedValue({ isValid: true });
	},
}));

vi.mock("~/lib/chat/tools", () => ({
	handleToolCalls: vi.fn().mockResolvedValue([
		{
			role: "tool",
			name: "get_recipe",
			content: "Recipe configuration fields loaded.",
			status: "success",
			tool_call_id: "call_recipe",
		},
	]),
}));

vi.mock("~/lib/memory", () => ({
	MemoryManager: {
		getInstance: memoryMocks.getInstance,
	},
}));

function createProviderStream(events: string[]): ReadableStream<Uint8Array> {
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

describe("createStreamWithPostProcessing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		memoryMocks.getInstance.mockReturnValue({
			handleMemory: memoryMocks.handleMemory,
		});
	});

	it("stops after provider stream errors without saving an assistant message", async () => {
		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue({
				daily: { used: 13, limit: 50 },
				pro: { used: 11.3, limit: 200 },
			}),
			add: vi.fn(),
		};

		const stream = await createStreamWithPostProcessing(
			createProviderStream([
				`data: ${JSON.stringify({
					error: {
						type: "insufficient_quota",
						code: "insufficient_quota",
						message: "Quota exceeded",
					},
				})}\n\n`,
				"data: [DONE]\n\n",
			]),
			{
				env: { AI: {} } as any,
				completion_id: "completion-1",
				model: "gpt-5.4-mini",
				provider: "openai",
			},
			conversationManager as any,
		);

		const output = await readStream(stream);

		expect(output.match(/data: \[DONE\]/g)).toHaveLength(1);
		expect(output).toContain('"type":"error"');
		expect(output).not.toContain('"state":"post_processing"');
		expect(output).not.toContain('"type":"message_delta"');
		expect(conversationManager.add).not.toHaveBeenCalled();
	});

	it("stores streamed assistant messages without empty tool calls", async () => {
		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue({
				daily: { used: 13, limit: 50 },
				pro: { used: 11.3, limit: 200 },
			}),
			add: vi.fn(),
		};

		const stream = await createStreamWithPostProcessing(
			createProviderStream([
				`data: ${JSON.stringify({
					choices: [{ delta: { content: "Hello" } }],
				})}\n\n`,
				"data: [DONE]\n\n",
			]),
			{
				env: { AI: {} } as any,
				completion_id: "completion-1",
				model: "gpt-5.4-mini",
				provider: "openai",
			},
			conversationManager as any,
		);

		await readStream(stream);

		expect(conversationManager.add).toHaveBeenCalledWith(
			"completion-1",
			expect.objectContaining({
				content: "Hello",
				tool_calls: null,
			}),
		);
	});

	it("finalises provider streams that close without a done marker", async () => {
		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue({
				daily: { used: 13, limit: 50 },
				pro: { used: 11.3, limit: 200 },
			}),
			add: vi.fn(),
		};

		const stream = await createStreamWithPostProcessing(
			createProviderStream([
				`event: content_block_delta\ndata: ${JSON.stringify({
					delta: { type: "text_delta", text: "Robots need coffee breaks." },
				})}\n\n`,
				`event: content_block_stop\ndata: ${JSON.stringify({
					index: 0,
					type: "content_block_stop",
				})}\n\n`,
			]),
			{
				env: { AI: {} } as any,
				completion_id: "completion-1",
				model: "claude-test",
				provider: "anthropic",
				platform: "web",
			},
			conversationManager as any,
		);

		const output = await readStream(stream);

		expect(output).toContain('"type":"message_start"');
		expect(output).toContain('"model":"claude-test"');
		expect(output).toContain('"provider":"anthropic"');
		expect(output).toContain('"state":"post_processing"');
		expect(output).toContain('"type":"message_delta"');
		expect(output).toContain('"type":"message_stop"');
		expect(output).toContain('"state":"done"');
		expect(output).toContain("data: [DONE]");
		expect(conversationManager.add).toHaveBeenCalledWith(
			"completion-1",
			expect.objectContaining({
				content: "Robots need coffee breaks.",
				model: "claude-test",
				platform: "web",
			}),
		);
	});

	it("emits assistant tool calls in message deltas for client replay", async () => {
		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue({
				daily: { used: 13, limit: 50 },
				pro: { used: 11.3, limit: 200 },
			}),
			add: vi.fn(),
		};

		const stream = await createStreamWithPostProcessing(
			createProviderStream([
				`data: ${JSON.stringify({
					choices: [
						{
							delta: {
								tool_calls: [
									{
										index: 0,
										id: "call_recipe",
										type: "function",
										function: {
											name: "get_recipe",
											arguments: "{}",
										},
									},
								],
							},
						},
					],
				})}\n\n`,
				"data: [DONE]\n\n",
			]),
			{
				env: { AI: {} } as any,
				completion_id: "completion-1",
				model: "gpt-5.4-mini",
				provider: "openai",
			},
			conversationManager as any,
		);

		const output = await readStream(stream);

		expect(output).toContain('"type":"message_delta"');
		expect(output).toContain('"tool_calls":[{"id":"call_recipe"');
	});

	it("skips automatic memory storage when the model already calls store_memory", async () => {
		const conversationManager = {
			getUsageLimits: vi.fn().mockResolvedValue({
				daily: { used: 13, limit: 50 },
				pro: { used: 11.3, limit: 200 },
			}),
			add: vi.fn(),
			get: vi.fn().mockResolvedValue([
				{
					role: "user",
					content: "Remember that I prefer concise replies",
				},
			]),
		};

		const stream = await createStreamWithPostProcessing(
			createProviderStream([
				`data: ${JSON.stringify({
					choices: [
						{
							delta: {
								tool_calls: [
									{
										index: 0,
										id: "call_memory",
										type: "function",
										function: {
											name: "store_memory",
											arguments: JSON.stringify({
												text: "User prefers concise replies",
												category: "preference",
											}),
										},
									},
								],
							},
						},
					],
				})}\n\n`,
				"data: [DONE]\n\n",
			]),
			{
				env: { AI: {} } as any,
				completion_id: "completion-1",
				model: "gpt-5.4-mini",
				provider: "openai",
				context: createServiceContext({
					env: { AI: {} } as any,
					user: { id: 42, plan_id: "pro" } as any,
				}),
				userSettings: {
					memories_save_enabled: true,
					memories_chat_history_enabled: true,
				} as any,
			},
			conversationManager as any,
		);

		await readStream(stream);

		expect(memoryMocks.getInstance).not.toHaveBeenCalled();
		expect(memoryMocks.handleMemory).not.toHaveBeenCalled();
	});
});
