import { describe, expect, it, vi } from "vitest";

import { createStreamWithPostProcessing } from "../streaming";

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
});
