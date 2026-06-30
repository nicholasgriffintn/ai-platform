import type { ChatStreamMessage } from "@assistant/schemas";

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
