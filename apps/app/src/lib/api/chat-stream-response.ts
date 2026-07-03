import type { ChatCompletionResponseBody, ChatStreamMessage } from "@assistant/schemas";

import type { Message } from "~/types";
import { normalizeMessage } from "../messages";
import { isRecord } from "../objects";
import { ApiError } from "./fetch-wrapper";

const STREAM_ERROR_STATUS_BY_CODE: Record<string, number> = {
	authentication_error: 401,
	invalid_api_key: 401,
	insufficient_quota: 429,
	model_not_found: 404,
	quota_exceeded: 429,
	rate_limit_exceeded: 429,
};

export function createStreamingApiError(errorPayload: unknown): ApiError {
	if (!errorPayload || typeof errorPayload !== "object") {
		return new ApiError("Streaming response failed", 500, errorPayload);
	}

	const payload = errorPayload as Record<string, unknown>;
	const code =
		typeof payload.code === "string"
			? payload.code
			: typeof payload.type === "string"
				? payload.type
				: undefined;
	const message =
		typeof payload.message === "string" && payload.message.trim().length > 0
			? payload.message
			: "Streaming response failed";
	const status =
		typeof payload.status === "number"
			? payload.status
			: code
				? (STREAM_ERROR_STATUS_BY_CODE[code] ?? 500)
				: 500;

	return new ApiError(message, status, errorPayload, code);
}

type CompletionResponseMessage = ChatCompletionResponseBody["choices"][number]["message"];

function responseString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function responseTimestamp(
	value: CompletionResponseMessage["timestamp"] | unknown,
): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value !== "string" || !value.trim()) {
		return undefined;
	}

	const numericTimestamp = Number(value);
	if (Number.isFinite(numericTimestamp)) {
		return numericTimestamp;
	}

	const parsedTimestamp = Date.parse(value);
	return Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined;
}

function responseMessageContent(content: CompletionResponseMessage["content"]): Message["content"] {
	if (typeof content === "string") {
		return content;
	}

	if (isRecord(content)) {
		return content;
	}

	return "";
}

function responseMessageReasoning(reasoning: unknown): Message["reasoning"] | undefined {
	if (typeof reasoning === "string" && reasoning.trim()) {
		return {
			collapsed: true,
			content: reasoning.trim(),
		};
	}

	if (!isRecord(reasoning) || typeof reasoning.content !== "string") {
		return undefined;
	}

	return {
		collapsed: typeof reasoning.collapsed === "boolean" ? reasoning.collapsed : true,
		content: reasoning.content,
	};
}

function responseToolCalls(toolCalls: unknown): Message["tool_calls"] {
	if (!Array.isArray(toolCalls)) {
		return undefined;
	}

	const normalisedToolCalls: NonNullable<Message["tool_calls"]> = [];
	for (const [index, toolCall] of toolCalls.entries()) {
		if (!isRecord(toolCall) || !isRecord(toolCall.function)) {
			continue;
		}

		const functionName = responseString(toolCall.function.name);
		if (!functionName) {
			continue;
		}

		const functionArguments =
			typeof toolCall.function.arguments === "string" || isRecord(toolCall.function.arguments)
				? toolCall.function.arguments
				: "";

		const normalisedToolCall: NonNullable<Message["tool_calls"]>[number] = {
			function: {
				name: functionName,
				arguments: functionArguments,
			},
		};

		const id = responseString(toolCall.id);
		if (id) {
			normalisedToolCall.id = id;
		}

		if (toolCall.type === "function") {
			normalisedToolCall.type = "function";
		}

		normalisedToolCall.index = typeof toolCall.index === "number" ? toolCall.index : index;
		normalisedToolCalls.push(normalisedToolCall);
	}

	return normalisedToolCalls.length > 0 ? normalisedToolCalls : undefined;
}

export function toAppMessage(streamMessage: ChatStreamMessage): Message {
	return normalizeMessage({
		role: streamMessage.role,
		content: typeof streamMessage.content === "string" ? streamMessage.content : "",
		parts: streamMessage.parts,
		data: isRecord(streamMessage.data) ? streamMessage.data : undefined,
		reasoning: streamMessage.reasoning,
		id: streamMessage.id,
		created: streamMessage.created,
		timestamp: streamMessage.timestamp,
		model: streamMessage.model,
		provider: streamMessage.provider,
		platform: streamMessage.platform,
		citations: streamMessage.citations,
		usage: isRecord(streamMessage.usage) ? streamMessage.usage : undefined,
		log_id: streamMessage.log_id,
		name: streamMessage.name,
		tool_call_id: streamMessage.tool_call_id,
		tool_call_arguments: streamMessage.tool_call_arguments,
		tool_calls: streamMessage.tool_calls,
		status: streamMessage.status || undefined,
	});
}

export function toCompletionResponseAppMessage(
	responseBody: ChatCompletionResponseBody,
	fallbackModel?: string,
): Message {
	const responseMessage = responseBody.choices?.[0]?.message;
	const responseMessageRecord: Record<string, unknown> = isRecord(responseMessage)
		? responseMessage
		: {};
	const created =
		responseTimestamp(responseMessageRecord.created) ?? responseTimestamp(responseBody.created);

	return normalizeMessage({
		role: responseMessage?.role ?? "assistant",
		content: responseMessageContent(responseMessage?.content),
		parts: responseMessage?.parts,
		data: isRecord(responseMessage?.data) ? responseMessage.data : undefined,
		reasoning: responseMessageReasoning(responseMessageRecord.reasoning),
		id:
			responseString(responseMessage?.id) ?? responseString(responseBody.id) ?? crypto.randomUUID(),
		created,
		timestamp: responseTimestamp(responseMessage?.timestamp) ?? created,
		model: responseString(responseMessageRecord.model) ?? responseBody.model ?? fallbackModel,
		provider: responseString(responseMessageRecord.provider),
		platform: responseString(responseMessageRecord.platform),
		citations: responseMessage?.citations ?? null,
		usage: isRecord(responseMessageRecord.usage) ? responseMessageRecord.usage : responseBody.usage,
		log_id: responseString(responseMessage?.log_id) ?? responseString(responseBody.log_id),
		name: responseMessage?.name,
		tool_call_id: responseMessage?.tool_call_id,
		tool_call_arguments: responseMessage?.tool_call_arguments,
		tool_calls: responseToolCalls(responseMessage?.tool_calls),
		status: responseMessage?.status || undefined,
	});
}
