import { conversationModeMetadataSchema, type ConversationModeMetadata } from "@assistant/schemas";
import { buildCouncilMessageData, type CouncilTurnRouting } from "~/lib/chat/council";
import type { ChatMode, ChatRequestOptions } from "~/types";

const AGENT_EXECUTION_MODES = new Set<ChatMode>(["agent", "plan", "build", "explore"]);

export type ChatPromptMode = "council" | "sandbox" | "sms";

export function isAgentExecutionMode(mode: ChatMode): boolean {
	return AGENT_EXECUTION_MODES.has(mode);
}

export function resolveChatPromptMode(
	options: ChatRequestOptions | undefined,
): ChatPromptMode | undefined {
	if (options?.sandbox?.enabled) {
		return "sandbox";
	}
	if (options?.council?.enabled) {
		return "council";
	}
	if (options?.sms?.enabled) {
		return "sms";
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

export function buildConversationModeMetadataFromRequestOptions(
	options: ChatRequestOptions | undefined,
): ConversationModeMetadata | undefined {
	const mode = resolveChatPromptMode(options);
	if (!mode) {
		return undefined;
	}

	const parsed = conversationModeMetadataSchema.safeParse({
		mode,
		requestOptions: options,
		smsSettings: options?.sms?.enabled
			? {
					from: options.sms.from,
					to: options.sms.to,
				}
			: undefined,
		sandboxSettings: options?.sandbox?.enabled
			? {
					repoKey:
						typeof options.sandbox.installationId === "number" && options.sandbox.repo
							? `${options.sandbox.installationId}:${options.sandbox.repo}`
							: undefined,
					taskType: options.sandbox.taskType,
					promptStrategy: options.sandbox.promptStrategy,
					timeoutSecondsInput:
						typeof options.sandbox.timeoutSeconds === "number"
							? String(options.sandbox.timeoutSeconds)
							: undefined,
					shouldCommit: options.sandbox.shouldCommit,
				}
			: undefined,
	});

	return parsed.success ? parsed.data : undefined;
}
