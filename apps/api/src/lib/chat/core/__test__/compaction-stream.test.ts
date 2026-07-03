import { describe, expect, it } from "vitest";
import { parseChatStreamSseBuffer } from "@assistant/schemas";

import { prependCompactionStateEvent } from "../compaction-stream";
import type { Message } from "~/types";

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

describe("prependCompactionStateEvent", () => {
	it("leaves provider stream output unchanged without a valid compaction marker", async () => {
		const encoder = new TextEncoder();
		const providerStream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode('data: {"type":"content_block_delta","content":"Hello"}\n\n'),
				);
				controller.close();
			},
		});

		const result = await readStream(
			prependCompactionStateEvent(providerStream, {
				id: "user-1",
				role: "user",
				content: "Hello",
			}),
		);

		expect(parseChatStreamSseBuffer(result, { flush: true }).events).toEqual([
			{ type: "content_block_delta", content: "Hello" },
		]);
	});

	it("includes the persisted compaction marker in the compaction state event", async () => {
		const encoder = new TextEncoder();
		const providerStream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode('data: {"type":"content_block_delta","content":"Hello"}\n\n'),
				);
				controller.close();
			},
		});

		const compactionMessage: Message = {
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

		const result = await readStream(prependCompactionStateEvent(providerStream, compactionMessage));

		expect(parseChatStreamSseBuffer(result, { flush: true }).events).toEqual([
			{
				state: "compaction",
				type: "state",
				message: {
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
				},
			},
			{ type: "content_block_delta", content: "Hello" },
		]);
	});
});
