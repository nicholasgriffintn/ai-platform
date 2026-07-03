import type { Message } from "~/types";

const TOOL_RESULT_SUMMARY_LIMIT = 400;
const CHARS_PER_TOKEN = 4;
const TOOL_RESULT_CHARS_PER_TOKEN = 6;

export type MessageTokenInput = Omit<Message, "parts"> & {
	parts?: unknown;
};

export function estimateTextTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function messageContentToText(content: Message["content"], role?: Message["role"]): string {
	const truncateForTool = (text: string) => {
		if (role === "tool" && text.length > TOOL_RESULT_SUMMARY_LIMIT) {
			return text.slice(0, TOOL_RESULT_SUMMARY_LIMIT) + "…";
		}
		return text;
	};

	if (typeof content === "string") {
		return truncateForTool(content);
	}

	if (Array.isArray(content)) {
		const text = content.map((part) => (part.type === "text" ? part.text || "" : "")).join("\n");
		return truncateForTool(text);
	}

	if (content === undefined || content === null) {
		return "";
	}

	try {
		return truncateForTool(JSON.stringify(content) ?? "");
	} catch {
		return "";
	}
}

function messagePartsToText(parts: unknown, role?: Message["role"]): string {
	if (!Array.isArray(parts)) {
		return "";
	}

	return parts
		.map((part) => {
			if (!isRecord(part)) {
				return "";
			}

			switch (part.type) {
				case "text":
					return typeof part.text === "string" ? part.text : "";
				case "snapshot":
					return typeof part.summary === "string" ? part.summary : "";
				case "tool_result":
					return messageContentToText(part.content as Message["content"], role);
				case "file":
					return (
						(typeof part.name === "string" && part.name) ||
						(typeof part.url === "string" && part.url) ||
						""
					);
				default:
					return "";
			}
		})
		.join("\n")
		.trim();
}

export function messageToText(message: MessageTokenInput): string {
	const contentText = messageContentToText(message.content, message.role).trim();
	return contentText || messagePartsToText(message.parts, message.role);
}

export function estimateMessageTokens(message: MessageTokenInput): number {
	const text = messageToText(message);
	const charsPerToken = message.role === "tool" ? TOOL_RESULT_CHARS_PER_TOKEN : CHARS_PER_TOKEN;
	return Math.ceil(text.length / charsPerToken) + 4;
}

export function estimateMessagesTokens(messages: readonly MessageTokenInput[]): number {
	return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

export function estimateConversationTokens(messages: readonly MessageTokenInput[]): number {
	const historyTokens = estimateMessagesTokens(messages);
	return historyTokens;
}
