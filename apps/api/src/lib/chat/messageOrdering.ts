import type { Message } from "~/types";

function resolveFiniteTimestamp(timestamp: Message["timestamp"]): number | undefined {
	if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
		return undefined;
	}

	return timestamp;
}

export function normaliseMessageTimestampsForStorage(messages: Message[]): Message[] {
	const fallbackStart = Date.now();
	let previousTimestamp: number | undefined;

	return messages.map((message, index) => {
		const timestamp = resolveFiniteTimestamp(message.timestamp) ?? fallbackStart + index;
		const orderedTimestamp =
			previousTimestamp === undefined || timestamp > previousTimestamp
				? timestamp
				: previousTimestamp + 1;
		previousTimestamp = orderedTimestamp;

		return {
			...message,
			timestamp: orderedTimestamp,
		};
	});
}
