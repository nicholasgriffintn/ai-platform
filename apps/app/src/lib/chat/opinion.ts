import { getMessageTextContent } from "~/lib/messages";
import type { Message } from "~/types";

export type OpinionMode = "second-opinion" | "consensus";

export interface OpinionRequest {
	mode: OpinionMode;
	modelIds: string[];
}

export interface OpinionSourceContext {
	userMessage?: string;
	assistantAnswer: string;
}

const SECOND_OPINION_INTENT_PATTERN =
	/\b(second opinion|another opinion|consensus|double[-\s]?check|cross[-\s]?check|sanity check|verify|validate|review this|is (?:this|that) (?:right|correct|true)|am i (?:right|correct)|does this make sense)\b/i;
const MAX_SOURCE_CONTEXT_LENGTH = 12000;
const MAX_SOURCE_USER_MESSAGE_LENGTH = 4000;

function getMessageIndex(messages: Message[], messageId: string): number {
	return messages.findIndex((message) => message.id === messageId);
}

function getPreviousUserMessage(messages: Message[], messageIndex: number): Message | null {
	for (let index = messageIndex - 1; index >= 0; index--) {
		if (messages[index].role === "user") {
			return messages[index];
		}
	}

	return null;
}

function hasOpinionRequestData(message: Message | null): boolean {
	return Boolean(
		message?.data &&
		typeof message.data === "object" &&
		"opinion" in message.data &&
		message.data.opinion,
	);
}

function truncateSourceText(text: string, maxLength: number): string {
	const trimmed = text.trim();
	if (trimmed.length <= maxLength) {
		return trimmed;
	}

	return `${trimmed.slice(0, maxLength).trimEnd()}\n\n[Source text truncated for review.]`;
}

function getMessageTextForOpinion(message: Message): string {
	const text = getMessageTextContent(message);
	if (text) {
		return text;
	}

	return message.reasoning?.content?.trim() || "";
}

export function canRequestOpinionForMessage(messages: Message[], messageId: string): boolean {
	const messageIndex = getMessageIndex(messages, messageId);
	if (messageIndex === -1) {
		return false;
	}

	const message = messages[messageIndex];
	if (message.role !== "assistant") {
		return false;
	}

	const latestMessage = messages[messages.length - 1];
	if (latestMessage?.id !== messageId) {
		return false;
	}

	const previousUserMessage = getPreviousUserMessage(messages, messageIndex);
	return (
		!hasOpinionRequestData(previousUserMessage) && getMessageTextForOpinion(message).length > 0
	);
}

export function canOfferOpinionRequestForMessage(
	messages: Message[],
	messageId: string,
	canAccessProFeatures: boolean,
): boolean {
	return canAccessProFeatures && canRequestOpinionForMessage(messages, messageId);
}

export function shouldPromoteOpinionRequest(messages: Message[], messageId: string): boolean {
	const messageIndex = getMessageIndex(messages, messageId);
	if (messageIndex === -1 || !canRequestOpinionForMessage(messages, messageId)) {
		return false;
	}

	const previousUserMessage = getPreviousUserMessage(messages, messageIndex);
	if (!previousUserMessage) {
		return false;
	}

	return SECOND_OPINION_INTENT_PATTERN.test(getMessageTextContent(previousUserMessage));
}

export function getOpinionSourceContext(
	messages: Message[],
	messageId: string,
): OpinionSourceContext | null {
	const messageIndex = getMessageIndex(messages, messageId);
	if (messageIndex === -1) {
		return null;
	}

	const assistantMessage = messages[messageIndex];
	if (assistantMessage.role !== "assistant") {
		return null;
	}

	const assistantAnswer = getMessageTextForOpinion(assistantMessage);
	if (!assistantAnswer) {
		return null;
	}

	const previousUserMessage = getPreviousUserMessage(messages, messageIndex);
	const userMessage = previousUserMessage ? getMessageTextContent(previousUserMessage) : "";

	return {
		userMessage: userMessage
			? truncateSourceText(userMessage, MAX_SOURCE_USER_MESSAGE_LENGTH)
			: undefined,
		assistantAnswer: truncateSourceText(assistantAnswer, MAX_SOURCE_CONTEXT_LENGTH),
	};
}

export function buildOpinionRequestPrompt(
	request: OpinionRequest,
	sourceContext?: OpinionSourceContext | null,
): string {
	const sourceParts = sourceContext
		? [
				sourceContext.userMessage ? `Source user message:\n${sourceContext.userMessage}` : null,
				`Assistant answer to review:\n${sourceContext.assistantAnswer}`,
			]
				.filter((part): part is string => Boolean(part))
				.join("\n\n")
		: "";

	if (request.mode === "consensus") {
		return [
			"Consensus request: review the assistant answer below.",
			"Compare the selected models' judgement, identify what they agree on, call out any meaningful disagreement or uncertainty, and finish with the answer you would trust.",
			"Focus on correctness and missing caveats rather than rewriting for style.",
			sourceParts,
		].join(" ");
	}

	return [
		"Second opinion request: review the assistant answer below.",
		"Confirm what is correct, flag likely mistakes or missing caveats, and provide a corrected answer only where it changes the outcome.",
		sourceParts,
	].join(" ");
}
