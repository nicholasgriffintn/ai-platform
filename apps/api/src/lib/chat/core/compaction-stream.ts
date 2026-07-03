import type { Message } from "~/types";
import { buildChatCompactionMetadata, type ChatCompactionMetadata } from "../compaction-metadata";
import { formatChatStreamSseEvent } from "@assistant/schemas";

function formatCompactionStateEvent(compactionMetadata: ChatCompactionMetadata): string {
	return formatChatStreamSseEvent("state", {
		state: "compaction",
		...compactionMetadata,
	});
}

export function prependCompactionStateEvent(
	stream: ReadableStream,
	message: Message,
): ReadableStream {
	const compactionMetadata = buildChatCompactionMetadata(message);
	if (!compactionMetadata) {
		return stream;
	}

	const encoder = new TextEncoder();
	const reader = stream.getReader();

	return new ReadableStream({
		async start(controller) {
			controller.enqueue(encoder.encode(formatCompactionStateEvent(compactionMetadata)));

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					controller.enqueue(value);
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}
