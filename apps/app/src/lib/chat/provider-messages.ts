import { toProviderChatMessages, type NormalisedProviderChatMessage } from "@assistant/schemas";
import type { Message, MessageContent } from "~/types";
import { isRecord } from "../objects";

export type ProviderMessage = Omit<Message, "id" | "role"> & {
	id?: string;
	role: Exclude<Message["role"], "compaction">;
};

function isMessageContentPart(value: unknown): value is MessageContent {
	return isRecord(value) && typeof value.type === "string";
}

function readProviderContent(content: unknown): Message["content"] {
	if (typeof content === "string" || isRecord(content)) {
		return content;
	}

	if (Array.isArray(content) && content.every(isMessageContentPart)) {
		return content;
	}

	return "";
}

function readOptionalToolCalls(value: unknown): Message["tool_calls"] {
	return Array.isArray(value) ? value : undefined;
}

function toAppProviderMessage(message: NormalisedProviderChatMessage): ProviderMessage {
	const { content, timestamp, tool_calls, ...metadata } = message;
	const providerMessage: ProviderMessage = {
		...metadata,
		content: readProviderContent(content),
	};

	if (typeof timestamp === "number") {
		providerMessage.timestamp = timestamp;
	}

	if (tool_calls) {
		providerMessage.tool_calls = readOptionalToolCalls(tool_calls);
	}

	return providerMessage;
}

export function toProviderMessages(
	messages: readonly unknown[] | null | undefined,
): ProviderMessage[] {
	return toProviderChatMessages(messages).map(toAppProviderMessage);
}
