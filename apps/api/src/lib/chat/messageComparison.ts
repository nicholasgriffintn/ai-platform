import type { Message } from "~/types";

interface StoredMessageForComparison extends Message {
	parent_message_id?: string;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "undefined";
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}

	const record = value as Record<string, unknown>;
	const entries = Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

	return `{${entries.join(",")}}`;
}

export function messagesMatchStoredPrefix(
	storedMessages: StoredMessageForComparison[],
	incomingMessages: Message[],
): boolean {
	if (storedMessages.length !== incomingMessages.length) {
		return false;
	}

	return storedMessages.every((storedMessage, index) => {
		const incomingMessage = incomingMessages[index];
		if (!incomingMessage) {
			return false;
		}

		if (
			storedMessage.id &&
			incomingMessage.id &&
			storedMessage.id !== incomingMessage.id &&
			storedMessage.parent_message_id !== incomingMessage.id
		) {
			return false;
		}

		return (
			storedMessage.role === incomingMessage.role &&
			stableStringify(storedMessage.content) === stableStringify(incomingMessage.content)
		);
	});
}
