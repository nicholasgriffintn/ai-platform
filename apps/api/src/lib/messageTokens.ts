import type { Message } from "~/types";

const TOOL_RESULT_SUMMARY_LIMIT = 400;
const CHARS_PER_TOKEN = 4;
const TOOL_RESULT_CHARS_PER_TOKEN = 6;

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
		const text = content
			.map((part) =>
				part.type === "text"
					? part.text || ""
					: part.type === "thinking"
						? part.thinking || ""
						: "",
			)
			.join("\n");
		return truncateForTool(text);
	}

	try {
		return truncateForTool(JSON.stringify(content));
	} catch {
		return "";
	}
}

export function estimateMessageTokens(message: Message): number {
	const text = messageContentToText(message.content, message.role);
	const charsPerToken = message.role === "tool" ? TOOL_RESULT_CHARS_PER_TOKEN : CHARS_PER_TOKEN;
	return Math.ceil(text.length / charsPerToken) + 4;
}

export function estimateMessagesTokens(messages: Message[]): number {
	return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

export function estimateConversationTokens(
	messages: Message[],
	latestUserMessage: string,
): number {
	const historyTokens = estimateMessagesTokens(messages);
	return historyTokens + Math.ceil(latestUserMessage.length / CHARS_PER_TOKEN);
}
