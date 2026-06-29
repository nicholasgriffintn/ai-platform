import type { ChatCompletionRequestBody } from "@assistant/schemas";
import type { ChatCompletionParameters, Message } from "~/types";

type IncomingChatCompletionRequest =
	| ChatCompletionRequestBody
	| Omit<ChatCompletionParameters, "env">;
type PreparedChatCompletionRequest = Omit<ChatCompletionParameters, "env">;
type IncomingMessage = NonNullable<IncomingChatCompletionRequest["messages"]>[number];

function textFromPart(part: NonNullable<IncomingMessage["parts"]>[number]): string | undefined {
	if ("text" in part && typeof part.text === "string") {
		return part.text;
	}
	if ("summary" in part && typeof part.summary === "string") {
		return part.summary;
	}
	if ("content" in part && typeof part.content === "string") {
		return part.content;
	}
	return undefined;
}

function contentFromParts(parts: IncomingMessage["parts"]): string {
	return (
		parts
			?.map(textFromPart)
			.filter((text): text is string => !!text)
			.join("\n") ?? ""
	);
}

function normaliseMessages(
	messages: IncomingChatCompletionRequest["messages"],
): Message[] | undefined {
	return messages?.map(
		(message): Message => ({
			...message,
			content: message.content ?? contentFromParts(message.parts),
		}),
	);
}

function normaliseStop(stop: IncomingChatCompletionRequest["stop"]): string[] | undefined {
	if (!stop) {
		return undefined;
	}
	return Array.isArray(stop) ? stop : [stop];
}

function normaliseMaxTokens(request: IncomingChatCompletionRequest): number | undefined {
	return request.max_tokens ?? request.max_completion_tokens ?? request.max_output_tokens;
}

function normaliseReasoningEffort(
	request: IncomingChatCompletionRequest,
): ChatCompletionParameters["reasoning_effort"] {
	return request.reasoning_effort ?? request.reasoning?.effort;
}

export function normaliseChatCompletionRequest(
	request: IncomingChatCompletionRequest,
): PreparedChatCompletionRequest {
	const {
		user: _openAiUser,
		max_completion_tokens: _maxCompletionTokens,
		max_output_tokens: _maxOutputTokens,
		reasoning: _reasoning,
		...chatRequest
	} = request;

	return {
		...chatRequest,
		messages: normaliseMessages(request.messages),
		stop: normaliseStop(request.stop),
		max_tokens: normaliseMaxTokens(request),
		reasoning_effort: normaliseReasoningEffort(request),
		options: request.options || {},
	};
}
