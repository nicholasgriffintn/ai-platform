import { conversationModeMetadataSchema, type ConversationModeMetadata } from "@assistant/schemas";
import { buildCouncilMessageData, type CouncilTurnRouting } from "~/lib/chat/council";
import type { ChatMode, ChatRequestOptions } from "~/types";

const AGENT_EXECUTION_MODES = new Set<ChatMode>(["agent", "plan", "build", "explore"]);

export type ChatPromptMode = "council" | "sms";
export type ChatConversationMode = ChatPromptMode | "background";

export function isAgentExecutionMode(mode: ChatMode): boolean {
	return AGENT_EXECUTION_MODES.has(mode);
}

export function resolveChatPromptMode(
	options: ChatRequestOptions | undefined,
): ChatPromptMode | undefined {
	if (options?.council?.enabled) {
		return "council";
	}
	if (options?.sms?.enabled) {
		return "sms";
	}
	return undefined;
}

export function resolveChatConversationMode(
	options: ChatRequestOptions | undefined,
	background?: boolean,
): ChatConversationMode | undefined {
	const promptMode = resolveChatPromptMode(options);
	if (promptMode) {
		return promptMode;
	}
	if (background) {
		return "background";
	}
	return undefined;
}

function asResponseDataRecord(data: unknown): Record<string, unknown> | null {
	return data && typeof data === "object" && !Array.isArray(data)
		? (data as Record<string, unknown>)
		: null;
}

export function buildAssistantMessageData(params: {
	responseData?: unknown;
	requestOptions?: ChatRequestOptions;
	councilRouting?: CouncilTurnRouting | null;
}): Record<string, unknown> | null {
	const responseData = asResponseDataRecord(params.responseData);
	const councilData = buildCouncilMessageData(
		params.requestOptions?.council,
		params.councilRouting,
	);

	return councilData ? { ...responseData, ...councilData } : responseData;
}

export function buildUserMessageData(
	options: ChatRequestOptions | undefined,
	background?: boolean,
): Record<string, unknown> | undefined {
	const conversationMode = buildConversationModeMetadataFromRequestOptions(options, background);
	const codingTaskType = options?.sandbox?.enabled ? options.sandbox.taskType : undefined;

	if (!conversationMode && !codingTaskType) return undefined;

	return {
		...(conversationMode ? { conversationMode } : {}),
		...(codingTaskType ? { codingTaskType } : {}),
	};
}

export function buildConversationModeMetadataFromRequestOptions(
	options: ChatRequestOptions | undefined,
	background?: boolean,
): ConversationModeMetadata | undefined {
	const mode = resolveChatConversationMode(options, background);
	if (!mode) {
		return undefined;
	}

	const parsed = conversationModeMetadataSchema.safeParse({
		mode,
		requestOptions: mode === "background" ? undefined : options,
		smsSettings: options?.sms?.enabled
			? {
					from: options.sms.from,
					to: options.sms.to,
				}
			: undefined,
	});

	return parsed.success ? parsed.data : undefined;
}
