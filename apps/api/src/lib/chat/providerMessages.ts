import {
	normaliseProviderChatMessage,
	toProviderChatMessages,
	type NormalisedProviderChatMessage,
} from "@assistant/schemas";
import type { Message } from "~/types";

export type ProviderMessage = Message & {
	role: Exclude<Message["role"], "compaction">;
};

export type ProviderResponseMessage = Omit<ProviderMessage, "timestamp"> & {
	timestamp?: number | string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApiMessageContent(value: unknown): value is Message["content"] {
	return typeof value === "string" || Array.isArray(value) || isRecord(value);
}

function readProviderContent(content: unknown): Message["content"] {
	return isApiMessageContent(content) ? content : "";
}

function readOptionalToolCalls(value: unknown): Message["tool_calls"] {
	return Array.isArray(value) ? value : undefined;
}

function attachToolCalls<TMessage extends Pick<ProviderMessage, "tool_calls">>(
	message: TMessage,
	toolCalls: unknown[] | undefined,
): TMessage {
	if (toolCalls) {
		message.tool_calls = readOptionalToolCalls(toolCalls);
	}

	return message;
}

function toApiProviderMessage(message: NormalisedProviderChatMessage): ProviderMessage {
	const { content, timestamp, tool_calls, ...metadata } = message;
	const providerMessage: ProviderMessage = {
		...metadata,
		content: readProviderContent(content),
	};

	if (typeof timestamp === "number") {
		providerMessage.timestamp = timestamp;
	}

	return attachToolCalls(providerMessage, tool_calls);
}

function toApiProviderResponseMessage(
	message: NormalisedProviderChatMessage,
): ProviderResponseMessage {
	const { content, tool_calls, ...metadata } = message;
	const providerMessage: ProviderResponseMessage = {
		...metadata,
		content: readProviderContent(content),
	};

	return attachToolCalls(providerMessage, tool_calls);
}

export function isProviderMessage(message: unknown): message is ProviderMessage {
	return normaliseProviderChatMessage(message) !== undefined;
}

export function toProviderMessages(
	messages: readonly unknown[] | null | undefined,
): ProviderMessage[] {
	return toProviderChatMessages(messages).map(toApiProviderMessage);
}

export function toProviderResponseMessages(
	messages: readonly unknown[] | null | undefined,
): ProviderResponseMessage[] {
	return toProviderChatMessages(messages).map(toApiProviderResponseMessage);
}

export function toProviderResponseMessagePartSource(message: ProviderResponseMessage): Message {
	const { timestamp, ...messageWithoutTimestamp } = message;
	return {
		...messageWithoutTimestamp,
		...(typeof timestamp === "number" ? { timestamp } : {}),
	};
}
