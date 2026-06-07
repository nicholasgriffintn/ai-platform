import { MessageFormatter } from "~/lib/formatter";
import type { CreateChatCompletionsResponse, Message } from "~/types";
import { AssistantError, ErrorType } from "./errors";

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

export function formatTextGenerationPrompt(
	provider: string,
	messageHistory: Message[],
	system_prompt?: string,
	model?: string,
): string {
	return MessageFormatter.formatTextGenerationPrompt(messageHistory, {
		provider,
		model,
		system_prompt,
		maxTokens: 0,
		truncationStrategy: "tail",
	});
}

export function stringifyMessageContent(content: unknown): string {
	return MessageFormatter.stringifyMessageContent(content);
}

export function extractChatCompletionText(
	response: CreateChatCompletionsResponse | Response,
	options?: {
		streamingMessage?: string;
		fallback?: string;
	},
): string {
	if (response instanceof Response) {
		throw new AssistantError(
			options?.streamingMessage ?? "Chat completion text cannot be extracted from a stream",
			ErrorType.PARAMS_ERROR,
		);
	}

	const content = response.choices?.[0]?.message?.content;
	if (typeof content === "string" && content.trim()) {
		return content.trim();
	}

	return options?.fallback ?? "I could not generate a text response.";
}
