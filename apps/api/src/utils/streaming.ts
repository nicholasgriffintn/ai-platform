export function detectStreaming(body: Record<string, any>, endpoint: string) {
	const isStreaming = body?.stream === true;
	const isEndpointStreaming =
		endpoint.includes("streamGenerateContent") ||
		endpoint.includes("converse-stream");
	return isStreaming || isEndpointStreaming;
}

export interface SseParserOptions {
	onEvent: (event: Record<string, unknown>) => void;
	onError?: (error: Error) => void;
}

/**
 * Parses Server-Sent Events (SSE) from a text buffer.
 * Handles multi-line data fields and maintains buffer state for incomplete events.
 *
 * @param buffer - The complete text buffer to parse
 * @param options - Callbacks for handling parsed events and errors
 * @returns The remaining buffer content that couldn't be parsed (incomplete event)
 */
export function parseSseBuffer(
	buffer: string,
	options: SseParserOptions,
): string {
	const blocks = buffer.split("\n\n");
	const remainingBuffer = blocks.pop() || "";

	for (const block of blocks) {
		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		const dataLines = lines
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trimStart());

		if (dataLines.length === 0) {
			continue;
		}

		const payload = dataLines.join("\n").trim();
		if (!payload || payload === "[DONE]") {
			continue;
		}

		try {
			const parsed = JSON.parse(payload) as Record<string, unknown>;
			options.onEvent(parsed);
		} catch (error) {
			options.onError?.(
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	return remainingBuffer;
}
