import { MessageFormatter } from "~/lib/formatter";
import type { Message } from "~/types";
import { isRecord } from "./objects";

export function formatMessages(
	provider: string,
	messageHistory: Message[],
	system_prompt?: string,
	model?: string,
): Message[] {
	return MessageFormatter.formatMessages(messageHistory, {
		provider,
		model,
		system_prompt,
		maxTokens: 0,
		truncationStrategy: "tail",
	});
}

export function stringifyMessageContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content.map((item) => stringifyMessageContent(item)).join("\n");
	}

	if (isRecord(content)) {
		if (typeof content.text === "string") {
			return content.text;
		}

		if (typeof content.content === "string") {
			return content.content;
		}

		return JSON.stringify(content);
	}

	return "";
}
