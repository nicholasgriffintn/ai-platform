export interface SseParserOptions<T> {
	onEvent: (event: T) => void;
	onError?: (error: Error) => void;
}

export function parseSseBuffer<T>(
	buffer: string,
	options: SseParserOptions<T>,
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
			options.onEvent(JSON.parse(payload) as T);
		} catch (error) {
			options.onError?.(
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	return remainingBuffer;
}
